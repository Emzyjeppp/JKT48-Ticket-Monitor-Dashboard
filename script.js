// Global Variables
let semuaMasterData = [];
let filterJenisAktif = 'SEMUA';
let filterEventAktif = 'SEMUA';
let urutanAktif = 'TERSEDIA';
let oshiBookmarks = JSON.parse(localStorage.getItem('oshiBookmarks')) || [];
let fetchTimeout = null;

// Tipe data & data hasil parsing untuk Halaman 3 (JSON Reader)
let jsonDataType = 'EXCLUSIVES';
let semuaJsonMasterData = [];

// URL Cloudflare Worker API
const API_URL = 'https://jkt48-monitor-api.jefryoconner49.workers.dev';

// Map foto profil member (name -> photo_url)
let memberPhotosMap = new Map();

async function muatDaftarMember() {
    try {
        const response = await fetch(API_URL + '/api/members?_cb=' + new Date().getTime());
        if (response.ok) {
            const dataJson = await response.json();
            if (dataJson && dataJson.data && Array.isArray(dataJson.data)) {
                dataJson.data.forEach(m => {
                    if (m.name && m.photo) {
                        const parts = m.photo.split('/');
                        const filename = parts[parts.length - 1];
                        const proxiedPhoto = API_URL + '/api/member-image?filename=' + filename;
                        memberPhotosMap.set(m.name.toLowerCase().trim(), proxiedPhoto);
                    }
                });
            }
        }
    } catch (error) {
        console.error("Gagal memuat foto profil member:", error.message);
    }
}

// ==========================================
// SPA NAVIGATION
// ==========================================
function updateBentoStats() {
    const bentoOshi = document.getElementById('bentoOshiCount');
    if (bentoOshi) {
        bentoOshi.innerText = `${oshiBookmarks.length} Member`;
    }
}

function navigateTo(view) {
    // Sembunyikan semua view
    document.getElementById('portalView').classList.add('hidden');
    document.getElementById('exclusivesView').classList.add('hidden');
    document.getElementById('theaterView').classList.add('hidden');
    document.getElementById('jsonReaderView').classList.add('hidden');

    // Matikan timer jika keluar dari halaman exclusives
    if (view !== 'exclusives' && fetchTimeout) {
        clearTimeout(fetchTimeout);
        fetchTimeout = null;
    }

    // Tampilkan view yang dituju
    if (view === 'portal') {
        document.getElementById('portalView').classList.remove('hidden');
        document.title = "JKT48 Advanced Ticket & Theater Monitor";
        updateBentoStats();
    } else if (view === 'exclusives') {
        document.getElementById('exclusivesView').classList.remove('hidden');
        document.title = "JKT48 Exclusives Ticket Monitor";
        bacaDataLokal(); // Trigger pemuatan otomatis
    } else if (view === 'theater') {
        document.getElementById('theaterView').classList.remove('hidden');
        document.title = "JKT48 Theater Ticket Monitor";
        inisialisasiJadwalTheater();
    } else if (view === 'jsonReader') {
        document.getElementById('jsonReaderView').classList.remove('hidden');
        document.title = "JKT48 Dump JSON Parser";
    }

    // Update active class pada navigasi global
    const views = ['portal', 'exclusives', 'theater', 'jsonReader'];
    views.forEach(v => {
        const navBtn = document.getElementById(`nav-${v}`);
        if (navBtn) {
            if (v === view) {
                navBtn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer bg-gradient-to-r from-rose-500/10 to-sky-500/10 text-sky-400 border border-sky-500/20";
            } else {
                navBtn.className = "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent";
            }
        }
    });
}


// ==========================================
// UTILITIES (DATE FORMATTER)
// ==========================================
function formatWIB(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    
    const tanggal = d.getDate();
    const bulan = d.toLocaleDateString('id-ID', { month: 'short' });
    const tahun = d.getFullYear();
    const jam = String(d.getHours()).padStart(2, '0');
    const menit = String(d.getMinutes()).padStart(2, '0');
    
    return `${tanggal} ${bulan} ${tahun}, ${jam}:${menit} WIB`;
}


// ==========================================
// HALAMAN 1: TIKET EVENT EXCLUSIVES (MNG, 2S, VC)
// ==========================================

// Fungsi mereset animasi bar waktu hitung mundur auto-refresh
function resetProgressBar() {
    const progressBar = document.getElementById('refreshProgress');
    if (!progressBar) return;
    
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    
    // Trigger reflow untuk mereset transition state browser
    progressBar.offsetHeight;
    
    progressBar.style.transition = 'width 15000ms linear';
    progressBar.style.width = '100%';
}

// Fungsi bookmark/pin oshi ke posisi teratas
function toggleOshi(memberName) {
    const idx = oshiBookmarks.indexOf(memberName);
    if (idx > -1) {
        oshiBookmarks.splice(idx, 1);
    } else {
        oshiBookmarks.push(memberName);
    }
    localStorage.setItem('oshiBookmarks', JSON.stringify(oshiBookmarks));
    filterData();
    updateBentoStats();
}

