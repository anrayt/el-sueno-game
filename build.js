const fs=require('fs');
// Собирает обе версии игры в dist/, каждая — один самодостаточный HTML (three.min.js + код встроены):
//   dist/el-sueno.html      — квест: src/*
//   dist/el-sueno-walk.html — ходьба: versions/walk/src/* + общие src/data.js и src/audio.js (контент и звук)
const p=f=>fs.readFileSync(f,'utf8');
const esc=s=>s.replace(/<\/script/gi,'<\\/script');
const three=esc(p('node_modules/three/build/three.min.js'));
const VERSIONS=[
  {out:'dist/el-sueno.html',shell:'src/shell.html',files:['data','audio','world','systems','screens','game'].map(n=>`src/${n}.js`)},
  {out:'dist/el-sueno-walk.html',shell:'versions/walk/src/shell.html',files:['src/data.js','src/audio.js',...['world','systems','game'].map(n=>`versions/walk/src/${n}.js`)]},
];
fs.mkdirSync('dist',{recursive:true});
for(const v of VERSIONS){
  const game=esc(v.files.map(p).join('\n'));
  const html=p(v.shell).replace('/*__THREE__*/',()=>three).replace('/*__GAME__*/',()=>game);
  fs.writeFileSync(v.out,html);
  console.log('ok',v.out,(html.length/1024|0)+' KB');
}
