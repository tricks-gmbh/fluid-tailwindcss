import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fluidCompilePlugin } from "./server/vite-plugin-fluid-compile";

export default defineConfig({
  plugins: [react(), tailwindcss(), fluidCompilePlugin()],
  server: {
    port: 5175,
    open: true,
    fs: {
      // The playground compiles the plugin straight from `../src`.
      allow: [".."],
    },
  },
});
