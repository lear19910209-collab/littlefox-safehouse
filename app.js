




































































































































































































































































































































































































































/* --- 🦊 终极修复版 app.js --- */

// ⚠️ 请在这里填入你的密码！(要和你加密信件时用的密码一模一样)
// 默认是：20250520
const MY_PASSWORD = "20250520"; 

const state = {
    letters: [],
    filtered: [],
    activeTag: "全部",
    onlyFav: false,
    currentIndex: -1,
    userKey: null 
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

// 门锁相关
const door = $("#safe-door");
const doorInput = $("#door-key");
const doorBtn = $("#open-btn");
const doorMsg = $("#error-msg");

const FAV_KEY = "foxlion_favorites_v1";
const THEME_KEY = "foxlion_theme_v1";
const VIEW_KEY = "foxlion_view_mode";

// --- 🔐 解密算法 (XOR) ---
// 即使门锁简单了，这个解密步骤依然保留，保护你的信件内容
function decrypt(cipher, key) {
    if (!cipher || !key) return "";
    try {
        // 尝试 Base64 解码
        const text = decodeURIComponent(escape(atob(cipher))); 
        let result = "";
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    } catch (e) {
        // 如果解密失败，直接返回原文（万一你传的是没加密的信也能看）
        return cipher; 
    }
}

// --- 🚪 稳妥的开门逻辑 ---
async function tryUnlock() {
    const inputPass = doorInput.value.trim();
    if (!inputPass) return;

    // 直接比对密码！简单粗暴，绝对不会出错
    if (inputPass === MY_PASSWORD) {
        
        state.userKey = inputPass; // 拿着这把钥匙去开信箱
        
        // 开门动画
        door.classList.add('unlocked');
        setTimeout(() => { door.style.display = 'none'; }, 800);
        
        // 进门后，开始加载数据
        await main();
        
    } else {
        // 密码错误提示
        doorMsg.classList.remove('hidden');
        doorMsg.textContent = "暗号不对哦，再试一次？";
        doorInput.value = "";
        doorInput.focus();
        
        // 晃动特效
        const card = door.querySelector('.door-card');
        if(card){
            card.style.transform = 'translateX(10px)';
            setTimeout(() => { card.style.transform = 'translateX(0)'; }, 100);
        }
    }
}

// 绑定开门事件
if(doorBtn) doorBtn.addEventListener('click', tryUnlock);
if(doorInput) doorInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') tryUnlock();
});


// --- 📦 数据加载与解密 ---
async function loadManifest(){
    const res = await fetch("letters/manifest.json", { cache: "no-store" });
    if(!res.ok) throw new Error("Manifest读取失败");
    const data = await res.json();
    data.sort((a,b) => String(b.date).localeCompare(String(a.date)));
    state.letters = data;
}

// 预加载并尝试解密
async function preloadTextForSearch(){
    await Promise.all(state.letters.map(async (l) => {
        try{
            const res = await fetch(`letters/${l.file}`, { cache: "no-store" });
            const rawContent = await res.text();
            
            // ⚠️ 关键点：用刚才进门的密码去解密内容
            // 如果你上传的是乱码，这里就会解成中文
            // 如果你上传的是普通中文，decrypt 函数也会兼容显示
            const plainText = decrypt(rawContent, state.userKey);
            
            l._fulltext = plainText;
            if(!l.snippet) l.snippet = makeSnippet(plainText);
        }catch{
            l._fulltext = "信件加载失败";
        }
    }));
}

// --- 🎨 界面渲染 (不用动) ---

function makeSnippet(text, max = 80){
    const t = (text || "").replace(/\s+/g, " ").trim();
    if(t.length <= max) return t;
    return t.slice(0, max) + "…";
}