// Mengambil data dari Cloudflare Worker API
async function bacaDataLokal() {
    // Reset bar visual & jadwal reload otomatis (15 detik)
    resetProgressBar();
    if (fetchTimeout) clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(bacaDataLokal, 15000);

    const statusDiv = document.getElementById('statusFetch');
    try {
        const fetchUrl = API_URL + '?_cb=' + new Date().getTime();
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Gagal mengambil data kuota JKT48.");
        
        const dataJson = await response.json();
        semuaMasterData = dataJson.data || [];
        
        // Render saringan event secara dinamis
        renderEventFilterButtons(semuaMasterData);
        
        // Perbarui log riwayat transaksi
        renderHistory(dataJson.history || []);
        
        document.getElementById('lastUpdate').innerText = `Terakhir Sync JKT48: ${dataJson.last_updated || '-'}`;
        statusDiv.innerText = "🟢 Data Sinkron";
        statusDiv.className = "text-xs font-bold text-emerald-400";
        
        filterData();
    } catch (error) {
        statusDiv.innerText = "⚠️ Gangguan Koneksi";
        statusDiv.className = "text-xs font-bold text-rose-400";
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-rose-300">
                    ${error.message}<br>
                    <span class="text-xs text-slate-400 block mt-1">Pastikan API Cloudflare Worker Anda aktif dan parameter CORS telah disetel dengan benar.</span>
                </td>
            </tr>`;
    }
}

function setJenisFilter(jenis) {
    filterJenisAktif = jenis;
    ['SEMUA', 'Photocard', '2-Shot', 'Video Call'].forEach(j => {
        const btn = document.getElementById(`btn-jns-${j}`);
        if(btn) {
            if(j === jenis) {
                btn.className = "px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white cursor-pointer transition";
            } else {
                btn.className = "px-4 py-2 rounded-lg text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer transition";
            }
        }
    });
    filterData();
}

function setEventFilter(evt) {
    filterEventAktif = evt;
    renderEventFilterButtons(semuaMasterData);
    filterData();
}

function renderEventFilterButtons(data) {
    const container = document.getElementById('eventFilterContainer');
    if (!container) return;
    
    const daftarEvent = [...new Set(data.map(item => item.event))];
    
    let html = `
        <button onclick="setEventFilter('SEMUA')" class="px-4 py-1.5 rounded-md text-xs transition cursor-pointer ${
            filterEventAktif === 'SEMUA' 
            ? 'bg-sky-600 text-white font-bold' 
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold'
        }">
            Semua Event
        </button>
    `;
    
    daftarEvent.forEach(e => {
        html += `
            <button onclick="setEventFilter('${e}')" class="px-4 py-1.5 rounded-md text-xs transition cursor-pointer ${
                filterEventAktif === e 
                ? 'bg-sky-600 text-white font-bold' 
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold'
            }">
                ${e}
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function setUrutanFilter(urutan) {
    urutanAktif = urutan;
    ['TERSEDIA', 'SOLDOUT'].forEach(u => {
        const btn = document.getElementById(`btn-sort-${u}`);
        if (btn) {
            if (u === urutan) {
                btn.className = "px-4 py-1.5 rounded-md text-xs font-bold bg-emerald-600 text-white cursor-pointer transition";
            } else {
                btn.className = "px-4 py-1.5 rounded-md text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer transition";
            }
        }
    });
    filterData();
}

function filterData() {
    const keyword = document.getElementById('searchFilter').value.toLowerCase();
    
    let hasilFilter = semuaMasterData.filter(item => {
        const cocokKeyword = item.nama.toLowerCase().includes(keyword) || item.sesi.toLowerCase().includes(keyword) || item.jalur.toLowerCase().includes(keyword);
        const cocokJenis = (filterJenisAktif === 'SEMUA') || (item.jenis === filterJenisAktif);
        const cocokEvent = (filterEventAktif === 'SEMUA') || (item.event === filterEventAktif);
        
        return cocokKeyword && cocokJenis && cocokEvent;
    });
    
    hasilFilter.sort((a, b) => {
        const aIsOshi = oshiBookmarks.includes(a.nama);
        const bIsOshi = oshiBookmarks.includes(b.nama);

        // Oshi yang dipin selalu berada paling atas
        if (aIsOshi && !bIsOshi) return -1;
        if (!aIsOshi && bIsOshi) return 1;

        if (urutanAktif === 'TERSEDIA') {
            if (a.sisa === 0 && b.sisa !== 0) return 1;
            if (a.sisa !== 0 && b.sisa === 0) return -1;
            return a.sisa - b.sisa;
        } else if (urutanAktif === 'SOLDOUT') {
            if (a.sisa === 0 && b.sisa !== 0) return -1;
            if (a.sisa !== 0 && b.sisa === 0) return 1;
            return a.sisa - b.sisa;
        }
        return 0;
    });
    
    renderTabel(hasilFilter);
}

