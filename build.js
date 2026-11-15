import fs from 'node:fs';
import * as esbuild from 'esbuild';
// Собирает игру в dist/el-sueno.html — один самодостаточный HTML: esbuild пакует src/main.js
// со всеми модулями и three.js в IIFE, который встраивается в обычный <script> (работает через file://).
// Общий код — src/shared/, режимы сцен — src/modes/walk (улица) и src/modes/frame (кадры).
const VERSIONS = [
  { out: 'dist/el-sueno.html', shell: 'src/shell.html', entry: 'src/main.js' },
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