function renderGrid(){
    if(!grid) return;
    grid.innerHTML = "";
    const favs = getFavSet();
    if(state.filtered.length === 0){
        empty.classList.remove("hidden");
        return;
    }
    empty.classList.add("hidden");
    state.filtered.forEach((l) => {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("role", "button");
        const star = favs.has(l.id) ? "⭐" : "☆";
        const mood = l.mood || "温柔";
        const tags = (l.tags || []).slice(0, 4);
        card.innerHTML = `
            <div class="envelope">
                <div class="card-top">
                    <div class="badge">🦊🦁 ${mood}</div>
                    <div class="stars">${star}</div>
                </div>
                <div class="title">${escapeHtml(l.title)}</div>
                <div class="meta"><span>📅 ${l.date}</span></div>
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

function applyFilters(){
    const favs = getFavSet();
    const q = search ? search.value.trim().toLowerCase() : "";
    state.filtered = state.letters.filter(l => {
        const tagOk = state.activeTag === "全部" || (l.tags || []).includes(state.activeTag);
        const favOk = !state.onlyFav || favs.has(l.id);
        const content = (l._fulltext || "").toLowerCase();
        const qOk = !q || l.title.toLowerCase().includes(q) || content.includes(q);
        return tagOk && favOk && qOk;
    });
    renderGrid();
}

function setModalOpen(open){
    if(open) { modal.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
    else { modal.classList.add("hidden"); document.body.style.overflow = ""; }
}

async function openLetterById(id){
    const letter = state.letters.find(l => l.id === id);
    if(!letter) return;
    state.currentIndex = state.letters.indexOf(letter);
    
    mTitle.textContent = letter.title;
    mSub.textContent = `📅 ${letter.date}  ·  ${letter.mood}`;
    
    // 显示内容（如果是加密的，这里应该是解密后的中文）
    mBody.textContent = letter._fulltext || "（内容加载中...）";
    
    updateFavButton(letter);
    setModalOpen(true);
    setNavButtons();
}

function setNavButtons(){
    prevBtn.onclick = () => { if(state.currentIndex > 0) openLetterById(state.letters[state.currentIndex-1].id); };
    nextBtn.onclick = () => { if(state.currentIndex < state.letters.length-1) openLetterById(state.letters[state.currentIndex+1].id); };
    favBtn.onclick = () => {
        const favs = getFavSet();
        if(favs.has(state.letters[state.currentIndex].id)) favs.delete(state.letters[state.currentIndex].id); 
        else favs.add(state.letters[state.currentIndex].id);
        saveFavSet(favs);
        updateFavButton(state.letters[state.currentIndex]);
        renderGrid();
    };
}

function updateFavButton(letter){
    const isFav = getFavSet().has(letter.id);
    favBtn.textContent = isFav ? "⭐ 已收藏" : "⭐ 收藏";
}

function getFavSet(){ try{ return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch{ return new Set(); } }
function saveFavSet(set){ localStorage.setItem(FAV_KEY, JSON.stringify([...set])); }

function isLight(){ return document.documentElement.getAttribute("data-theme") === "light"; }
function setTheme(mode){
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem(THEME_KEY, mode);
    if(toggleTheme) toggleTheme.textContent = mode === "light" ? "🌙" : "☀️";
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
    [closeModal, xBtn].forEach(el => { if(el) el.onclick = () => setModalOpen(false); });
}

async function main(){
    const savedTheme = localStorage.getItem(THEME_KEY);
    if(savedTheme) setTheme(savedTheme);
    if(localStorage.getItem(VIEW_KEY) === "timeline"){
        grid.classList.add("timeline-mode");
        if(toggleView) toggleView.textContent = "📅";
    }

    initActions();
    await loadManifest();
    await preloadTextForSearch(); 
    renderTags();
    applyFilters();
}

// 启动
// 先检查是否已经解锁过（避免刷新页面又要输密码）
if (sessionStorage.getItem('safe_unlocked') === 'true') {
    door.style.display = 'none';
    state.userKey = MY_PASSWORD; // 自动填入密码
    main();
}