function renderTabel(data) {
    const tbody = document.getElementById('tableBody');

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">Tidak ada tiket oshi atau benefit yang sesuai filter saat ini.</td></tr>`;
        return;
    }

    const rows = [];
    data.forEach(item => {
        let statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-400 whitespace-nowrap">Tersedia</span>`;
        let rowBg = "hover:bg-slate-700/30 transition";

        if (item.sisa === 0) {
            statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-rose-500/20 text-rose-400 whitespace-nowrap">SOLD OUT</span>`;
            rowBg = "bg-rose-950/10 text-slate-500 hover:bg-rose-950/20";
        } else if (item.sisa <= 5) {
            statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-400 animate-pulse whitespace-nowrap">Menipis</span>`;
            rowBg = "bg-amber-950/10 hover:bg-amber-950/20 text-amber-100";
        }

        const jenisBadge = item.jenis === 'Photocard' 
            ? `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap">🤝 Photocard</span>`
            : (item.jenis === '2-Shot'
               ? `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 whitespace-nowrap">📸 2-Shot</span>`
               : `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30 whitespace-nowrap">📞 Video Call</span>`);

        const isOshi = oshiBookmarks.includes(item.nama);
        const starButton = isOshi 
            ? `<button onclick="toggleOshi('${item.nama}')" class="text-amber-400 hover:text-amber-300 mr-2 focus:outline-none transition cursor-pointer text-base select-none">⭐</button>`
            : `<button onclick="toggleOshi('${item.nama}')" class="text-slate-600 hover:text-amber-400 mr-2 focus:outline-none transition cursor-pointer text-base select-none">☆</button>`;

        const photoUrl = memberPhotosMap.get(item.nama.toLowerCase().trim());
        let avatarHtml = '';
        if (photoUrl) {
            avatarHtml = `<img src="${photoUrl}" alt="${item.nama}" class="w-8 h-8 rounded-full object-cover border border-slate-700/60 shadow-sm mr-3 hover:scale-110 transition duration-300 select-none" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
            // fall back div if image fails loading
            const initial = item.nama ? item.nama.charAt(0).toUpperCase() : '?';
            avatarHtml += `<div style="display:none;" class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-600 shadow-sm mr-3 select-none">${initial}</div>`;
        } else {
            const initial = item.nama ? item.nama.charAt(0).toUpperCase() : '?';
            avatarHtml = `<div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-600 shadow-sm mr-3 select-none">${initial}</div>`;
        }

        rows.push(`
            <tr class="${rowBg}">
                <td class="p-4 font-bold text-xs text-sky-400 uppercase tracking-wider">${item.event}</td>
                <td class="p-4">${jenisBadge}</td>
                <td class="p-4 font-medium text-slate-300 text-xs">${item.sesi}</td>
                <td class="p-4 font-bold text-slate-100 flex items-center">${starButton}${avatarHtml}<div>${item.nama} <span class="block text-slate-400 font-normal text-xs mt-0.5">${item.jalur}</span></div></td>
                <td class="p-4 text-center font-mono font-semibold text-slate-400">${item.terjual}</td>
                <td class="p-4 text-center font-mono font-bold text-emerald-400 text-base">${item.sisa}</td>
                <td class="p-4 text-center">${statusBadge}</td>
            </tr>
        `);
    });
    tbody.innerHTML = rows.join('');
}

function renderHistory(historyList) {
    const historyDiv = document.getElementById('historyLog');
    if (!historyList || historyList.length === 0) {
        historyDiv.innerHTML = `<div class="py-1 text-slate-500 italic">Belum ada riwayat tiket sold out yang tercatat. Data akan muncul otomatis saat tiket member mulai habis.</div>`;
        return;
    }

    historyDiv.innerHTML = historyList.map(item => {
        const badge = `<span class="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/30 whitespace-nowrap">🔥 SOLD OUT</span>`;
        const textClass = 'text-rose-300 font-bold';

        let jenisBadge = '';
        if (item.jenis === 'Photocard') {
            jenisBadge = `<span class="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap">🤝 PC</span>`;
        } else if (item.jenis === '2-Shot') {
            jenisBadge = `<span class="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 whitespace-nowrap">📸 2S</span>`;
        } else {
            jenisBadge = `<span class="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-teal-500/10 text-teal-400 border border-teal-500/30 whitespace-nowrap">📞 VC</span>`;
        }

        const photoUrl = memberPhotosMap.get(item.nama.toLowerCase().trim());
        let avatarHtml = '';
        if (photoUrl) {
            avatarHtml = `<img src="${photoUrl}" alt="${item.nama}" class="w-5 h-5 rounded-full object-cover border border-slate-700/60 shadow-sm inline-block select-none" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">`;
            const initial = item.nama ? item.nama.charAt(0).toUpperCase() : '?';
            avatarHtml += `<div style="display:none;" class="w-5 h-5 rounded-full bg-slate-700 text-slate-300 inline-flex items-center justify-center font-bold text-[9px] border border-slate-600 shadow-sm select-none">${initial}</div>`;
        } else {
            const initial = item.nama ? item.nama.charAt(0).toUpperCase() : '?';
            avatarHtml = `<div class="w-5 h-5 rounded-full bg-slate-700 text-slate-300 inline-flex items-center justify-center font-bold text-[9px] border border-slate-600 shadow-sm select-none">${initial}</div>`;
        }

        const detailEvent = `[${item.event}]`;
        const detailJumlah = `telah HABIS (SOLD OUT)!`;

        return `
            <div class="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-700/50 last:border-b-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-slate-500 font-semibold">[${item.waktu}]</span>
                    ${badge}
                    ${jenisBadge}
                    <div class="flex items-center gap-1.5">
                        ${avatarHtml}
                        <span class="${textClass}">${item.sesi} - ${item.nama} (${item.jalur}) ${detailJumlah}</span>
                    </div>
                </div>
                <div class="text-[10px] text-slate-500">${detailEvent}</div>
            </div>
        `;
    }).join('');
}


// ==========================================
// HALAMAN 2: LIVE MONITOR TICKET THEATER
// ==========================================
let semuaTheaterShows = [];
let activeTheaterShowCode = null;
let activeTheaterMembers = [];
let activeTheaterBirthdayName = [];
let activeTheaterShowTitle = "";
let activeTheaterShowDate = "";

function inisialisasiJadwalTheater() {
    const monthSelect = document.getElementById('theaterMonthSelect');
    const yearSelect = document.getElementById('theaterYearSelect');
    
    if (monthSelect.children.length === 0) {
        // Populate Month
        const namaBulan = [
            "Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        namaBulan.forEach((b, idx) => {
            const opt = document.createElement('option');
            opt.value = idx + 1;
            opt.innerText = b;
            monthSelect.appendChild(opt);
        });

        // Populate Year
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 1; y <= currentYear + 1; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.innerText = y;
            yearSelect.appendChild(opt);
        }

        // Set to current month & year in Asia/Jakarta timezone
        const dateJakarta = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
        monthSelect.value = dateJakarta.getMonth() + 1;
        yearSelect.value = dateJakarta.getFullYear();
    }

    muatJadwalTheater();
}

function gantiBulanTheater() {
    muatJadwalTheater();
}

