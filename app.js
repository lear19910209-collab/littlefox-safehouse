




































































































































































































































































































































































































































const state = {
letters: [],
filtered: [],
activeTag: "全部",
onlyFav: false,
currentIndex: -1,
};
const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const empty = $("#empty");
const tagBar = $("#tagBar");
const search = $("#search");
const modal = $("#modal");
const closeModal = $("#closeModal");
const xBtn = $("#xBtn");
const mTitle = $("#mTitle");
const mSub = $("#mSub");
const mBody = $("#mBody");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const favBtn = $("#favBtn");
const copyBtn = $("#copyBtn");
const toggleTheme = $("#toggleTheme");
const showFavorites = $("#showFavorites");
const FAV_KEY = "foxlion_favorites_v1";
const THEME_KEY = "foxlion_theme_v1";
function getFavSet(){
try{
const raw = localStorage.getItem(FAV_KEY);
const arr = raw ? JSON.parse(raw) : [];
return new Set(arr);
}catch{
return new Set();
}
}
function saveFavSet(set){
localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
}
function isLight(){
return document.documentElement.getAttribute("data-theme") === "light";
}
function setTheme(mode){
document.documentElement.setAttribute("data-theme", mode);
localStorage.setItem(THEME_KEY, mode);
toggleTheme.textContent = mode === "light" ? "🌙" : "☀️";
}
function initTheme(){
const saved = localStorage.getItem(THEME_KEY);
if(saved === "light" || saved === "dark"){
setTheme(saved);
return;
}
// 默认跟随系统偏好，失败则暗色
const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
setTheme(prefersLight ? "light" : "dark");
}
async function loadManifest(){
const res = await fetch("letters/manifest.json", { cache: "no-store" });
if(!res.ok) throw new Error("manifest.json 读取失败");
const data = await res.json();
// 按日期倒序
data.sort((a,b) => String(b.date).localeCompare(String(a.date)));
state.letters = data;
}
function collectTags(letters){
const set = new Set();
letters.forEach(l => (l.tags || []).forEach(t => set.add(t)));
return ["全部", ...[...set].sort((a,b)=>a.localeCompare(b))];
}
function renderTags(){
const tags = collectTags(state.letters);
tagBar.innerHTML = "";
tags.forEach(tag => {
const btn = document.createElement("button");
btn.className = "tag" + (tag === state.activeTag ? " active" : "");
btn.type = "button";
btn.textContent = tag;
btn.addEventListener("click", () => {
state.activeTag = tag;
[...tagBar.children].forEach(el => el.classList.remove("active"));
btn.classList.add("active");
applyFilters();
});
tagBar.appendChild(btn);
});
}
function makeSnippet(text, max = 80){
const t = (text || "").replace(/\s+/g, " ").trim();
if(t.length <= max) return t;
return t.slice(0, max) + "…";
}
function renderGrid(){
grid.innerHTML = "";
const favs = getFavSet();
if(state.filtered.length === 0){
empty.classList.remove("hidden");
return;
}
empty.classList.add("hidden");
state.filtered.forEach((l, idx) => {
const card = document.createElement("div");
card.className = "card";
card.tabIndex = 0;
card.setAttribute("role", "button");
card.setAttribute("aria-label", `打开信件：${l.title}`);
const star = favs.has(l.id) ? "⭐" : "☆";
const mood = l.mood || "温柔";
const tags = (l.tags || []).slice(0, 4);
card.innerHTML = `
<div class="envelope">
<div class="card-top">
<div class="badge">🦊🦁 ${mood}</div>
<div class="stars" title="收藏状态">${star}</div>
</div>
<div class="title">${escapeHtml(l.title || "未命名")}</div>
<div class="meta">
<span>📅 ${escapeHtml(l.date || "")}</span>
${l.from ? `<span>✍️ ${escapeHtml(l.from)}</span>` : ""}
</div>
<div class="snippet">${escapeHtml(l.snippet || "")}</div>
<div class="tags">
${tags.map(t => `<span class="pill">#${escapeHtml(t)}</span>`).join("")}
</div>
</div>
`;
const open = () => openLetterById(l.id);
card.addEventListener("click", open);
card.addEventListener("keydown", (e) => {
if(e.key === "Enter" || e.key === " "){
e.preventDefault();
open();
}
});
grid.appendChild(card);
});
}
function escapeHtml(str){
return String(str || "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
}
function matchesSearch(letter, q){
if(!q) return true;
const hay = [
letter.title, letter.date, letter.mood, letter.from,
(letter.tags || []).join(" "),
letter._fulltext || "",
letter.snippet || ""
].join(" ").toLowerCase();
return hay.includes(q.toLowerCase());
}
function applyFilters(){
const favs = getFavSet();
const q = search.value.trim();
state.filtered = state.letters.filter(l => {
const tagOk = state.activeTag === "全部" || (l.tags || []).includes(state.activeTag);
const favOk = !state.onlyFav || favs.has(l.id);
const qOk = matchesSearch(l, q);
return tagOk && favOk && qOk;
});
renderGrid();
}
async function preloadTextForSearch(){
// 把正文加载一份做搜索用（量大时可改成懒加载）
await Promise.all(state.letters.map(async (l) => {
try{
const res = await fetch(`letters/${l.file}`, { cache: "no-store" });
const txt = await res.text();
l._fulltext = txt;
if(!l.snippet) l.snippet = makeSnippet(txt);
}catch{
l._fulltext = "";
if(!l.snippet) l.snippet = "";
}
}));
}
function setModalOpen(open){
if(open){
modal.classList.remove("hidden");
document.body.style.overflow = "hidden";
}else{
modal.classList.add("hidden");
document.body.style.overflow = "";
}
}
function updateFavButton(letter){
const favs = getFavSet();
const isFav = favs.has(letter.id);
favBtn.textContent = isFav ? "⭐ 已收藏" : "⭐ 收藏";
}
function modalSubLine(letter){
const tags = (letter.tags || []).map(t => `#${t}`).join(" ");
const parts = [
letter.date ? `📅 ${letter.date}` : "",
letter.mood ? `🫧 ${letter.mood}` : "",
letter.from ? `✍️ ${letter.from}` : "",
tags ? `🏷️ ${tags}` : ""
].filter(Boolean);
return parts.join("  ");
}
async function openLetterById(id){
const idx = state.filtered.findIndex(l => l.id === id);
const useFiltered = idx !== -1;
const baseArr = useFiltered ? state.filtered : state.letters;
const realIdx = baseArr.findIndex(l => l.id === id);
if(realIdx === -1) return;
state.currentIndex = realIdx;
const letter = baseArr[realIdx];
mTitle.textContent = letter.title || "未命名";
mSub.textContent = modalSubLine(letter);
let txt = letter._fulltext;
if(!txt){
try{
const res = await fetch(`letters/${letter.file}`, { cache: "no-store" });
txt = await res.text();
letter._fulltext = txt;
}catch{
txt = "（这封信暂时打不开，可能是 file 名称写错了。）";
}
}
mBody.textContent = txt;
updateFavButton(letter);
setModalOpen(true);
// 记录 hash 方便分享与刷新定位
location.hash = encodeURIComponent(letter.id);
setNavButtons(baseArr);
mBody.focus();
}
function setNavButtons(arr){
prevBtn.disabled = state.currentIndex <= 0;
nextBtn.disabled = state.currentIndex >= arr.length - 1;
prevBtn.onclick = () => {
if(state.currentIndex <= 0) return;
openLetterById(arr[state.currentIndex - 1].id);
};
nextBtn.onclick = () => {
if(state.currentIndex >= arr.length - 1) return;
openLetterById(arr[state.currentIndex + 1].id);
};
favBtn.onclick = () => {
const letter = arr[state.currentIndex];
const favs = getFavSet();
if(favs.has(letter.id)) favs.delete(letter.id);
else favs.add(letter.id);
saveFavSet(favs);
updateFavButton(letter);
renderGrid();
};
copyBtn.onclick = async () => {
try{
await navigator.clipboard.writeText(mBody.textContent || "");
copyBtn.textContent = "✅";
setTimeout(()=> copyBtn.textContent = "📋", 900);
}catch{
copyBtn.textContent = "⚠️";
setTimeout(()=> copyBtn.textContent = "📋", 900);
}
};
}
function initModalClose(){
closeModal.addEventListener("click", () => {
setModalOpen(false);
location.hash = "";
});
xBtn.addEventListener("click", () => {
setModalOpen(false);
location.hash = "";
});
document.addEventListener("keydown", (e) => {
if(modal.classList.contains("hidden")) return;
if(e.key === "Escape"){
setModalOpen(false);
location.hash = "";
}
if(e.key === "ArrowLeft") prevBtn.click();
if(e.key === "ArrowRight") nextBtn.click();
});
}
function initActions(){
toggleTheme.addEventListener("click", () => {
setTheme(isLight() ? "dark" : "light");
});
showFavorites.addEventListener("click", () => {
state.onlyFav = !state.onlyFav;
showFavorites.textContent = state.onlyFav ? "⭐" : "⭐";
showFavorites.classList.toggle("active");
applyFilters();
});
search.addEventListener("input", () => applyFilters());
}
function openFromHash(){
const id = decodeURIComponent(location.hash.replace("#","") || "");
if(id) openLetterById(id);
}
async function main(){
initTheme();
initModalClose();
initActions();
await loadManifest();
await preloadTextForSearch();
renderTags();
applyFilters();
openFromHash();
}
main().catch(err => {
console.error(err);
empty.classList.remove("hidden");
empty.querySelector("h2").textContent = "信箱出错了";
empty.querySelector("p").textContent = "检查一下是否用 http 方式打开，以及 manifest.json 路径是否正确。";
});
