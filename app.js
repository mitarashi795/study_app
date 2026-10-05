const KEY = "study-tracker-v3";
const R = [
  {k:1, label:"答えを見ずにこたえられた", short:"見ずに正解", mark:"正", cls:"r1"},
  {k:2, label:"考え方は合ってたが間違えた", short:"考え方OK・ミス", mark:"惜", cls:"r2"},
  {k:3, label:"答えられなかった", short:"答えられない", mark:"誤", cls:"r3"}
];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2, "0");
const fmt = t => { const d = new Date(t); return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nat = (a, b) => a.localeCompare(b, "ja", {numeric: true});

/* ---------- データ ---------- */
function migrate(raw) {
  if (raw && !Array.isArray(raw) && raw.folders) return {folders: raw.folders, items: raw.items || []};
  const fs = [], map = {};
  const its = (Array.isArray(raw) ? raw : []).map(i => {
    let folder = null;
    if (i.tag) {
      if (!map[i.tag]) { map[i.tag] = uid(); fs.push({id: map[i.tag], name: i.tag, parent: null, open: true}); }
      folder = map[i.tag];
    }
    return {id: i.id != null ? String(i.id) : uid(), t: i.t, folder, hist: i.hist || [{r: i.r, at: i.u}]};
  });
  return {folders: fs, items: its};
}
function load() {
  try {
    for (const k of [KEY, "study-tracker-v2", "study-items"]) {
      const v = localStorage.getItem(k);
      if (v) return migrate(JSON.parse(v));
    }
  } catch (e) {}
  return {folders: [], items: []};
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({folders, items})); } catch (e) {} }

let {folders, items} = load();
let sel = null, fRating = 0, newRating = 1;

const cur = i => i.hist[i.hist.length - 1];
const fById = id => folders.find(f => f.id === id);
const kids = id => folders.filter(f => f.parent === id).sort((a, b) => nat(a.name, b.name));
function desc(id) { const out = [id]; kids(id).forEach(k => out.push(...desc(k.id))); return out; }
function path(id) { const p = []; let f = fById(id); while (f) { p.unshift(f.name); f = fById(f.parent); } return p.join(" / "); }
const scoped = () => sel === null ? items : items.filter(i => desc(sel).includes(i.folder));
function folderOptions(exclude) {
  return folders.filter(f => !exclude.includes(f.id)).map(f => ({id: f.id, label: path(f.id)})).sort((a, b) => nat(a.label, b.label));
}

/* ---------- 範囲入力 "1-20, 25" ---------- */
function parseRange(s) {
  s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 65248))
       .replace(/[～〜~－―ー−]/g, "-").replace(/\s*-\s*/g, "-")
       .replace(/と|[、，\s]+/g, ",");
  if (!/^[\d,\-]+$/.test(s)) return null;
  const out = [];
  for (const part of s.split(",").filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    let a = +m[1], b = m[2] ? +m[2] : a;
    if (a > b) [a, b] = [b, a];
    if (b - a > 999) return null;
    for (let n = a; n <= b; n++) out.push(String(n));
  }
  return out.length ? [...new Set(out)] : null;
}

/* ---------- フォルダ操作 ---------- */
function moveFolder(id, target) {
  if (id === target || (target !== null && desc(id).includes(target))) return;
  fById(id).parent = target;
  if (target) fById(target).open = true;
  save(); render();
}
function moveItem(id, target) {
  const it = items.find(x => x.id === id);
  if (it) { it.folder = target; save(); render(); }
}
$("addF").onclick = () => {
  const name = (prompt("フォルダ名") || "").trim();
  if (!name) return;
  const f = {id: uid(), name, parent: sel, open: true};
  if (sel) fById(sel).open = true;
  folders.push(f); sel = f.id; save(); render();
};
$("renameF").onclick = () => {
  const f = fById(sel); if (!f) return;
  const name = (prompt("新しい名前", f.name) || "").trim();
  if (name) { f.name = name; save(); render(); }
};
$("delF").onclick = () => {
  const f = fById(sel); if (!f) return;
  if (!confirm(`「${f.name}」を削除します。中のフォルダと項目は一つ上の階層に移動します。`)) return;
  folders.forEach(x => { if (x.parent === f.id) x.parent = f.parent; });
  items.forEach(i => { if (i.folder === f.id) i.folder = f.parent; });
  folders = folders.filter(x => x !== f); sel = f.parent; save(); render();
};
$("folderMove").onchange = e => {
  const v = e.target.value; if (!v || !sel) return;
  moveFolder(sel, v === "__root" ? null : v);
};