async function muatJadwalTheater() {
    const month = document.getElementById('theaterMonthSelect').value;
    const year = document.getElementById('theaterYearSelect').value;
    const container = document.getElementById('theaterShowsContainer');
    const statusLabel = document.getElementById('theaterStatus');

    container.innerHTML = '<div class="text-slate-400 text-xs py-2 italic text-center w-full">Memuat jadwal pertunjukan...</div>';
    statusLabel.innerText = "⏳ Memuat Jadwal...";
    statusLabel.className = "text-xs font-bold text-sky-400";

    try {
        const fetchUrl = `${API_URL}/api/schedules?month=${month}&year=${year}&_cb=${new Date().getTime()}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Gagal mengambil jadwal teater.");

        const resJson = await response.json();
        if (!resJson.status || !resJson.data) throw new Error("Format jadwal tidak valid.");

        // Filter only type SHOW
        semuaTheaterShows = resJson.data.filter(item => item.type === 'SHOW');

        if (semuaTheaterShows.length === 0) {
            container.innerHTML = '<div class="text-slate-500 text-xs py-4 italic text-center w-full">Tidak ada pertunjukan theater pada bulan ini.</div>';
            statusLabel.innerText = "🔴 Tidak Ada Show";
            statusLabel.className = "text-xs font-bold text-slate-400";
            return;
        }

        renderTheaterShowCards();
        statusLabel.innerText = "🟢 Jadwal Sinkron";
        statusLabel.className = "text-xs font-bold text-emerald-400";

        // Auto-select show: find first upcoming show or today's show
        const now = new Date();
        now.setHours(0, 0, 0, 0); // start of today

        let selectedIndex = 0; // Default to first show if none matching
        for (let i = 0; i < semuaTheaterShows.length; i++) {
            const showDate = new Date(semuaTheaterShows[i].date);
            if (showDate >= now) {
                selectedIndex = i;
                break;
            }
        }
        
        // If all shows are in the past, select the last one
        if (selectedIndex === 0 && new Date(semuaTheaterShows[0].date) < now) {
            selectedIndex = semuaTheaterShows.length - 1;
        }

        const defaultShow = semuaTheaterShows[selectedIndex];
        if (defaultShow && defaultShow.reference_code) {
            selectTheaterShow(defaultShow.reference_code);
        }

    } catch (error) {
        container.innerHTML = `<div class="text-rose-400 text-xs py-2 italic text-center w-full">Error: ${error.message}</div>`;
        statusLabel.innerText = "⚠️ Gangguan Jadwal";
        statusLabel.className = "text-xs font-bold text-rose-400";
    }
}

function renderTheaterShowCards() {
    const container = document.getElementById('theaterShowsContainer');

    const now = new Date();
    now.setHours(0,0,0,0);

    const cards = [];
    semuaTheaterShows.forEach(show => {
        const code = show.reference_code || '';
        const showDate = new Date(show.date);
        
        // Determine status tag
        let statusBadge = '';
        const dateDiff = showDate - now;
        if (dateDiff < 0) {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700/50">Selesai</span>';
        } else if (dateDiff === 0) {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">Hari Ini</span>';
        } else {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">Mendatang</span>';
        }

        // Team badge
        const team = show.jkt48_member_type || 'JKT48';
        let teamColor = 'bg-slate-700/30 text-slate-300 border-slate-600/50';
        if (team === 'LOVE') teamColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
        else if (team === 'PASSION') teamColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        else if (team === 'DREAM') teamColor = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
        else if (team === 'TRAINEE') teamColor = 'bg-teal-500/10 text-teal-400 border-teal-500/30';

        const teamBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold border ${teamColor}">${team}</span>`;

        // Format date: e.g. Jumat, 19 Juni 2026
        const dateFormatted = showDate.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'short'
        });

        const time = show.start_time ? show.start_time.substring(0, 5) : '19:00';

        const activeClass = activeTheaterShowCode === code 
            ? 'border-sky-500 ring-2 ring-sky-500/30 bg-sky-950/20 shadow-sky-500/10' 
            : 'border-slate-700/60 hover:border-slate-500/50 bg-slate-800/40';

        cards.push(`
            <div onclick="selectTheaterShow('${code}')" id="show-card-${code}" class="flex-shrink-0 w-64 border rounded-xl p-4 cursor-pointer transition-all duration-300 flex flex-col justify-between h-[105px] group ${activeClass}">
                <div class="flex justify-between items-start">
                    ${teamBadge}
                    ${statusBadge}
                </div>
                <div class="mt-2">
                    <h3 class="font-bold text-xs text-slate-100 truncate group-hover:text-sky-400 transition" title="${show.title}">${show.title}</h3>
                    <div class="flex justify-between items-center mt-1 text-[10px] text-slate-400">
                        <span>📅 ${dateFormatted}</span>
                        <span>⏰ ${time} WIB</span>
                    </div>
                </div>
            </div>
        `);
    });
    container.innerHTML = cards.join('');
}

