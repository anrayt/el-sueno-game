import fs from 'node:fs';
// Готовит каталог site/ для Cloudflare Pages из уже собранного dist/:
//   index.html — игра, _headers — заголовки, _redirects — /walk/ → /, 404.html — назад на /.
// dist/ не трогаем: файл там остаётся для запуска через file://.
fs.rmSync('site', { recursive: true, force: true });
fs.mkdirSync('site', { recursive: true });
fs.copyFileSync('dist/el-sueno.html', 'site/index.html');
for (const f of ['_headers', '_redirects', '404.html']) fs.copyFileSync(`deploy/cloudflare/${f}`, `site/${f}`);
console.log('ok site/');
