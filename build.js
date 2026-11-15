const fs=require('fs');
// Собирает src/* + three.min.js в один самодостаточный dist/el-sueno.html
const p=f=>fs.readFileSync(f,'utf8');
let html=p('src/shell.html');
const three=p('node_modules/three/build/three.min.js').replace(/<\/script/gi,'<\\/script');
const game=['data','audio','world','systems','screens','game'].map(n=>p(`src/${n}.js`)).join('\n').replace(/<\/script/gi,'<\\/script');
html=html.replace('/*__THREE__*/',()=>three).replace('/*__GAME__*/',()=>game);
fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/el-sueno.html',html);
console.log('ok',(html.length/1024|0)+' KB');
