import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import path from "path";
import { Constants } from "./src/renderer/constants.ts";

function htmlVariablesPlugin() {
  return {
    name: "py-html-variables-plugin",
    transformIndexHtml(html: string) {
      const usedKeys = new Set<string>();
      const result = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        usedKeys.add(key);
        const id = (Constants.Ids as Record<string, string>)[key];
        return id ?? match;
      });

      for (const key of usedKeys) {
        if (!(key in Constants.Ids)) {
          throw new Error(`[py-html-variables-plugin] Invalid placeholder: {{${key}}}`);
        }
      }

      return result;
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
      lib: {
        entry: path.resolve(__dirname, "src/main/index.ts"),
        formats: ["es"],
      },
      rollupOptions: {
        output: {
          entryFileNames: "index.js",
        },
        external: ["electron", "sqlite3", "sharp"],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      lib: {
        entry: path.resolve(__dirname, "src/preload/index.ts"),
        formats: ["cjs"],
      },
      rollupOptions: {
        output: {
          entryFileNames: "index.js",
        },
        external: ["electron"],
      },
    },
  },
  renderer: {
    root: path.resolve(__dirname, "src/renderer"),
    plugins: [htmlVariablesPlugin()],
    build: {
      outDir: path.resolve(__dirname, "out/renderer"),
      rollupOptions: {
        input: path.resolve(__dirname, "src/renderer/index.html"),
      },
    },
  },
});