/* ---------- 描画 ---------- */
function treeHtml(parent, depth) {
  return kids(parent).map(f => {
    const has = kids(f.id).length, ids = desc(f.id);
    const cnt = items.filter(i => ids.includes(i.folder)).length;
    return `<div class="node ${sel === f.id ? "on" : ""}" data-id="${f.id}" draggable="true" style="padding-left:${8 + depth * 14}px">
      <span class="tog" data-tog="${f.id}">${has ? (f.open ? "−" : "+") : ""}</span><span class="nm">${esc(f.name)}</span><span class="cnt">${cnt}</span></div>`
      + (has && f.open ? treeHtml(f.id, depth + 1) : "");
  }).join("");
}
function renderSide() {
  $("tree").innerHTML = `<div class="node ${sel === null ? "on" : ""}" data-id=""><span class="tog"></span><span class="nm">すべて</span><span class="cnt">${items.length}</span></div>` + treeHtml(null, 0);
  $("tree").querySelectorAll(".node").forEach(n => {
    const id = n.dataset.id || null;
    n.onclick = () => { sel = id; render(); };
    const tg = n.querySelector("[data-tog]");
    if (tg) tg.onclick = e => { e.stopPropagation(); const f = fById(id); f.open = !f.open; save(); render(); };
    n.ondragstart = e => e.dataTransfer.setData("text/plain", "f:" + id);
    n.ondragover = e => { e.preventDefault(); n.classList.add("over"); };
    n.ondragleave = () => n.classList.remove("over");
    n.ondrop = e => {
      e.preventDefault(); n.classList.remove("over");
      const [t, v] = e.dataTransfer.getData("text/plain").split(":");
      if (t === "f") moveFolder(v, id); else if (t === "i") moveItem(v, id);
    };
  });
  const none = sel === null;
  $("renameF").disabled = $("delF").disabled = $("folderMove").disabled = none;
  $("folderMove").innerHTML = `<option value="">フォルダの移動先を選ぶ</option><option value="__root">最上位</option>` +
    folderOptions(none ? [] : desc(sel)).map(o => `<option value="${o.id}">${esc(o.label)}</option>`).join("");
}

