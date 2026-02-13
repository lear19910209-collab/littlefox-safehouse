




































































































































































































































































































































































































































/* --- 🦊 最终修复版：密码门 + 加密信件 --- */

const state = {
    letters: [],
    filtered: [],
    activeTag: "全部",
    onlyFav: false,
    currentIndex: -1,
    userKey: null // 👈 这里用来存你的钥匙
};

// 快捷选择器
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
const toggleView = $("#toggleView");
const showFavorites = $("#showFavorites");

const FAV_KEY = "foxlion_favorites_v1";
const THEME_KEY = "foxlion_theme_v1";
const VIEW_KEY = "foxlion_view_mode";

// --- 🔐 解密核心函数 (加回来的部分) ---
function decrypt(cipher, key) {
    if (!cipher || !key) return cipher; // 如果没密码，直接返回原文
    try {
        // Base64 解码 + 异或解密
        const text = decodeURIComponent(escape(atob(cipher)));
        let result = "";
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    } catch (e) {
        // 如果解密失败（比如你传的是普通中文信），就直接显示原文，不报错
        return cipher;
    }
}

// --- 📦 基础功能 ---

function getFavSet(){
    try{ return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); }
    catch{ return new Set(); }
}
function saveFavSet(set){ localStorage.setItem(FAV_KEY, JSON.stringify([...set])); }

function isLight(){ return document.documentElement.getAttribute("data-theme") === "light"; }
function setTheme(mode){
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem(THEME_KEY, mode);
    if(toggleTheme) toggleTheme.textContent = mode === "light" ? "🌙" : "☀️";
}

function initTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if(saved === "light" || saved === "dark"){ setTheme(saved); return; }
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(prefersLight ? "light" : "dark");
}

