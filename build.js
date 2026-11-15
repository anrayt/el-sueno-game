import fs from 'node:fs';
import * as esbuild from 'esbuild';
// Собирает обе версии игры в dist/. Каждая — один самодостаточный HTML: esbuild пакует main.js
// со всеми модулями и three.js в IIFE, который встраивается в обычный <script> (работает через file://).
//   dist/el-sueno.html      — квест: src/main.js
//   dist/el-sueno-walk.html — ходьба: versions/walk/src/main.js (+ общие src/data.js, src/audio.js)
const VERSIONS = [
  { out: 'dist/el-sueno.html', shell: 'src/shell.html', entry: 'src/main.js' },
  { out: 'dist/el-sueno-walk.html', shell: 'versions/walk/src/shell.html', entry: 'versions/walk/src/main.js' },
];
fs.mkdirSync('dist', { recursive: true });
for (const v of VERSIONS) {
  const r = await esbuild.build({
    entryPoints: [v.entry], bundle: true, format: 'iife', write: false,
    minify: true, charset: 'utf8', target: 'es2020', logLevel: 'warning',
  });
  const game = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  // функция-заменитель: «$» в коде не должен трактоваться как шаблон подстановки
  const html = fs.readFileSync(v.shell, 'utf8').replace('/*__GAME__*/', () => game);
  fs.writeFileSync(v.out, html);
  console.log('ok', v.out, (html.length / 1024 | 0) + ' KB');
}
