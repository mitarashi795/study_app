const KEY = "study-tracker-v2";
const R = [
  {k:1, label:"✅ 答えを見ずにこたえられた", short:"✅ 見ずに正解", mark:"✅", cls:"r1"},
  {k:2, label:"🤔 考え方は合ってたが間違えた", short:"🤔 考え方OK・ミス", mark:"🤔", cls:"r2"},
  {k:3, label:"❌ 答えられなかった", short:"❌ 答えられない", mark:"❌", cls:"r3"}
];
const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2, "0");
const fmt = t => { const d = new Date(t); return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };

let items = load();
let fRating = 0, fTag = "", newRating = 1;

function load() {
  try {
    const v2 = localStorage.getItem(KEY);
    if (v2) return JSON.parse(v2);
    // 旧バージョンからの移行
    const v1 = JSON.parse(localStorage.getItem("study-items") || "[]");
    return v1.map(i => ({id:i.id, t:i.t, tag:"", hist:[{r:i.r, at:i.u}]}));
  } catch (e) { return []; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }
const cur = i => i.hist[i.hist.length - 1];
const tags = () => [...new Set(items.map(i => i.tag).filter(Boolean))].sort();

function rateButtons(sel) {
  return R.map(r => `<button class="${r.cls} ${sel === r.k ? "on" : ""}" data-k="${r.k}">${r.label}</button>`).join("");
}

function renderNew() {
  $("newRate").innerHTML = rateButtons(newRating);
  $("newRate").querySelectorAll("button").forEach(b => b.onclick = () => { newRating = +b.dataset.k; renderNew(); });
  $("tagList").innerHTML = tags().map(t => `<option value="${esc(t)}">`).join("");
}

function renderFilters() {
  const base = items.filter(i => !fTag || i.tag === fTag);
  const cnt = k => k ? base.filter(i => cur(i).r === k).length : base.length;
  $("ratingFilters").innerHTML = [{k:0, short:"すべて"}, ...R]
    .map(r => `<button class="${fRating === r.k ? "on" : ""}" data-k="${r.k}">${r.short} (${cnt(r.k)})</button>`).join("");
  $("ratingFilters").querySelectorAll("button").forEach(b => b.onclick = () => { fRating = +b.dataset.k; render(); });

  const ts = tags();
  $("tagFilters").innerHTML = ts.length
    ? [`<button class="${!fTag ? "on" : ""}" data-t="">全科目</button>`, ...ts.map(t => `<button class="${fTag === t ? "on" : ""}" data-t="${esc(t)}">#${esc(t)}</button>`)].join("")
    : "";
  $("tagFilters").querySelectorAll("button").forEach(b => b.onclick = () => { fTag = b.dataset.t; render(); });
}

function renderChart() {
  const scope = items.filter(i => !fTag || i.tag === fTag);
  const byDay = {};
  scope.forEach(i => i.hist.forEach(h => {
    const d = byDay[dayKey(h.at)] ||= {n:0, ok:0};
    d.n++; if (h.r === 1) d.ok++;
  }));
  const days = Object.keys(byDay).sort().slice(-14);
  $("chartNote").textContent = fTag ? `#${fTag}・✅の割合` : "全科目・✅の割合";
  if (!days.length) { $("chart").innerHTML = `<div class="empty">記録がたまるとここに表示されます</div>`; return; }

  const W = 600, H = 190, L = 34, Rr = 14, T = 14, B = 34;
  const x = i => days.length === 1 ? (L + W - Rr) / 2 : L + i * (W - L - Rr) / (days.length - 1);
  const y = p => T + (1 - p) * (H - T - B);
  const pts = days.map((d, i) => ({x: x(i), y: y(byDay[d].ok / byDay[d].n), d, ...byDay[d]}));
  const grid = [0, .5, 1].map(p => `<line class="grid" x1="${L}" x2="${W-Rr}" y1="${y(p)}" y2="${y(p)}"/><text x="${L-6}" y="${y(p)+4}" text-anchor="end">${p*100}%</text>`).join("");
  const labels = pts.map(p => `<text x="${p.x}" y="${H-16}" text-anchor="middle">${+p.d.slice(5,7)}/${+p.d.slice(8)}</text><text x="${p.x}" y="${H-4}" text-anchor="middle">${p.n}件</text>`).join("");
  const line = pts.length > 1 ? `<polyline class="line" points="${pts.map(p => `${p.x},${p.y}`).join(" ")}"/>` : "";
  const dots = pts.map(p => `<circle class="dot" cx="${p.x}" cy="${p.y}" r="4"><title>${p.d}: ${Math.round(p.ok/p.n*100)}% (${p.ok}/${p.n})</title></circle>`).join("");
  $("chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="正答率の推移">${grid}${line}${dots}${labels}</svg>`;
}

function renderList() {
  const q = $("q").value.trim().toLowerCase();
  const shown = items.filter(i =>
    (!fRating || cur(i).r === fRating) &&
    (!fTag || i.tag === fTag) &&
    (!q || i.t.toLowerCase().includes(q)));
  if (!shown.length) {
    $("list").innerHTML = `<div class="empty">${items.length ? "該当する項目がありません" : "まだ項目がありません。上から追加してみましょう"}</div>`;
    return;
  }
  $("list").innerHTML = shown.map(i => `
    <div class="card item" data-id="${i.id}">
      <div class="top">
        <div><div class="title">${esc(i.t)}</div>
        <div class="meta"><span class="tagchip" title="タップでタグを変更">${i.tag ? "#" + esc(i.tag) : "+ タグ"}</span>更新 ${fmt(cur(i).at)}</div></div>
        <button class="del" title="削除">✕</button>
      </div>
      <div class="hist" title="評価の履歴(左が古い)">履歴 ${i.hist.map(h => R[h.r-1].mark).join(" ")}</div>
      <div class="row rate">${rateButtons(cur(i).r)}</div>
    </div>`).join("");
  $("list").querySelectorAll(".item").forEach(el => {
    const it = items.find(x => x.id == el.dataset.id);
    el.querySelector(".del").onclick = () => { if (confirm("削除しますか?")) { items = items.filter(x => x !== it); save(); render(); } };
    el.querySelector(".tagchip").onclick = () => {
      const v = prompt("科目タグ(空欄で削除)", it.tag || "");
      if (v !== null) { it.tag = v.trim(); if (fTag && !tags().includes(fTag)) fTag = ""; save(); render(); }
    };
    el.querySelectorAll(".rate button").forEach(b => b.onclick = () => {
      it.hist.push({r: +b.dataset.k, at: Date.now()}); save(); render();
    });
  });
}

function render() { renderNew(); renderFilters(); renderChart(); renderList(); }

$("addBtn").onclick = () => {
  const t = $("title").value.trim();
  if (!t) { $("title").focus(); return; }
  items.unshift({id: Date.now(), t, tag: $("tag").value.trim(), hist: [{r: newRating, at: Date.now()}]});
  save(); $("title").value = ""; render();
};
$("title").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) $("addBtn").click(); });
$("q").addEventListener("input", renderList);

$("exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(items, null, 2)], {type: "application/json"}));
  a.download = `study-tracker-${dayKey(Date.now())}.json`; a.click();
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async e => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(data) || !confirm("現在のデータを読み込んだ内容で置き換えますか?")) return;
    items = data; save(); render();
  } catch (err) { alert("読み込めませんでした"); }
  e.target.value = "";
};

render();
