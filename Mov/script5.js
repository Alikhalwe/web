const TMDB_API_KEY = "ef74cc8c3cb7f6100ffe47b9d59feada";
const BASE = "https://api.themoviedb.org/3";
const VIDFAST_BASE_URL = "https://vidfast.vc";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

let currentResults = [];
let favorites = JSON.parse(localStorage.getItem("neon_favorites")) || [];
let activeItem = null; // لتتبع العنصر المفتوح حالياً وتحديث أزرار المفضلة له

// دالة جلب البيانات مع إظهار تأثيرات الهياكل (Skeleton Loader) تلقائياً
async function api(url, containerId) {
    const container = document.getElementById(containerId);
    if (container) showSkeletons(container, 6); // بناء 6 كروت تحميل وهمية

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data) {
            if (!data.results) data.results = [];
            if (!data.episodes) data.episodes = [];
        }
        return data;
    } catch (e) {
        console.error("خطأ في جلب البيانات:", e.message);
        if (container) container.innerHTML = "<p class='error-msg'>عذراً، فشل تحميل البيانات. تحقق من الاتصال.</p>";
        return { results: [], episodes: [] };
    }
}

// دالة بناء تأثيرات التحميل الوهمية (Skeleton Blocks)
function showSkeletons(container, count) {
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
        container.innerHTML += `
            <div class="skeleton-card">
                <div class="skeleton-img mb-10"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
            </div>
        `;
    }
}

// دالة عرض نتائج البحث المنفصلة
function displayResults(results) {
    currentResults = results; 
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';

    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p>لم يتم العثور على نتائج. تأكد من صحة الاسم.</p>';
        return;
    }

    results.forEach(item => {
        if (item.media_type !== 'movie' && item.media_type !== 'tv') return;

        const title = item.title || item.name;
        const posterUrl = item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : 'https://placehold.co';

        const cardElement = document.createElement('div');
        cardElement.className = 'movie-card';
        cardElement.onclick = () => showAndPlay(item.id, item.media_type);
        cardElement.innerHTML = `
            <img src="${posterUrl}" alt="${title}" onerror="this.src='https://placehold.co'">
            <p title="${title}">${title}</p>
        `;
        resultsContainer.appendChild(cardElement);
    });
}

// دالة تشغيل المشغل المباشر لنتائج البحث
function showAndPlay(id, type) {
    const item = currentResults.find(x => x.id === id && x.media_type === type) || favorites.find(x => x.id === id && x.media_type === type);
    if (!item) return;

    activeItem = item;
    if(!activeItem.media_type) activeItem.media_type = type; // تأكيد الحقل

    const title = item.title || item.name;
    const posterUrl = item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : 'https://placehold.co';
    const date = item.release_date || item.first_air_date || 'غير متوفر';
    const overview = item.overview || 'لا يوجد وصف متاح لهذا العمل باللغة العربية حالياً.';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '0.0';

    document.getElementById('detail-title').innerText = title;
    document.getElementById('detail-poster').src = posterUrl;
    document.getElementById('detail-date').innerText = `تاريخ الإصدار: ${date}`;
    document.getElementById('detail-rating').innerText = rating;
    document.getElementById('detail-overview').innerText = overview;
    document.getElementById('info-box').style.display = 'block';

    updateFavButtons();

    const playerWrap = document.getElementById('player-wrap');
    const iframe = document.getElementById('vidfast-player');

    let embedUrl = '';
    if (type === 'movie') {
        embedUrl = `${VIDFAST_BASE_URL}/movie/${id}`; 
    } else if (type === 'tv') {
        embedUrl = `${VIDFAST_BASE_URL}/tv/${id}/1/1`;
    }

    iframe.src = embedUrl;
    playerWrap.style.display = 'block';
    
    document.getElementById('info-box').scrollIntoView({ behavior: 'smooth' });
}

