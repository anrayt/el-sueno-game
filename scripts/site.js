const fs = require('fs');
// Готовит каталог site/ для Cloudflare Pages: игра как index.html + заголовки.
// dist/ не трогаем: dist/el-sueno.html остаётся для запуска через file://.
fs.rmSync('site', { recursive: true, force: true });
fs.mkdirSync('site');
fs.copyFileSync('dist/el-sueno.html', 'site/index.html');
fs.copyFileSync('deploy/cloudflare/_headers', 'site/_headers');
console.log('ok site/');