async function loadManifest(){
    const res = await fetch("letters/manifest.json", { cache: "no-store" });
    if(!res.ok) throw new Error("manifest.json 读取失败");
    const data = await res.json();
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
    if(!tagBar) return;
    tagBar.innerHTML = "";
    tags.forEach(tag => {
        const btn = document.createElement("button");
        btn.className = "tag" + (tag === state.activeTag ? " active" : "");
        btn.textContent = tag;
        btn.onclick = () => {
            state.activeTag = tag;
            [...tagBar.children].forEach(el => el.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
        tagBar.appendChild(btn);
    });
}

function makeSnippet(text, max = 80){
    const t = (text || "").replace(/\s+/g, " ").trim();
    if(t.length <= max) return t;
    return t.slice(0, max) + "…";
}

function renderGrid(){
    if(!grid) return;
    grid.innerHTML = "";
    const favs = getFavSet();
    if(state.filtered.length === 0){ empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");
    state.filtered.forEach((l) => {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("aria-label", `打开信件：${l.title}`);
        const star = favs.has(l.id) ? "⭐" : "☆";
        const mood = l.mood || "温柔";
        const tags = (l.tags || []).slice(0, 4);
        
        // 👇 重点修改了下面 innerHTML 的部分
        card.innerHTML = `
            <div class="envelope">
                <div class="card-top">
                    <div class="badge">🦊🦁 ${mood}</div>
                    <div class="stars" title="收藏状态">${star}</div>
                </div>
                <div class="title">${escapeHtml(l.title)}</div>
                
                <div class="meta">
                    <span>📅 ${l.date}</span>
                    ${l.from ? `<span style="margin-left: 8px;">✍️ ${escapeHtml(l.from)}</span>` : ""}
                </div>
                
                <div class="snippet">${escapeHtml(l.snippet)}</div>
                <div class="tags">${tags.map(t => `<span class="pill">#${t}</span>`).join("")}</div>
            </div>
        `;
        
        card.onclick = () => openLetterById(l.id);
        grid.appendChild(card);
    });
}

function escapeHtml(str){
    return String(str || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
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
    const q = search.value.trim().toLowerCase();
    state.filtered = state.letters.filter(l => {
        const tagOk = state.activeTag === "全部" || (l.tags || []).includes(state.activeTag);
        const favOk = !state.onlyFav || favs.has(l.id);
        const qOk = matchesSearch(l, q);
        return tagOk && favOk && qOk;
    });
    renderGrid();
}

// ⚠️ 修改：读取信件时，尝试解密
async function preloadTextForSearch(){
    await Promise.all(state.letters.map(async (l) => {
        try{
            const res = await fetch(`letters/${l.file}`, { cache: "no-store" });
            const rawTxt = await res.text();
            
            // 用你进门时的密码解密
            const plainTxt = decrypt(rawTxt, state.userKey);
            
            l._fulltext = plainTxt;
            if(!l.snippet) l.snippet = makeSnippet(plainTxt);
        }catch{
            l._fulltext = "加载失败";
        }
    }));
}

function setModalOpen(open){
    if(open){ modal.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
    else{ modal.classList.add("hidden"); document.body.style.overflow = ""; }
}

function updateFavButton(letter){
    const favs = getFavSet();
    favBtn.textContent = favs.has(letter.id) ? "⭐ 已收藏" : "⭐ 收藏";
}

function modalSubLine(letter){
    const tags = (letter.tags || []).map(t => `#${t}`).join(" ");
    return [
        letter.date ? `📅 ${letter.date}` : "",
        letter.mood ? `🫧 ${letter.mood}` : "",
        letter.from ? `✍️ ${letter.from}` : "",
        tags ? `🏷️ ${tags}` : ""
    ].filter(Boolean).join("  ");
}

// ⚠️ 修改：打开弹窗时，确保显示解密内容
async function openLetterById(id){
    const letter = state.letters.find(l => l.id === id);
    if(!letter) return;
    state.currentIndex = state.letters.indexOf(letter);
    
    mTitle.textContent = letter.title || "未命名";
    mSub.textContent = modalSubLine(letter);
    
    // 如果之前还没加载内容，现在加载并解密
    if(!letter._fulltext){
        try{
            const res = await fetch(`letters/${letter.file}`, { cache: "no-store" });
            const rawTxt = await res.text();
            letter._fulltext = decrypt(rawTxt, state.userKey);
        }catch{
            letter._fulltext = "加载失败";
        }
    }
    
    mBody.textContent = letter._fulltext;
    updateFavButton(letter);
    setModalOpen(true);
    location.hash = encodeURIComponent(letter.id);
    setNavButtons();
    mBody.focus();
}

function setNavButtons(){
    prevBtn.onclick = () => { if(state.currentIndex > 0) openLetterById(state.letters[state.currentIndex-1].id); };
    nextBtn.onclick = () => { if(state.currentIndex < state.letters.length-1) openLetterById(state.letters[state.currentIndex+1].id); };
    favBtn.onclick = () => {
        const letter = state.letters[state.currentIndex];
        const favs = getFavSet();
        if(favs.has(letter.id)) favs.delete(letter.id); else favs.add(letter.id);
        saveFavSet(favs);
        updateFavButton(letter);
        renderGrid();
    };
    if(copyBtn) copyBtn.onclick = async () => {
        try{ await navigator.clipboard.writeText(mBody.textContent); copyBtn.textContent = "✅"; setTimeout(()=>copyBtn.textContent="📋",900); }
        catch{ copyBtn.textContent = "⚠️"; }
    };
}

function initModalClose(){
    [closeModal, xBtn].forEach(el => el && (el.onclick = () => { setModalOpen(false); location.hash = ""; }));
    document.addEventListener("keydown", (e) => {
        if(modal.classList.contains("hidden")) return;
        if(e.key === "Escape") { setModalOpen(false); location.hash = ""; }
        if(e.key === "ArrowLeft") prevBtn.click();
        if(e.key === "ArrowRight") nextBtn.click();
    });
}

function initActions(){
    if(toggleTheme) toggleTheme.onclick = () => setTheme(isLight() ? "dark" : "light");
    if(showFavorites) showFavorites.onclick = () => {
        state.onlyFav = !state.onlyFav;
        showFavorites.classList.toggle("active");
        applyFilters();
    };
    if(toggleView) toggleView.onclick = () => {
        grid.classList.toggle("timeline-mode");
        const isTimeline = grid.classList.contains("timeline-mode");
        toggleView.textContent = isTimeline ? "📅" : "🌌";
        localStorage.setItem(VIEW_KEY, isTimeline ? "timeline" : "grid");
    };
    if(search) search.oninput = applyFilters;
}

function openFromHash(){
    const id = decodeURIComponent(location.hash.replace("#","") || "");
    if(id) openLetterById(id);
}

async function main(){
    initTheme();
    initModalClose();
    initActions();
    if(localStorage.getItem(VIEW_KEY) === "timeline"){
        grid.classList.add("timeline-mode");
        if(toggleView) toggleView.textContent = "📅";
    }
    await loadManifest();
    await preloadTextForSearch();
    renderTags();
    applyFilters();
    openFromHash();
}

/* --- 🔐 密码门逻辑 (不动，但连接了解密功能) --- */
(function initDoor() {
    const door = document.getElementById('safe-door');
    const input = document.getElementById('door-key');
    const btn = document.getElementById('open-btn');
    const msg = document.getElementById('error-msg');

    // 🔑 你的密码
    const SECRET_KEY = "19960810"; 

    // 如果之前已经输过密码了，自动恢复
    if (sessionStorage.getItem('safe_unlocked') === 'true') {
        door.style.display = 'none';
        state.userKey = SECRET_KEY; // ⚡ 自动拿钥匙
        main();
        return;
    }

    function checkPassword() {
        if (input.value === SECRET_KEY) {
            // ⚡ 密码正确：先把钥匙存好，等会儿用来解密
            state.userKey = input.value;
            
            door.classList.add('unlocked');
            sessionStorage.setItem('safe_unlocked', 'true');
            
            setTimeout(() => {
                door.style.display = 'none';
            }, 800);
            
            // 进门加载
            main();
        } else {
            msg.classList.remove('hidden');
            input.value = "";
            input.focus();
            door.querySelector('.door-card').style.transform = 'translateX(10px)';
            setTimeout(() => { door.querySelector('.door-card').style.transform = 'translateX(0)'; }, 100);
        }
    }

    if(btn) btn.addEventListener('click', checkPassword);
    if(input) input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkPassword();
    });
})();
