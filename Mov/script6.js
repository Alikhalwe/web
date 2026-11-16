/* ============================================================
   CRYSTAL PRO - script5.js
   - DOM-based card builder (XSS-safe)
   - Debounced + Abortable search
   - Lazy image loading
   - Fixed hero backdrop
   - Targeted favorite refresh (no full reload)
   ============================================================ */

const TMDB_API_KEY = "ef74cc8c3cb7f6100ffe47b9d59feada";
const BASE = "https://api.themoviedb.org/3";
const VIDFAST_BASE_URL = "https://vidfast.vc";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342";
const IMAGE_BASE_URL_LARGE = "https://image.tmdb.org/t/p/w500";
const IMAGE_BASE_URL_ORIGINAL = "https://image.tmdb.org/t/p/original";
const PLACEHOLDER = "https://placehold.co/342x513/12121e/8fa0bc?text=No+Image";

let currentResults = [];
let favorites = JSON.parse(localStorage.getItem("neon_favorites")) || [];
let activeItem = null;
let currentAbort = null;
let searchDebounceTimer = null;

/* ---------- Fetch wrapper with abort + skeleton ---------- */
async function api(url, containerId, signal) {
    const container = containerId ? document.getElementById(containerId) : null;
    if (container) showSkeletons(container, 6);
    try {
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.results) data.results = [];
        if (!data.episodes) data.episodes = [];
        return data;
    } catch (e) {
        if (e.name === "AbortError") return { aborted: true, results: [], episodes: [] };
        console.error("خطأ في جلب البيانات:", e.message);
        if (container) container.innerHTML = "<p class='error-msg'>عذراً، فشل تحميل البيانات. تحقق من الاتصال.</p>";
        return { error: true, results: [], episodes: [] };
    }
}

function showSkeletons(container, count) {
    if (!container) return;
    container.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const div = document.createElement("div");
        div.className = "skeleton-card";
        const img = document.createElement("div");
        img.className = "skeleton-img mb-10";
        const t1 = document.createElement("div");
        t1.className = "skeleton-text";
        const t2 = document.createElement("div");
        t2.className = "skeleton-text short";
        div.appendChild(img);
        div.appendChild(t1);
        div.appendChild(t2);
        frag.appendChild(div);
    }
    container.appendChild(frag);
}

/* ---------- Card builder (DOM, no innerHTML with data) ---------- */
function createCard(item, onCardClick) {
    const title = item.title || item.name || "بدون عنوان";
    const poster = item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : PLACEHOLDER;
    const isFav = favorites.some(x => x.id === item.id && x.media_type === item.media_type);
    const mediaTypeLabel = item.media_type === 'tv' ? 'مسلسل' : 'فيلم';

    const el = document.createElement("div");
    el.className = "card";
    el._mediaId = item.id;
    el._mediaType = item.media_type;

    const img = document.createElement("img");
    img.src = poster;
    img.alt = title;
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = () => { img.src = PLACEHOLDER; img.onerror = null; };
    el.appendChild(img);

    const favBtn = document.createElement("button");
    favBtn.className = "fav-card-icon" + (isFav ? " active" : "");
    favBtn.type = "button";
    favBtn.textContent = "❤️";
    favBtn.setAttribute("aria-label", "إضافة للمفضلة");
    favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(item);
    });
    el.appendChild(favBtn);

    const info = document.createElement("div");
    info.className = "info";
    const h3 = document.createElement("h3");
    h3.textContent = title;
    h3.title = title;
    const rate = document.createElement("div");
    rate.className = "rate";
    rate.textContent = `⭐ ${item.vote_average ? item.vote_average.toFixed(1) : '-'}`;
    const typeDiv = document.createElement("div");
    typeDiv.className = "rate";
    typeDiv.textContent = `النوع: ${mediaTypeLabel}`;
    info.appendChild(h3);
    info.appendChild(rate);
    info.appendChild(typeDiv);
    el.appendChild(info);

    el.addEventListener("click", () => {
        if (onCardClick) onCardClick(item);
        else details(item);
    });
    return el;
}