function rateButtons(sel, short) {
  return R.map(r => `<button class="${r.cls} ${sel === r.k ? "on" : ""}" data-k="${r.k}">${short ? r.short : r.label}</button>`).join("");
}
function renderNew() {
  $("target").textContent = "記録先: " + (sel ? path(sel) : "最上位(フォルダなし)");
  $("newRate").innerHTML = rateButtons(newRating, false);
  $("newRate").querySelectorAll("button").forEach(b => b.onclick = () => { newRating = +b.dataset.k; renderNew(); });
}
function renderFilters() {
  const base = scoped();
  const cnt = k => k ? base.filter(i => cur(i).r === k).length : base.length;
  $("ratingFilters").innerHTML = [{k:0, short:"すべて"}, ...R]
    .map(r => `<button class="${fRating === r.k ? "on" : ""}" data-k="${r.k}">${r.short} (${cnt(r.k)})</button>`).join("");
  $("ratingFilters").querySelectorAll("button").forEach(b => b.onclick = () => { fRating = +b.dataset.k; render(); });
}
function renderChart() {
  const byDay = {};
  scoped().forEach(i => i.hist.forEach(h => {
    const d = byDay[dayKey(h.at)] ||= {n: 0, ok: 0};
    d.n++; if (h.r === 1) d.ok++;
  }));
  const days = Object.keys(byDay).sort().slice(-14);
  $("chartNote").textContent = (sel ? path(sel) : "すべて") + "・「見ずに正解」の割合";
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
  const shown = scoped().filter(i => (!fRating || cur(i).r === fRating) && (!q || i.t.toLowerCase().includes(q)))
    .sort((a, b) => nat(a.folder ? path(a.folder) : "", b.folder ? path(b.folder) : "") || nat(a.t, b.t));
  if (!shown.length) {
    $("list").innerHTML = `<div class="empty">${items.length ? "該当する項目がありません" : "まだ項目がありません。上から記録してみましょう"}</div>`;
    return;
  }
  const opts = `<option value="">移動</option><option value="__root">最上位</option>` +
    folderOptions([]).map(o => `<option value="${o.id}">${esc(o.label)}</option>`).join("");
  $("list").innerHTML = shown.map(i => `
    <div class="item" data-id="${i.id}" draggable="true">
      <div class="ihead">
        <span class="title">${esc(i.t)}</span>
        <span class="meta">${i.folder && i.folder !== sel ? esc(path(i.folder)) + "・" : ""}更新 ${fmt(cur(i).at)}</span>
      </div>
      <div class="hist">${i.hist.map(h => `<span class="mk ${R[h.r-1].cls}" title="${fmt(h.at)} ${R[h.r-1].label}">${R[h.r-1].mark}</span>`).join("")}</div>
      <div class="iact">
        <div class="row rate">${rateButtons(cur(i).r, true)}</div>
        <select class="mv">${opts}</select>
        <button class="del">削除</button>
      </div>
    </div>`).join("");
  $("list").querySelectorAll(".item").forEach(el => {
    const it = items.find(x => x.id === el.dataset.id);
    el.ondragstart = e => e.dataTransfer.setData("text/plain", "i:" + it.id);
    el.querySelector(".del").onclick = () => { if (confirm(`「${it.t}」を削除しますか?`)) { items = items.filter(x => x !== it); save(); render(); } };
    el.querySelector(".mv").onchange = e => { const v = e.target.value; if (v) moveItem(it.id, v === "__root" ? null : v); };
    el.querySelectorAll(".rate button").forEach(b => b.onclick = () => { it.hist.push({r: +b.dataset.k, at: Date.now()}); save(); render(); });
  });
}
function render() { renderSide(); renderNew(); renderFilters(); renderChart(); renderList(); }

/* ---------- 入力 ---------- */
$("addBtn").onclick = () => {
  const v = $("title").value.trim();
  if (!v) { $("title").focus(); return; }
  const names = parseRange(v) || [v], now = Date.now();
  names.forEach(t => {
    const ex = items.find(i => i.t === t && i.folder === sel);
    if (ex) ex.hist.push({r: newRating, at: now});
    else items.push({id: uid(), t, folder: sel, hist: [{r: newRating, at: now}]});
  });
  save(); $("title").value = "";
  render();
  $("status").textContent = `${names.length}件を「${R[newRating-1].short}」で記録しました`;
  $("title").focus();
};
$("title").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) $("addBtn").click(); });
$("q").addEventListener("input", renderList);

$("exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify({folders, items}, null, 2)], {type: "application/json"}));
  a.download = `study-tracker-${dayKey(Date.now())}.json`; a.click();
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async e => {
  try {
    const d = migrate(JSON.parse(await e.target.files[0].text()));
    if (!confirm("現在のデータを読み込んだ内容で置き換えますか?")) return;
    folders = d.folders; items = d.items; sel = null; save(); render();
  } catch (err) { alert("読み込めませんでした"); }
  e.target.value = "";
};

render();
