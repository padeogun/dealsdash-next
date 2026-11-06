import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
// The demo build is one self-contained file with example data and no backend.
const demo = process.env.VITE_DEMO === "1";
export default defineConfig({ plugins: demo ? [react(), viteSingleFile()] : [react()], test: { include: ["src/**/*.test.js"] } });