function renderCards(container, items, onCardClick) {
    if (!container) return;
    container.innerHTML = "";
    const frag = document.createDocumentFragment();
    items.forEach(item => frag.appendChild(createCard(item, onCardClick)));
    container.appendChild(frag);
}

/* ---------- Search results (inline info-box) ---------- */
function displayResults(results) {
    currentResults = results;
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;

    const items = (results || []).filter(i =>
        (i.media_type === 'movie' || i.media_type === 'tv') && i.poster_path
    );

    if (items.length === 0) {
        resultsContainer.innerHTML = '<p>لم يتم العثور على نتائج. تأكد من صحة الاسم.</p>';
        return;
    }
    renderCards(resultsContainer, items, (item) => showAndPlay(item));
}

function showAndPlay(item) {
    if (!item) return;
    activeItem = item;
    const type = item.media_type;
    const title = item.title || item.name;
    const posterUrl = item.poster_path ? `${IMAGE_BASE_URL_LARGE}${item.poster_path}` : PLACEHOLDER;
    const date = item.release_date || item.first_air_date || 'غير متوفر';
    const overview = item.overview || 'لا يوجد وصف متاح لهذا العمل باللغة العربية حالياً.';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '0.0';

    document.getElementById('detail-title').textContent = title;
    const detailPoster = document.getElementById('detail-poster');
    detailPoster.src = posterUrl;
    detailPoster.onerror = () => { detailPoster.src = PLACEHOLDER; detailPoster.onerror = null; };
    const detailId = document.getElementById('detail-id');
    if (detailId) detailId.textContent = `${type === 'tv' ? 'رقم المسلسل' : 'رقم الفيلم'}: ${item.id}`;
    document.getElementById('detail-date').textContent = `تاريخ الإصدار: ${date}`;
    document.getElementById('detail-rating').textContent = rating;
    document.getElementById('detail-overview').textContent = overview;
    document.getElementById('info-box').style.display = 'block';

    updateFavButtons();

    const playerWrap = document.getElementById('player-wrap');
    const iframe = document.getElementById('vidfast-player');
    iframe.src = type === 'movie'
        ? `${VIDFAST_BASE_URL}/movie/${item.id}`
        : `${VIDFAST_BASE_URL}/tv/${item.id}/1/1`;
    playerWrap.style.display = 'block';
    document.getElementById('info-box').scrollIntoView({ behavior: 'smooth' });
}

/* ---------- Filters ---------- */
function filterMediaType(type, button) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (button) button.classList.add('active');
    document.querySelectorAll('.layout-group').forEach(sec => {
        const show = type === 'all' || sec.getAttribute('data-type') === type;
        sec.style.display = show ? 'block' : 'none';
    });
}

/* ---------- Favorites (targeted refresh) ---------- */
function loadFavorites() { renderFavorites(); }

function renderFavorites() {
    const favListContainer = document.getElementById("favoritesList");
    const favSection = document.getElementById("favorites-section");
    if (!favListContainer || !favSection) return;
    if (favorites.length === 0) {
        favSection.style.display = "none";
        favListContainer.innerHTML = "";
        return;
    }
    favSection.style.display = "block";
    renderCards(favListContainer, favorites);
}

function toggleFavorite(item) {
    if (!item) return;
    const idx = favorites.findIndex(x => x.id === item.id && x.media_type === item.media_type);
    if (idx === -1) favorites.push(item);
    else favorites.splice(idx, 1);
    try { localStorage.setItem("neon_favorites", JSON.stringify(favorites)); } catch (e) {}

    refreshAllHeartIcons();
    renderFavorites();
    updateFavButtons();
}

function refreshAllHeartIcons() {
    document.querySelectorAll(".card").forEach(card => {
        const btn = card.querySelector(".fav-card-icon");
        if (!btn) return;
        const isFav = favorites.some(x => x.id === card._mediaId && x.media_type === card._mediaType);
        btn.classList.toggle("active", isFav);
    });
}