// دالة بناء الكارت مع حماية نصوص الاستدعاء ونظام المفضلة
function card(item) {
    const title = item.title || item.name;
    const safeItem = JSON.stringify(item).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    const isFav = favorites.some(x => x.id === item.id);

    return `
    <div class="card" onclick='activeItem=${safeItem}; details(activeItem)'>
        <img src="${IMAGE_BASE_URL}${item.poster_path}" onerror="this.src='https://placehold.co'">
        <button class="fav-card-icon ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavoriteFromCard(${safeItem})">❤️</button>
        <div class="info">
            <h3>${title}</h3>
            <div class="rate">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : '-'}</div>
            <div class="rate">النوع: ${item.media_type === 'tv' ? 'مسلسل' : 'فيلم'}</div>
        </div>
    </div>
    `;
}
// دالة تصفية العروض (الكل، أفلام، مسلسلات)
function filterMediaType(type, button) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const sections = document.querySelectorAll('.layout-group');
    sections.forEach(sec => {
        if (type === 'all' || sec.getAttribute('data-type') === type) {
            sec.style.display = 'block';
        } else {
            sec.style.display = 'none';
        }
    });
}

// إدارة وقراءة قائمة المفضلة من LocalStorage
function loadFavorites() {
    const favListContainer = document.getElementById("favoritesList");
    const favSection = document.getElementById("favorites-section");
    if (!favListContainer) return;

    favListContainer.innerHTML = "";
    if (favorites.length === 0) {
        favSection.style.display = "none";
        return;
    }

    favSection.style.display = "block";
    favorites.forEach(item => {
        favListContainer.innerHTML += card(item);
    });
}

