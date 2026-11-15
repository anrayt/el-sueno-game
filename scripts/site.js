const fs = require('fs');
// Готовит каталог site/ для Cloudflare Pages из уже собранного dist/:
//   index.html — квест, walk/index.html — версия с ходьбой, _headers — заголовки, 404.html — назад на /.
// dist/ не трогаем: файлы там остаются для запуска через file://.
fs.rmSync('site', { recursive: true, force: true });
fs.mkdirSync('site/walk', { recursive: true });
fs.copyFileSync('dist/el-sueno.html', 'site/index.html');
fs.copyFileSync('dist/el-sueno-walk.html', 'site/walk/index.html');
fs.copyFileSync('deploy/cloudflare/_headers', 'site/_headers');
fs.copyFileSync('deploy/cloudflare/404.html', 'site/404.html');
console.log('ok site/');