function updateFavButtons() {
    if (!activeItem) return;
    const isFav = favorites.some(x => x.id === activeItem.id && x.media_type === activeItem.media_type);
    const text = isFav ? "❤️ احذف من المفضلة" : "🤍 أضف للمفضلة";
    const directBtn = document.getElementById("fav-btn-direct");
    const modalBtn = document.getElementById("modal-fav-btn");
    if (directBtn) directBtn.textContent = text;
    if (modalBtn) modalBtn.textContent = text;
}

/* ---------- Sections ---------- */
async function loadTrending() {
    const data = await api(`${BASE}/trending/all/week?api_key=${TMDB_API_KEY}&language=ar-SA`, "trending");
    const items = data.results.filter(i => i.poster_path && (i.media_type === 'movie' || i.media_type === 'tv'));
    renderCards(document.getElementById("trending"), items);

    const hero = data.results.find(i => i.backdrop_path);
    if (hero) {
        const heroEl = document.getElementById("hero");
        heroEl.style.backgroundImage =
            `linear-gradient(to top, rgba(10,10,15,0.95), rgba(10,10,15,0.35)), url(${IMAGE_BASE_URL_ORIGINAL}${hero.backdrop_path})`;
        document.getElementById("heroTitle").textContent = hero.title || hero.name;
        document.getElementById("heroText").textContent =
            (hero.overview || "استكشف أحدث الأفلام والمسلسلات بجودة عالية.").substring(0, 220) + "...";
        heroEl.onclick = () => { activeItem = hero; details(hero); };
    }
}

async function loadMovies() {
    const data = await api(`${BASE}/movie/now_playing?api_key=${TMDB_API_KEY}&language=ar-SA`, "movieList");
    const items = data.results.filter(i => i.poster_path).map(i => ({ ...i, media_type: "movie" }));
    renderCards(document.getElementById("movieList"), items);
}

async function loadTV() {
    const data = await api(`${BASE}/tv/popular?api_key=${TMDB_API_KEY}&language=ar-SA`, "tvList");
    const items = data.results.filter(i => i.poster_path).map(i => ({ ...i, media_type: "tv" }));
    renderCards(document.getElementById("tvList"), items);
}

async function loadTop() {
    const data = await api(`${BASE}/movie/top_rated?api_key=${TMDB_API_KEY}&language=ar-SA`, "topList");
    const items = data.results.filter(i => i.poster_path).map(i => ({ ...i, media_type: "movie" }));
    renderCards(document.getElementById("topList"), items);
}

/* ---------- Search (debounced + abortable) ---------- */
async function searchMovies() {
    const value = document.getElementById("search").value.trim();
    if (!value) return;
    if (currentAbort) currentAbort.abort();
    currentAbort = new AbortController();
    showSkeletons(document.getElementById('results'), 4);
    const data = await api(
        `${BASE}/search/multi?api_key=${TMDB_API_KEY}&language=ar-SA&query=${encodeURIComponent(value)}`,
        null,
        currentAbort.signal
    );
    if (data.aborted) return;
    if (data.error) {
        document.getElementById('results').innerHTML = "<p class='error-msg'>فشل البحث. تحقق من الاتصال.</p>";
        return;
    }
    displayResults(data.results);
    window.scrollTo({ top: 450, behavior: "smooth" });
}

function debounceSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(searchMovies, 300);
}