function selectTheaterShow(code) {
    // Remove active class from previous active card
    if (activeTheaterShowCode) {
        const prevCard = document.getElementById(`show-card-${activeTheaterShowCode}`);
        if (prevCard) {
            prevCard.className = prevCard.className
                .replace('border-sky-500 ring-2 ring-sky-500/30 bg-sky-950/20 shadow-sky-500/10', '')
                .concat(' border-slate-700/60 hover:border-slate-500/50 bg-slate-800/40');
        }
    }

    activeTheaterShowCode = code;
    document.getElementById('theaterSelectedShowCode').innerText = `Code: ${code}`;

    // Add active class to new card
    const activeCard = document.getElementById(`show-card-${code}`);
    if (activeCard) {
        activeCard.className = activeCard.className
            .replace('border-slate-700/60 hover:border-slate-500/50 bg-slate-800/40', '')
            .concat(' border-sky-500 ring-2 ring-sky-500/30 bg-sky-950/20 shadow-sky-500/10');
        // Scroll card into view inside the container
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    muatKuotaTheater(code);
}

function toggleManualInput() {
    const inputSec = document.getElementById('manualInputSection');
    inputSec.classList.toggle('hidden');
}

function muatKuotaTheaterDariInput() {
    const code = document.getElementById('theaterCodeInput').value.trim().toUpperCase();
    if (!code) {
        alert("Harap masukkan Show Code terlebih dahulu! (Contoh: SHEB90)");
        return;
    }
    // Deselect active cards
    if (activeTheaterShowCode) {
        const prevCard = document.getElementById(`show-card-${activeTheaterShowCode}`);
        if (prevCard) {
            prevCard.className = prevCard.className
                .replace('border-sky-500 ring-2 ring-sky-500/30 bg-sky-950/20 shadow-sky-500/10', '')
                .concat(' border-slate-700/60 hover:border-slate-500/50 bg-slate-800/40');
        }
        activeTheaterShowCode = null;
    }
    document.getElementById('theaterSelectedShowCode').innerText = `Manual Code: ${code}`;
    muatKuotaTheater(code);
}

async function muatKuotaTheater(code) {
    const targetCode = code || document.getElementById('theaterCodeInput').value.trim().toUpperCase();
    const statusLabel = document.getElementById('theaterStatus');
    const tableBody = document.getElementById('theaterTableBody');
    const dashboardSection = document.getElementById('theaterDashboardSection');
    const btnLihatMember = document.getElementById('btnLihatMember');

    if (!targetCode) {
        alert("Harap pilih pertunjukan atau masukkan Show Code!");
        return;
    }

    statusLabel.innerText = "⏳ Menghubungi API...";
    statusLabel.className = "text-xs font-bold text-sky-400";
    dashboardSection.classList.add('hidden');
    tableBody.innerHTML = '';
    
    // Reset member globals
    activeTheaterMembers = [];
    activeTheaterBirthdayName = [];
    activeTheaterShowTitle = "";
    activeTheaterShowDate = "";
    btnLihatMember.disabled = true;
    btnLihatMember.innerHTML = "👥 Memuat Member...";
    btnLihatMember.className = "bg-slate-800/40 text-slate-500 border border-slate-700/50 font-medium py-2 px-4 rounded-lg shadow-sm transition cursor-not-allowed flex items-center gap-1.5";

    try {
        const fetchUrl = `${API_URL}/api/theater?code=${targetCode}&_cb=${new Date().getTime()}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Gagal mengambil data show. Periksa apakah kode show benar.");

        const resJson = await response.json();
        if (!resJson.status || !resJson.data) throw new Error(resJson.message || "Data show tidak ditemukan.");

        const show = resJson.data;
        const title = show.title || 'Theater Show';
        const dateFormatted = new Date(show.date).toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const time = show.start_time || '19:00';
        const showStatus = show.status; // status keaktifan show

        // Save for modal details
        activeTheaterShowTitle = title;
        activeTheaterShowDate = `${dateFormatted} @ ${time} WIB`;
        activeTheaterMembers = show.jkt48_member || [];
        activeTheaterBirthdayName = show.birthday_member_name || [];

        // Enable/Disable member button based on member list presence
        if (activeTheaterMembers.length > 0) {
            btnLihatMember.disabled = false;
            btnLihatMember.innerHTML = `👥 Lihat Member Tampil (${activeTheaterMembers.length})`;
            btnLihatMember.className = "bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 font-bold py-2 px-4 rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1.5";
        } else {
            btnLihatMember.disabled = true;
            btnLihatMember.innerHTML = "👥 Member Belum Dirilis";
            btnLihatMember.className = "bg-slate-800/40 text-slate-500 border border-slate-700/50 font-medium py-2 px-4 rounded-lg shadow-sm transition cursor-not-allowed flex items-center gap-1.5";
        }

        const sales = show.sales_period || [];
        if (sales.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">Tidak ada periode penjualan aktif untuk show ini.</td></tr>`;
            statusLabel.innerText = "🔴 Show Tidak Aktif";
            statusLabel.className = "text-xs font-bold text-rose-400";
            dashboardSection.classList.remove('hidden');
            return;
        }

        let parsedData = [];
        sales.forEach(period => {
            const periodLabel = period.label || 'Ticket';
            const method = period.sales_method || 'FCFS';
            const start = new Date(period.start_date);
            const end = new Date(period.end_date);
            const now = new Date();

            const salesPeriodText = `${formatWIB(period.start_date)} - ${formatWIB(period.end_date)}`;

            // Tentukan status ketersediaan tiket
            let statusText = 'Tersedia';
            if (!showStatus) {
                statusText = 'SOLD OUT';
            } else if (now < start) {
                statusText = 'Belum Dibuka';
            } else if (now > end) {
                statusText = 'SOLD OUT / TUTUP';
            }

            const pricingList = period.pricing || [];
            pricingList.forEach(price => {
                parsedData.push({
                    showTitle: title,
                    dateTime: `${dateFormatted} @ ${time}`,
                    category: `${periodLabel} - ${price.label}`,
                    salesPeriod: salesPeriodText,
                    quota: price.quota || 0,
                    method: method,
                    price: price.price || 0,
                    status: statusText
                });
            });
        });

        // Gambar ke tabel
        const rows = [];
        parsedData.forEach(item => {
            let statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-400 whitespace-nowrap">Tersedia</span>`;
            let rowBg = "hover:bg-slate-700/30 transition";

            if (item.status.includes('SOLD OUT') || item.status.includes('TUTUP')) {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-rose-500/20 text-rose-400 whitespace-nowrap">${item.status}</span>`;
                rowBg = "bg-rose-950/10 text-slate-500 hover:bg-rose-950/20";
            } else if (item.status === 'Belum Dibuka') {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-400 whitespace-nowrap">${item.status}</span>`;
                rowBg = "bg-amber-950/10 text-slate-400";
            }

            rows.push(`
                <tr class="${rowBg}">
                    <td class="p-4 font-bold text-slate-200">${item.showTitle}</td>
                    <td class="p-4 text-slate-300 text-xs font-medium">${item.dateTime}</td>
                    <td class="p-4 text-slate-400 text-xs">${item.category} (Rp ${item.price.toLocaleString('id-ID')})</td>
                    <td class="p-4 text-slate-300 text-xs font-mono text-center">${item.salesPeriod}</td>
                    <td class="p-4 text-center font-mono font-semibold">${item.quota}</td>
                    <td class="p-4 text-center font-mono text-xs font-semibold text-sky-400">${item.method}</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                </tr>
            `);
        });
        tableBody.innerHTML = rows.join('');

        statusLabel.innerText = "🟢 Data Sinkron";
        statusLabel.className = "text-xs font-bold text-emerald-400";
        dashboardSection.classList.remove('hidden');

    } catch (error) {
        statusLabel.innerText = "⚠️ Gangguan Koneksi";
        statusLabel.className = "text-xs font-bold text-rose-400";
        btnLihatMember.disabled = true;
        btnLihatMember.innerHTML = "👥 Member Belum Dirilis";
        btnLihatMember.className = "bg-slate-800/40 text-slate-500 border border-slate-700/50 font-medium py-2 px-4 rounded-lg shadow-sm transition cursor-not-allowed flex items-center gap-1.5";
        alert(error.message);
    }
}

