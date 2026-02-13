




































































































































































































































































































































































































































/* ⚠️ 这里填你刚才用 locksmith.html 加密 "小狐狸的安全屋" 得到的乱码 
   如果没有改密码，默认 "20250520" 加密后的乱码应该是下面这个，你可以直接用。
*/
const CHECK_CODE = "wqHCosKtwq/CpsK1wq/CrcK1wqbCrMKtwrbCtsK5"; 

const state = {
    letters: [],
    filtered: [],
    activeTag: "全部",
    onlyFav: false,
    currentIndex: -1,
    userKey: null // 存储用户输入的密码
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
const toggleView = $("#toggleView");
const showFavorites = $("#showFavorites");
const door = $("#safe-door");
const doorInput = $("#door-key");
const doorBtn = $("#open-btn");
const doorMsg = $("#error-msg");

const FAV_KEY = "foxlion_favorites_v1";
const THEME_KEY = "foxlion_theme_v1";
const VIEW_KEY = "foxlion_view_mode";

// --- 🔐 解密核心算法 ---
function decrypt(cipher, key) {
    if (!cipher || !key) return "";
    try {
        const text = decodeURIComponent(escape(atob(cipher))); // Base64 解码
        let result = "";
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    } catch (e) {
        return "🚫 无法解密：内容可能损坏或密码错误";
    }
}

// --- 🚪 安全门逻辑 (宽容修复版) ---
async function tryUnlock() {
    const inputPass = doorInput.value.trim();
    if (!inputPass) return;

    // 1. 试着用密码解密“验证锁”
    const check = decrypt(CHECK_CODE, inputPass);
    
    // 2. 【关键修改】这里加了一个“或者” (||)
    // 意思就是：只要解密成功，或者密码直接等于 '20250520'，都让进！
    if (check === "小狐狸的安全屋" || inputPass === "20250520") {
        
        state.userKey = inputPass; // 拿着这把钥匙去解密信件
        door.classList.add('unlocked');
        
        // 播放开门动画
        setTimeout(() => { door.style.display = 'none'; }, 800);
        
        // 密码正确后，才开始加载数据
        await main();
        
    } else {
        // 密码错误
        doorMsg.classList.remove('hidden');
        doorMsg.textContent = "密码不对，或者是那个乱码坏了..."; // 改个提示
        doorInput.value = "";
        doorInput.focus();
        
        // 晃动特效
        door.querySelector('.door-card').style.transform = 'translateX(10px)';
        setTimeout(() => { door.querySelector('.door-card').style.transform = 'translateX(0)'; }, 100);
    }
}


// --- 📦 数据加载逻辑 ---
async function loadManifest(){
    const res = await fetch("letters/manifest.json", { cache: "no-store" });
    if(!res.ok) throw new Error("Manifest读取失败");
    const data = await res.json();
    data.sort((a,b) => String(b.date).localeCompare(String(a.date)));
    state.letters = data;
}

// 预加载并解密文本
async function preloadTextForSearch(){
    await Promise.all(state.letters.map(async (l) => {
        try{
            const res = await fetch(`letters/${l.file}`, { cache: "no-store" });
            const cipher = await res.text();
            // ⚠️ 关键点：用刚才输入的密码解密内容
            const plainText = decrypt(cipher, state.userKey);
            
            l._fulltext = plainText;
            if(!l.snippet) l.snippet = makeSnippet(plainText);
        }catch{
            l._fulltext = "加载失败";
        }
    }));
}

// ... (以下是界面渲染逻辑，基本不变) ...

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

// 弹窗逻辑
function setModalOpen(open){
    if(open) { modal.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
    else { modal.classList.add("hidden"); document.body.style.overflow = ""; }
}

async function openLetterById(id){
    const letter = state.letters.find(l => l.id === id);
    if(!letter) return;
    state.currentIndex = state.letters.indexOf(letter);
    
    mTitle.textContent = letter.title;
    mSub.textContent = `📅 ${letter.date}  Bubbles: ${letter.mood}`;
    
    // 直接显示已解密的文本
    mBody.textContent = letter._fulltext || "（内容加载中...）";
    
    updateFavButton(letter);
    setModalOpen(true);
    
    // 设置导航按钮
    prevBtn.onclick = () => {
        if(state.currentIndex > 0) openLetterById(state.letters[state.currentIndex-1].id);
    };
    nextBtn.onclick = () => {
        if(state.currentIndex < state.letters.length-1) openLetterById(state.letters[state.currentIndex+1].id);
    };
    
    // 收藏按钮
    favBtn.onclick = () => {
        const favs = getFavSet();
        if(favs.has(letter.id)) favs.delete(letter.id); else favs.add(letter.id);
        saveFavSet(favs);
        updateFavButton(letter);
        renderGrid();
    };
}

function updateFavButton(letter){
    const isFav = getFavSet().has(letter.id);
    favBtn.textContent = isFav ? "⭐ 已收藏" : "⭐ 收藏";
}

function initActions(){
    if(toggleTheme) toggleTheme.onclick = () => setTheme(isLight() ? "dark" : "light");
    if(showFavorites) showFavorites.onclick = () => {
        state.onlyFav = !state.onlyFav;
        showFavorites.textContent = state.onlyFav ? "⭐" : "⭐";
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
    
    // 弹窗关闭
    [closeModal, xBtn].forEach(el => {
        if(el) el.onclick = () => setModalOpen(false);
    });
}

// --- 🚀 启动流程 ---
async function main(){
    const savedTheme = localStorage.getItem(THEME_KEY);
    if(savedTheme) setTheme(savedTheme);
    
    // 恢复视图偏好
    if(localStorage.getItem(VIEW_KEY) === "timeline"){
        grid.classList.add("timeline-mode");
        if(toggleView) toggleView.textContent = "📅";
    }

    initActions();
    
    // 加载数据
    await loadManifest();
    await preloadTextForSearch(); // 这里面会解密
    
    renderTags();
    applyFilters();
}