function toggleFavorite(item) {
    if (!item) return;
    const index = favorites.findIndex(x => x.id === item.id);
    if (index === -1) {
        favorites.push(item);
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem("neon_favorites", JSON.stringify(favorites));
    loadFavorites();
    updateFavButtons();
}

function toggleFavoriteFromCard(item) {
    toggleFavorite(item);
    // لإعادة تحديث الكروت المفتوحة برمجياً في الأقسام الأخرى فوراً لمنع تعارض الأشكال
    document.dispatchEvent(new CustomEvent('favUpdated'));
}

function updateFavButtons() {
    if (!activeItem) return;
    const isFav = favorites.some(x => x.id === activeItem.id);
    const directBtn = document.getElementById("fav-btn-direct");
    const modalBtn = document.getElementById("modal-fav-btn");

    const text = isFav ? "❤️ احذف من المفضلة" : "🤍 أضف للمفضلة";
    if (directBtn) directBtn.innerText = text;
    if (modalBtn) modalBtn.innerText = text;
}

// ربط أحداث أزرار المفضلة المباشرة
document.getElementById("fav-btn-direct").onclick = () => toggleFavorite(activeItem);
document.getElementById("modal-fav-btn").onclick = () => toggleFavorite(activeItem);

// جلب أقسام واجهة المستخدم
async function loadTrending() {
    const data = await api(`${BASE}/trending/all/week?api_key=${TMDB_API_KEY}&language=ar-SA`, "trending");
    document.getElementById("trending").innerHTML = "";

    data.results.forEach(i => {
        if (i.poster_path) document.getElementById("trending").innerHTML += card(i);
    });

    const hero = data.results[0];
    if (hero) {
        document.getElementById("hero").style.backgroundImage = `url(https://image.tmdb.org/t/p/w500{hero.backdrop_path})`;
        document.getElementById("heroTitle").innerText = hero.title || hero.name;
        document.getElementById("heroText").innerText = (hero.overview || "").substring(0, 220) + "...";
        document.getElementById("hero").onclick = () => { activeItem = hero; details(hero); };
    }
}

async function loadMovies() {
    const data = await api(`${BASE}/movie/now_playing?api_key=${TMDB_API_KEY}&language=ar-SA`, "movieList");
    document.getElementById("movieList").innerHTML = "";
    data.results.forEach(i => {
        if (i.poster_path) { i.media_type = "movie"; document.getElementById("movieList").innerHTML += card(i); }
    });
}

async function loadTV() {
    const data = await api(`${BASE}/tv/popular?api_key=${TMDB_API_KEY}&language=ar-SA`, "tvList");
    document.getElementById("tvList").innerHTML = "";
    data.results.forEach(i => {
        if (i.poster_path) { i.media_type = "tv"; document.getElementById("tvList").innerHTML += card(i); }
    });
}

async function loadTop() {
    const data = await api(`${BASE}/movie/top_rated?api_key=${TMDB_API_KEY}&language=ar-SA`, "topList");
    document.getElementById("topList").innerHTML = "";
    data.results.forEach(i => {
        if (i.poster_path) { i.media_type = "movie"; document.getElementById("topList").innerHTML += card(i); }
    });
}

async function searchMovies() {
    const value = document.getElementById("search").value.trim();
    if (!value) return;

    const resultsContainer = document.getElementById('results');
    showSkeletons(resultsContainer, 4);

    const data = await api(`${BASE}/search/multi?api_key=${TMDB_API_KEY}&language=ar-SA&query=${encodeURIComponent(value)}`, "results");
    displayResults(data.results);

    window.scrollTo({ top: 450, behavior: "smooth" });
}

// دالة عرض تفاصيل المودال وتشغيل نظام السيرفرات المتطور للمسلسلات
async function details(item) {
    activeItem = item;
    document.getElementById("modal").style.display = "flex";
    document.getElementById("modalPoster").src = item.poster_path ? IMAGE_BASE_URL + item.poster_path : "";
    document.getElementById("modalTitle").innerText = item.title || item.name;
    document.getElementById("modalOverview").innerText = item.overview || "لا يوجد وصف متوفر";
    document.getElementById("modalRate").innerText = item.vote_average ? item.vote_average.toFixed(1) : "-";
    document.getElementById("modalDate").innerText = item.release_date || item.first_air_date || "-";

    const type = item.media_type === "tv" || item.name ? "tv" : "movie";
    if(!activeItem.media_type) activeItem.media_type = type;

    const modalIframe = document.getElementById("modal-vidfast-player");
    const controls = document.getElementById("series-controls");

    updateFavButtons();

    if (type === "movie") {
        if(controls) controls.style.display = "none";
        modalIframe.src = `${VIDFAST_BASE_URL}/movie/${item.id}?autoplay=true&autoNext=true&muted=1&sub=ar`;
    } else {
        if(controls) controls.style.display = "flex";
        modalIframe.src = `${VIDFAST_BASE_URL}/tv/${item.id}/1/1`;
        setupModalSeriesControls(item.id);
    }

    const trailerContainer = document.getElementById("trailer");
    showSkeletons(trailerContainer, 1);

    const videos = await api(`${BASE}/${type}/${item.id}/videos?api_key=${TMDB_API_KEY}&language=en-US`, "trailer");
    const trailer = videos.results ? videos.results.find(v => v.type === "Trailer" && v.site === "YouTube") : null;
    
    if (trailer) {
        trailerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe>`;
    } else {
        trailerContainer.innerHTML = "<p>لا يوجد تريلر متوفر لهذا العمل.</p>";
    }
}

async function setupModalSeriesControls(tvId) {
    const tvDetails = await api(`${BASE}/tv/${tvId}?api_key=${TMDB_API_KEY}&language=ar-SA`);
    const seasonSelect = document.getElementById("season-select");
    if(!seasonSelect) return;
    
    seasonSelect.innerHTML = "";
    for (let s = 1; s <= tvDetails.number_of_seasons; s++) {
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
    if(!episodeSelect) return;
    
    const seasonData = await api(`${BASE}/tv/${tvId}/season/${seasonNum}?api_key=${TMDB_API_KEY}&language=ar-SA`);
    
    episodeSelect.innerHTML = "";
    seasonData.episodes.forEach(ep => {
        const opt = document.createElement("option");
        opt.value = ep.episode_number;
        opt.textContent = `الحلقة ${ep.episode_number}`;
        episodeSelect.appendChild(opt);
    });

    const modalIframe = document.getElementById("modal-vidfast-player");
    episodeSelect.onchange = () => {
        modalIframe.src = `${VIDFAST_BASE_URL}/tv/${tvId}/${seasonNum}/${episodeSelect.value}`;
    };

    if (seasonData.episodes.length > 0) {
        modalIframe.src = `${VIDFAST_BASE_URL}/tv/${tvId}/${seasonNum}/1?autoplay=true&autoNext=true&muted=1&sub=ar`;
    }
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
    document.getElementById("modal-vidfast-player").src = ""; 
    document.getElementById("trailer").innerHTML = "";
}

// مستمع تحديثات المفضلة العامة لإعادة الرسم
document.addEventListener('favUpdated', () => {
    loadTrending();
    loadMovies();
    loadTV();
    loadTop();
});

const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("search");

if(searchBtn) searchBtn.addEventListener("click", searchMovies);
if(searchInput) {
    searchInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") searchMovies();
    });
}
   
// التشغيل والتحميل الأولي
loadFavorites();
loadTrending();
loadMovies();
loadTV();
loadTop();