// ==========================================
// MEMBER DETAIL MODAL LOGIC
// ==========================================
function bukaModalMember() {
    if (activeTheaterMembers.length === 0) return;

    document.getElementById('modalShowTitle').innerText = activeTheaterShowTitle;
    document.getElementById('modalShowDate').innerText = activeTheaterShowDate;
    document.getElementById('modalMemberCount').innerText = activeTheaterMembers.length;

    // Birthday banner handling
    const bdayBanner = document.getElementById('modalBirthdayBanner');
    const bdayName = document.getElementById('modalBirthdayName');
    if (activeTheaterBirthdayName && activeTheaterBirthdayName.length > 0) {
        bdayName.innerText = activeTheaterBirthdayName.join(', ');
        bdayBanner.classList.remove('hidden');
    } else {
        bdayBanner.classList.add('hidden');
    }

    // Grid population
    const grid = document.getElementById('modalMembersGrid');

    const memberCards = [];
    activeTheaterMembers.forEach(m => {
        // Team badges inside modal
        const team = m.type || 'JKT48';
        let teamBadgeColor = 'bg-slate-800/60 text-slate-300 border-slate-700';
        if (team === 'LOVE') teamBadgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
        else if (team === 'PASSION') teamBadgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        else if (team === 'DREAM') teamBadgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
        else if (team === 'TRAINEE') teamBadgeColor = 'bg-teal-500/10 text-teal-400 border-teal-500/30';

        const isBirthdayMember = activeTheaterBirthdayName.includes(m.name);
        const borderHighlight = isBirthdayMember 
            ? 'border-amber-500/60 bg-amber-950/20 text-amber-200' 
            : 'border-slate-800 bg-slate-900 text-slate-200';

        const bdayIcon = isBirthdayMember ? ' 🎂' : '';

        const photoUrl = memberPhotosMap.get(m.name.toLowerCase().trim());
        let avatarHtml = '';
        if (photoUrl) {
            avatarHtml = `<img src="${photoUrl}" alt="${m.name}" class="w-10 h-10 rounded-full object-cover border border-slate-700/60 shadow-sm flex-shrink-0 select-none" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
            const initial = m.name ? m.name.charAt(0).toUpperCase() : '?';
            avatarHtml += `<div style="display:none;" class="w-10 h-10 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-sm border border-slate-700 shadow-sm flex-shrink-0 select-none">${initial}</div>`;
        } else {
            const initial = m.name ? m.name.charAt(0).toUpperCase() : '?';
            avatarHtml = `<div class="w-10 h-10 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-sm border border-slate-700 shadow-sm flex-shrink-0 select-none">${initial}</div>`;
        }

        memberCards.push(`
            <div class="border rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-slate-600 transition duration-300 ${borderHighlight}">
                ${avatarHtml}
                <div class="flex flex-col justify-between gap-1">
                    <div class="font-bold text-xs leading-snug">${m.name}${bdayIcon}</div>
                    <div class="flex items-center">
                        <span class="px-1.5 py-0.5 rounded text-[8px] font-bold border ${teamBadgeColor}">${team}</span>
                    </div>
                </div>
            </div>
        `);
    });
    grid.innerHTML = memberCards.join('');

    const modal = document.getElementById('memberModal');
    modal.classList.remove('hidden');
    // Force reflow for CSS transitions
    modal.offsetHeight;
    modal.classList.remove('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-95');
    modal.querySelector('.transform').classList.add('scale-100');
}

function tutupModalMember() {
    const modal = document.getElementById('memberModal');
    modal.classList.add('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-100');
    modal.querySelector('.transform').classList.add('scale-95');
    
    // Hide after animation finishes (300ms)
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}


// ==========================================
// HALAMAN 3: PEMBACA DUMP JSON (MANUAL PARSER)
// ==========================================
function prosesDump() {
    const rawText = document.getElementById('jsonInput').value.trim();
    if(!rawText) {
        alert('Teks kosong! Salin dulu dari Network Tab atau Page Source HTML.');
        return;
    }

    // Deteksi jika input adalah HTML
    if (rawText.startsWith('<') || rawText.includes('<html') || rawText.includes('<!DOCTYPE')) {
        prosesHtmlTheater(rawText);
        return;
    }

    try {
        const parsed = JSON.parse(rawText);
        const showData = parsed.data || parsed;
        
        if (showData && (showData.theater_show_id || showData.sales_period || showData.set_list)) {
            jsonDataType = 'THEATER';
            prosesJsonTheater(showData);
        } else {
            jsonDataType = 'EXCLUSIVES';
            prosesJsonExclusives(showData);
        }

        // Tampilkan elemen dashboard & live search
        document.getElementById('jsonDashboardSection').classList.remove('hidden');
        document.getElementById('jsonSearchFilter').classList.remove('hidden');
        document.getElementById('jsonLastUpdate').innerText = `Terakhir Update: ${new Date().toLocaleTimeString('id-ID')} WIB`;

    } catch (error) {
        alert('Gagal membaca data. Pastikan seluruh teks ter-copy dengan sempurna ya!\nError: ' + error.message);
    }
}

function prosesHtmlTheater(html) {
    semuaJsonMasterData = []; // Reset
    
    // Deteksi Judul Show dari tag h2, h3, atau title
    const titleMatch = html.match(/<h2[^>]*>([^<]+)<\/h2>/i) || html.match(/<h3[^>]*>([^<]+)<\/h3>/i) || html.match(/<title>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].replace("JKT48 Official Web Site | ", "").trim() : 'Theater Show';
    
    // Bersihkan judul dari spasi/karakter newline berlebih
    title = title.replace(/\s+/g, ' ');
    
    // Deteksi Status Sold Out
    const isSoldOut = html.includes("tiket sudah habis terjual") || html.includes("habis terjual") || html.includes("Mohon Maaf");
    const statusText = isSoldOut ? "SOLD OUT" : "Tersedia";

    // Coba tebak kategori tiket dari HTML
    // JKT48 biasanya memiliki tabel harga/kategori
    // Kita buat row umum
    semuaJsonMasterData.push({
        showTitle: title,
        dateTime: "Lihat di halaman resmi",
        category: "Semua Kategori (Parsed dari HTML)",
        salesPeriod: "Lihat halaman tiket asli",
        quota: "N/A",
        method: "FCFS / Raffle",
        price: 200000,
        status: statusText
    });
    
    jsonDataType = 'THEATER';
    updateJsonTableHeaders('THEATER');
    renderJsonTabel(semuaJsonMasterData);
    
    // Tampilkan elemen dashboard & live search
    document.getElementById('jsonDashboardSection').classList.remove('hidden');
    document.getElementById('jsonSearchFilter').classList.remove('hidden');
    document.getElementById('jsonLastUpdate').innerText = `Terakhir Update: Parsed dari HTML @ ${new Date().toLocaleTimeString('id-ID')} WIB`;
}

function prosesJsonExclusives(dataSesi) {
    const sessionsArray = Array.isArray(dataSesi) ? dataSesi : [dataSesi];
    semuaJsonMasterData = []; // Reset

    sessionsArray.forEach(sesi => {
        const labelSesi = sesi.label || 'Sesi';
        let displaySesi = labelSesi;

        if (sesi.date) {
            const dateObj = new Date(sesi.date);
            const dateJakarta = new Date(dateObj.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
            if (!isNaN(dateJakarta.getTime())) {
                const day = String(dateJakarta.getDate()).padStart(2, '0');
                const month = String(dateJakarta.getMonth() + 1).padStart(2, '0');
                const dateStr = `${day}/${month}`;
                if (!labelSesi.includes('·') && !labelSesi.includes('/')) {
                    displaySesi = `${labelSesi} · ${dateStr}`;
                }
            }
        }

        if(sesi.session_members && Array.isArray(sesi.session_members)) {
            sesi.session_members.forEach(m => {
                semuaJsonMasterData.push({
                    sesi: displaySesi,
                    jalur: m.label || '-',
                    nama: m.member_name,
                    terjual: m.tickets_sold,
                    sisa: m.quota
                });
            });
        }
    });

    semuaJsonMasterData.sort((a, b) => a.sisa - b.sisa);

    updateJsonTableHeaders('EXCLUSIVES');
    renderJsonTabel(semuaJsonMasterData);
}

function prosesJsonTheater(show) {
    semuaJsonMasterData = []; // Reset

    const title = show.title || 'Theater Show';
    const dateFormatted = new Date(show.date).toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const time = show.start_time || '19:00';
    const showStatus = show.status; // boolean

    const sales = show.sales_period || [];
    sales.forEach(period => {
        const periodLabel = period.label || 'Ticket';
        const method = period.sales_method || 'FCFS';
        const start = new Date(period.start_date);
        const end = new Date(period.end_date);
        const now = new Date();

        const salesPeriodText = `${formatWIB(period.start_date)} - ${formatWIB(period.end_date)}`;

        let statusText = 'Tersedia';
        if (!showStatus) {
            statusText = 'SOLD OUT';
        } else if (now < start) {
            statusText = 'Belum Dibuka';
        } else if (now > end) {
            statusText = 'SOLD OUT / TUTUP';
        }

        const pricingList = period.pricing || [];
        pricingList.forEach(price => {
            semuaJsonMasterData.push({
                showTitle: title,
                dateTime: `${dateFormatted} @ ${time}`,
                category: `${periodLabel} - ${price.label}`,
                salesPeriod: salesPeriodText,
                quota: price.quota || 0,
                method: method,
                price: price.price || 0,
                status: statusText
            });
        });
    });

    semuaJsonMasterData.sort((a, b) => {
        if (a.status === 'Tersedia' && b.status !== 'Tersedia') return -1;
        if (a.status !== 'Tersedia' && b.status === 'Tersedia') return 1;
        return 0;
    });

    updateJsonTableHeaders('THEATER');
    renderJsonTabel(semuaJsonMasterData);
}

function updateJsonTableHeaders(type) {
    const thead = document.getElementById('jsonTableHeader');
    if (type === 'THEATER') {
        thead.innerHTML = `
            <tr class="bg-slate-700/50 text-slate-300 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                <th class="p-4">Show / Setlist</th>
                <th class="p-4">Tanggal & Jam Show</th>
                <th class="p-4">Kategori Tiket</th>
                <th class="p-4 text-center">Periode Penjualan</th>
                <th class="p-4 text-center">Kuota Awal</th>
                <th class="p-4 text-center">Metode</th>
                <th class="p-4 text-center">Status</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr class="bg-slate-700/50 text-slate-300 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                <th class="p-4">Sesi / Event</th>
                <th class="p-4">Jalur</th>
                <th class="p-4 text-rose-300">Nama Member</th>
                <th class="p-4 text-center">Tiket Terjual</th>
                <th class="p-4 text-center">Sisa Stok</th>
                <th class="p-4 text-center">Status</th>
            </tr>
        `;
    }
}

function renderJsonTabel(data) {
    const tbody = document.getElementById('jsonTableBody');

    const colCount = jsonDataType === 'THEATER' ? 7 : 6;

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}" class="p-8 text-center text-slate-500">Tidak ada data yang cocok.</td></tr>`;
        return;
    }

    const rows = [];
    data.forEach(item => {
        let row = '';
        if (jsonDataType === 'THEATER') {
            let statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-400 whitespace-nowrap">Tersedia</span>`;
            let rowBg = "hover:bg-slate-700/30 transition";

            if (item.status.includes('SOLD OUT') || item.status.includes('TUTUP')) {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-rose-500/20 text-rose-400 whitespace-nowrap">${item.status}</span>`;
                rowBg = "bg-rose-950/10 text-slate-500 hover:bg-rose-950/20";
            } else if (item.status === 'Belum Dibuka') {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-400 whitespace-nowrap">${item.status}</span>`;
                rowBg = "bg-amber-950/10 text-slate-400";
            }

            row = `
                <tr class="${rowBg}">
                    <td class="p-4 font-bold text-slate-200">${item.showTitle}</td>
                    <td class="p-4 text-slate-300 text-xs font-medium">${item.dateTime}</td>
                    <td class="p-4 text-slate-400 text-xs">${item.category} (Rp ${item.price.toLocaleString('id-ID')})</td>
                    <td class="p-4 text-slate-300 text-xs font-mono text-center">${item.salesPeriod}</td>
                    <td class="p-4 text-center font-mono font-semibold">${item.quota}</td>
                    <td class="p-4 text-center font-mono text-xs font-semibold text-sky-400">${item.method}</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                </tr>
            `;
        } else {
            let statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-400 whitespace-nowrap">Tersedia</span>`;
            let rowBg = "hover:bg-slate-700/30 transition";

            if (item.sisa === 0) {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-rose-500/20 text-rose-400 whitespace-nowrap">SOLD OUT</span>`;
                rowBg = "bg-rose-950/10 text-slate-500 hover:bg-rose-950/20";
            } else if (item.sisa <= 5) {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-400 animate-pulse whitespace-nowrap">Menipis</span>`;
                rowBg = "bg-amber-950/10 hover:bg-amber-950/20 text-amber-100";
            }

            const photoUrl = memberPhotosMap.get(item.nama.toLowerCase().trim());
            let avatarHtml = '';
            if (photoUrl) {
                avatarHtml = `<img src="${photoUrl}" alt="${item.nama}" class="w-8 h-8 rounded-full object-cover border border-slate-700/60 shadow-sm mr-3 hover:scale-110 transition duration-300 select-none" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
                const initial = item.nama ? item.nama.charAt(0).toUpperCase() : '?';
                avatarHtml += `<div style="display:none;" class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-600 shadow-sm mr-3 select-none">${initial}</div>`;
            } else {
                const initial = item.nama ? item.nama.charAt(0).toUpperCase() : '?';
                avatarHtml = `<div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-600 shadow-sm mr-3 select-none">${initial}</div>`;
            }

            row = `
                <tr class="${rowBg}">
                    <td class="p-4 font-medium text-slate-300">${item.sesi}</td>
                    <td class="p-4 text-slate-400 text-xs">${item.jalur}</td>
                    <td class="p-4 font-bold text-slate-200 flex items-center">${avatarHtml}<div>${item.nama}</div></td>
                    <td class="p-4 text-center font-mono font-semibold">${item.terjual}</td>
                    <td class="p-4 text-center font-mono font-bold text-emerald-400">${item.sisa}</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                </tr>
            `;
        }
        rows.push(row);
    });
    tbody.innerHTML = rows.join('');
}

function filterJsonData() {
    const keyword = document.getElementById('jsonSearchFilter').value.toLowerCase();
    let hasilFilter = [];
    
    if (jsonDataType === 'THEATER') {
        hasilFilter = semuaJsonMasterData.filter(item => 
            item.showTitle.toLowerCase().includes(keyword) || 
            item.category.toLowerCase().includes(keyword) ||
            item.salesPeriod.toLowerCase().includes(keyword)
        );
    } else {
        hasilFilter = semuaJsonMasterData.filter(item => 
            item.nama.toLowerCase().includes(keyword) || 
            item.sesi.toLowerCase().includes(keyword)
        );
    }
    renderJsonTabel(hasilFilter);
}

// Navigasi ke portal default saat halaman selesai dimuat pertama kali
window.onload = async function() {
    navigateTo('portal');
    updateBentoStats();
    await muatDaftarMember();
    // Jika user langsung berpindah ke exclusives, render ulang setelah foto termuat
    const exclusivesView = document.getElementById('exclusivesView');
    if (exclusivesView && !exclusivesView.classList.contains('hidden')) {
        filterData();
    }
};
