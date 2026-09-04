const TMDB_API_KEY = "ef74cc8c3cb7f6100ffe47b9d59feada";
const BASE = "https://api.themoviedb.org/3";
const VIDFAST_BASE_URL = "https://vidfast.vc"; // تم إصلاح خطأ الرابط المطبعي
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

// مصفوفة لتخزين نتائج البحث العامة لمنع توقف دالة showAndPlay


let currentResults = [];

// دالة جلب البيانات العامة
async function api(url) {
    try {
        const res = await fetch(url);
        return await res.json();
    } catch (e) {
        console.error("خطأ في جلب البيانات:", e);
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
    const item = currentResults.find(x => x.id === id && x.media_type === type);
    if (!item) return;

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

// دالة بناء الكارت مع حماية نصوص الاستدعاء
function card(item) {
    const title = item.title || item.name;
    const safeItem = JSON.stringify(item).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    return `
    <div class="card" onclick='details(${safeItem})'>
        <img src="${IMAGE_BASE_URL}${item.poster_path}" onerror="this.src='https://placehold.co'">
        <div class="info">
            <h3>${title}</h3>
            <div class="rate">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : '-'}</div>
            <div class="rate">الرقم: ${item.id}</div>
            <div class="rate">النوع: ${item.media_type === 'tv' ? 'مسلسل' : 'فيلم'}</div>
        </div>
    </div>
    `;
}

async function loadTrending() {
    const data = await api(`${BASE}/trending/all/week?api_key=${TMDB_API_KEY}&language=ar-SA`);
    document.getElementById("trending").innerHTML = "";

    data.results.forEach(i => {
        if (i.poster_path) {
            document.getElementById("trending").innerHTML += card(i);
        }
    });

    const hero = data.results[0];
    if (hero) {
        document.getElementById("hero").style.backgroundImage = `url(https://tmdb.org{hero.backdrop_path})`;
        document.getElementById("heroTitle").innerText = hero.title || hero.name;
        document.getElementById("heroText").innerText = (hero.overview || "").substring(0, 220) + "...";
        document.getElementById("hero").onclick = () => details(hero);
    }
}

async function loadMovies() {
    const data = await api(`${BASE}/movie/now_playing?api_key=${TMDB_API_KEY}&language=ar-SA`);
    document.getElementById("movieList").innerHTML = "";
    data.results.forEach(i => {
        if (i.poster_path) {
            i.media_type = "movie"; 
            document.getElementById("movieList").innerHTML += card(i);
        }
    });
}

async function loadTV() {
    const data = await api(`${BASE}/tv/popular?api_key=${TMDB_API_KEY}&language=ar-SA`);
    document.getElementById("tvList").innerHTML = "";
    data.results.forEach(i => {
        if (i.poster_path) {
            i.media_type = "tv"; 
            document.getElementById("tvList").innerHTML += card(i);
        }
    });
}

async function loadTop() {
    const data = await api(`${BASE}/movie/top_rated?api_key=${TMDB_API_KEY}&language=ar-SA`);
    document.getElementById("topList").innerHTML = "";
    data.results.forEach(i => {
        if (i.poster_path) {
            i.media_type = "movie"; 
            document.getElementById("topList").innerHTML += card(i);
        }
    });
}

async function searchMovies() {
    const value = document.getElementById("search").value.trim();
    if (!value) return;

    const data = await api(`${BASE}/search/multi?api_key=${TMDB_API_KEY}&language=ar-SA&query=${encodeURIComponent(value)}`);
    displayResults(data.results);

    document.getElementById("trending").innerHTML = "";
    data.results.forEach(i => {
        if (i.poster_path) {
            document.getElementById("trending").innerHTML += card(i);
        }
    });

    window.scrollTo({ top: 450, behavior: "smooth" });
}

// دالة عرض تفاصيل المودال وتشغيل نظام السيرفرات المتطور للمسلسلات
async function details(item) {
    document.getElementById("modal").style.display = "flex";
    document.getElementById("modalPoster").src = item.poster_path ? IMAGE_BASE_URL + item.poster_path : "";
    document.getElementById("modalTitle").innerText = item.title || item.name;
    document.getElementById("modalOverview").innerText = item.overview || "لا يوجد وصف متوفر";
    document.getElementById("modalRate").innerText = item.vote_average ? item.vote_average.toFixed(1) : "-";
    document.getElementById("modalDate").innerText = item.release_date || item.first_air_date || "-";

    const type = item.media_type === "tv" || item.name ? "tv" : "movie";
    const modalIframe = document.getElementById("modal-vidfast-player");
    const controls = document.getElementById("series-controls");

    if (type === "movie") {
        controls.style.display = "none";
        modalIframe.src = `${VIDFAST_BASE_URL}/movie/${item.id}?autoplay=true&autoNext=true&muted=1&sub=ar`;
    } else {
        controls.style.display = "flex";
        modalIframe.src = `${VIDFAST_BASE_URL}/tv/${item.id}/1/1`;
        setupModalSeriesControls(item.id);
    }

    const videos = await api(`${BASE}/${type}/${item.id}/videos?api_key=${TMDB_API_KEY}&language=en-US`);
    const trailer = videos.results ? videos.results.find(v => v.type === "Trailer" && v.site === "YouTube") : null;
    const trailerContainer = document.getElementById("trailer");
    if (trailer) {
        trailerContainer.innerHTML = `<iframe src="https://youtube.com{trailer.key}" allowfullscreen></iframe>`;
    } else {
        trailerContainer.innerHTML = "<p>لا يوجد تريلر متوفر</p>";
    }
}

// بناء قوائم مواسم المسلسل
async function setupModalSeriesControls(tvId) {
    const tvDetails = await api(`${BASE}/tv/${tvId}?api_key=${TMDB_API_KEY}&language=ar-SA`);
    const seasonSelect = document.getElementById("season-select");
    
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

// بناء وتحديث قائمة الحلقات عند تغيير الموسم
async function updateModalEpisodesList(tvId, seasonNum) {
    const episodeSelect = document.getElementById("episode-select");
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
        modalIframe.src = `${VIDFAST_BASE_URL}/tv/${tvId}/${seasonNum}/1`;
    }
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
    document.getElementById("modal-vidfast-player").src = ""; 
    document.getElementById("trailer").innerHTML = "";
}

document.getElementById("searchBtn").addEventListener("click", searchMovies);
document.getElementById("search").addEventListener("keypress", function (e) {
    if (e.key === "Enter") searchMovies();
});
   
loadTrending();
loadMovies();
loadTV();
loadTop();
