import path from "node:path";
import type { Connect, Plugin } from "vite";
import { compileClass } from "./compile-class";
import type { CompileRequest } from "../shared/types";

export const COMPILE_ENDPOINT = "/api/compile";

async function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

/**
 * Exposes the Tailwind compile step to the browser app.
 *
 * The plugin under test is a Tailwind plugin, so the only trustworthy way to
 * answer "can this class be processed?" is to let Tailwind compile it. That
 * needs Node, which is why the playground runs on the dev server.
 */
export function fluidCompilePlugin(): Plugin {
  let repoRoot = process.cwd();

  // Warning capture patches the global `console.warn`, so builds must not overlap.
  let queue: Promise<unknown> = Promise.resolve();

  return {
    name: "fluid-tailwindcss:compile-endpoint",
    configResolved(config) {
      repoRoot = path.resolve(config.root, "..");
    },
    configureServer(server) {
      // The plugin source lives outside the demo root; watch it so edits
      // invalidate the SSR module graph and the next compile picks them up.
      server.watcher.add(path.join(repoRoot, "src"));

      server.middlewares.use(COMPILE_ENDPOINT, (req, res, next) => {
        if (req.method !== "POST") return next();

        const respond = async () => {
          try {
            const request = (await readJsonBody(req)) as CompileRequest;
            const result = await compileClass(request, {
              repoRoot,
              loadModule: (absolutePath) => server.ssrLoadModule(absolutePath),
            });

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
        };

        queue = queue.then(respond, respond);
      });
    },
  };
}
