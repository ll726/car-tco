// 単一HTML化: index.html の外部script参照を中身に置換し、
// car_tco.html(配布用)と docs/index.html(GitHub Pages公開用)を生成
// 使い方: node build.js
const fs = require("fs");
let html = fs.readFileSync("index.html", "utf8");
for (const f of ["data.js", "engine.js"]) {
  const code = fs.readFileSync(f, "utf8");
  html = html.replace(`<script src="${f}"></script>`, `<script>\n${code}</script>`);
}
fs.writeFileSync("car_tco.html", html);
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/index.html", html);
console.log("car_tco.html / docs/index.html を生成しました (" + Math.round(html.length / 1024) + "KB)");
