import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await Promise.all([
  build({ entryPoints: ['web/app.js'], bundle: true, outfile: 'dist/app.js', format: 'esm', minify: true, target: 'es2022' }),
  ...['index.html', 'style.css'].map(file => copyFile(`web/${file}`, `dist/${file}`)),
]);