/* ---------- Modal details ---------- */
async function details(item) {
    if (!item) return;
    activeItem = item;
    const type = item.media_type === "tv" || item.name ? "tv" : "movie";
    if (!activeItem.media_type) activeItem.media_type = type;

    document.getElementById("modal").style.display = "flex";
    const posterEl = document.getElementById("modalPoster");
    posterEl.src = item.poster_path ? IMAGE_BASE_URL_LARGE + item.poster_path : PLACEHOLDER;
    posterEl.onerror = () => { posterEl.src = PLACEHOLDER; posterEl.onerror = null; };
    document.getElementById("modalTitle").textContent = item.title || item.name;
    const modalId = document.getElementById("modal-id");
    if (modalId) modalId.textContent = `${type === "tv" ? "رقم المسلسل" : "رقم الفيلم"}: ${item.id}`;
    document.getElementById("modalOverview").textContent = item.overview || "لا يوجد وصف متوفر";
    document.getElementById("modalRate").textContent = item.vote_average ? item.vote_average.toFixed(1) : "-";
    document.getElementById("modalDate").textContent = item.release_date || item.first_air_date || "-";

    const modalIframe = document.getElementById("modal-vidfast-player");
    const controls = document.getElementById("series-controls");
    updateFavButtons();

    if (type === "movie") {
        if (controls) controls.style.display = "none";
        modalIframe.src = `${VIDFAST_BASE_URL}/movie/${item.id}?autoplay=true&autoNext=true&muted=1&sub=ar`;
    } else {
        if (controls) controls.style.display = "flex";
        modalIframe.src = `${VIDFAST_BASE_URL}/tv/${item.id}/1/1`;
        setupModalSeriesControls(item.id);
    }

    const trailerContainer = document.getElementById("trailer");
    trailerContainer.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8fa0bc;font-size:13px;">جاري تحميل الإعلان...</div>';

    const videos = await api(`${BASE}/${type}/${item.id}/videos?api_key=${TMDB_API_KEY}&language=en-US`);
    const trailer = (videos.results || []).find(v => v.type === "Trailer" && v.site === "YouTube");
    if (trailer) {
        trailerContainer.innerHTML = "";
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube.com/embed/${trailer.key}`;
        iframe.allowFullscreen = true;
        iframe.loading = "lazy";
        trailerContainer.appendChild(iframe);
    } else {
        trailerContainer.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8fa0bc;font-size:13px;">لا يوجد إعلان ترويجي متوفر لهذا العمل.</div>';
    }
}

async function setupModalSeriesControls(tvId) {
    const tvDetails = await api(`${BASE}/tv/${tvId}?api_key=${TMDB_API_KEY}&language=ar-SA`);
    const seasonSelect = document.getElementById("season-select");
    if (!seasonSelect) return;
    seasonSelect.innerHTML = "";
    const seasons = tvDetails.number_of_seasons || 1;
    for (let s = 1; s <= seasons; s++) {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = `الموسم ${s}`;
        seasonSelect.appendChild(opt);
    }
    seasonSelect.onchange = () => updateModalEpisodesList(tvId, seasonSelect.value);
    updateModalEpisodesList(tvId, 1);
}

async function updateModalEpisodesList(tvId, seasonNum) {
    const episodeSelect = document.getElementById("episode-select");
    if (!episodeSelect) return;
    const seasonData = await api(`${BASE}/tv/${tvId}/season/${seasonNum}?api_key=${TMDB_API_KEY}&language=ar-SA`);
    episodeSelect.innerHTML = "";
    (seasonData.episodes || []).forEach(ep => {
        const opt = document.createElement("option");
        opt.value = ep.episode_number;
        opt.textContent = `الحلقة ${ep.episode_number}`;
        episodeSelect.appendChild(opt);
    });
    const modalIframe = document.getElementById("modal-vidfast-player");
    episodeSelect.onchange = () => {
        modalIframe.src = `${VIDFAST_BASE_URL}/tv/${tvId}/${seasonNum}/${episodeSelect.value}`;
    };
    if ((seasonData.episodes || []).length > 0) {
        modalIframe.src = `${VIDFAST_BASE_URL}/tv/${tvId}/${seasonNum}/1?autoplay=true&autoNext=true&muted=1&sub=ar`;
    }
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
    document.getElementById("modal-vidfast-player").src = "";
    document.getElementById("trailer").innerHTML = "";
}

/* ---------- Wire up ---------- */
document.getElementById("fav-btn-direct").onclick = () => toggleFavorite(activeItem);
document.getElementById("modal-fav-btn").onclick = () => toggleFavorite(activeItem);

const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("search");
if (searchBtn) searchBtn.addEventListener("click", searchMovies);
if (searchInput) {
    searchInput.addEventListener("input", debounceSearch);
    searchInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            clearTimeout(searchDebounceTimer);
            searchMovies();
        }
    });
}

/* ---------- Init ---------- */
loadFavorites();
loadTrending();
loadMovies();
loadTV();
loadTop();