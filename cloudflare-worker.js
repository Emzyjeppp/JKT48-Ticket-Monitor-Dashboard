// C:\Users\jefry\.gemini\antigravity\scratch\jkt48-monitor\cloudflare-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event))
})

// Fungsi pembantu untuk menentukan nama event & lokasi secara otomatis dari judul
function parseEventName(title) {
  const t = title.toLowerCase();
  let location = "TOUR";
  
  if (t.includes("surabaya") || t.includes("sby")) {
    location = "SBY";
  } else if (t.includes("yogyakarta") || t.includes("yogya") || t.includes("jogja") || t.includes("yk")) {
    location = "YOGYA";
  } else if (t.includes("jakarta") || t.includes("jkt")) {
    location = "JKT";
  } else {
    // Coba deteksi nama kota dari kata setelah '2shot' atau 'Greet'
    const match = title.match(/2shot\s+([A-Za-z]+)/i) || title.match(/Greet\s+([A-Za-z]+)/i) || title.match(/and\s+Greet\s+([A-Za-z]+)/i);
    if (match) {
      location = match[1].toUpperCase();
    }
  }

  let theme = "EXCLUSIVES";
  if (t.includes("love") && t.includes("dream")) {
    theme = "LOVE & DREAM";
  } else if (t.includes("passion")) {
    theme = "PASSION";
  } else if (t.includes("love")) {
    theme = "LOVE";
  } else if (t.includes("dream")) {
    theme = "DREAM";
  }

  return `${theme} (${location})`;
}

async function handleRequest(request, event) {
  const cacheUrl = new URL(request.url)
  const cacheKey = new Request(cacheUrl.toString(), request)
  const cache = caches.default

  // Coba ambil dari cache Cloudflare terlebih dahulu
  let response = await cache.match(cacheKey)
  if (response) {
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Access-Control-Allow-Origin', '*')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    })
  }

  try {
    // Fungsi pembantu untuk fetch dengan header lengkap
    async function fetchJson(url) {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://jkt48.com/'
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} untuk ${url}. Respon: ${text.slice(0, 100)}`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Bukan JSON (${contentType}) untuk ${url}. Respon: ${text.slice(0, 100)}`);
      }
      return res.json();
    }

    // 1. Ambil daftar eksklusif aktif dari API JKT48
    const listRes = await fetchJson("https://jkt48.com/api/v1/exclusives?lang=id");
    const exclusives = listRes.data || [];

    // Filter hanya kategori PHOTOCARD dan TWO_SHOT yang dirilis kurang dari 30 hari lalu (untuk menyembunyikan event masa lalu)
    const activeExclusives = exclusives.filter(item => {
      if (item.category !== "PHOTOCARD" && item.category !== "TWO_SHOT") return false;
      const releaseDate = new Date(item.valid_date_from);
      const ageInDays = (new Date() - releaseDate) / (1000 * 60 * 60 * 24);
      return ageInDays < 30; // Hanya ambil yang berusia kurang dari 30 hari
    });

    // 2. Ambil data detail (bonus/tiket) secara paralel untuk setiap eksklusif yang aktif
    const detailPromises = activeExclusives.map(async (item) => {
      try {
        const detailData = await fetchJson(`https://jkt48.com/api/v1/exclusives/${item.code}/bonus?lang=id`);
        return {
          code: item.code,
          category: item.category,
          title: item.title,
          data: detailData
        };
      } catch (err) {
        console.error(`Gagal fetch detail untuk ${item.code}:`, err.message);
        return null;
      }
    });

    const details = (await Promise.all(detailPromises)).filter(d => d !== null);

    let output = []

    // 3. Parsing data terstruktur dari setiap eksklusif
    details.forEach(item => {
      const jenisBenefit = item.category === 'PHOTOCARD' ? 'Photocard' : '2-Shot';
      const namaEvent = parseEventName(item.title);
      const jsonData = item.data;

      if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
        jsonData.data.forEach(sesi => {
          const labelSesi = sesi.label || 'Sesi'
          const sesiSingkat = labelSesi.split('·')[0].trim()
          
          if (sesi.session_members) {
            sesi.session_members.forEach(m => {
              output.push({
                sesi: sesiSingkat,
                event: namaEvent,
                jenis: jenisBenefit,
                jalur: m.label || '-',
                nama: m.member_name,
                terjual: m.tickets_sold,
                sisa: m.quota
              })
            })
          }
        })
      }
    });

    // 4. Deteksi Transaksi & Urutan Sold Out Tercepat (jika database JKT48_DB terhubung)
    let history = [];
    if (typeof JKT48_DB !== 'undefined') {
      try {
        let lastSnapshot = await JKT48_DB.get("last_snapshot", "json");
        let transactions = [];

        if (lastSnapshot) {
          const lastMap = new Map();
          lastSnapshot.forEach(item => {
            const key = `${item.event}-${item.jenis}-${item.sesi}-${item.nama}-${item.jalur}`;
            lastMap.set(key, item);
          });

          output.forEach(item => {
            const key = `${item.event}-${item.jenis}-${item.sesi}-${item.nama}-${item.jalur}`;
            const prev = lastMap.get(key);

            if (prev) {
              const isSoldOutNow = (item.sisa === 0 && prev.sisa > 0);
              // Hanya catat ke log jika status berubah menjadi SOLD OUT sekarang
              if (isSoldOutNow) {
                transactions.push({
                  waktu: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
                  event: item.event,
                  jenis: item.jenis,
                  sesi: item.sesi,
                  nama: item.nama,
                  jalur: item.jalur,
                  sisa: item.sisa,
                  soldOut: true
                });
              }
            }
          });
        }

        // Lakukan pembaruan database jika ada data baru
        if (output.length > 0) {
          if (!lastSnapshot || transactions.length > 0) {
            await JKT48_DB.put("last_snapshot", JSON.stringify(output));
          }
        }

        if (transactions.length > 0) {
          let oldHistory = await JKT48_DB.get("history", "json") || [];
          history = [...transactions, ...oldHistory].slice(0, 50);
          await JKT48_DB.put("history", JSON.stringify(history));
        } else {
          history = await JKT48_DB.get("history", "json") || [];
        }
      } catch (dbErr) {
        console.error("Gagal memproses database KV:", dbErr.message);
      }
    }

    // Urutkan kuota tiket: sisa > 0 (menipis ke atas) di paling atas, dan sisa = 0 (SOLD OUT) di paling bawah
    output.sort((a, b) => {
      if (a.sisa === 0 && b.sisa !== 0) return 1;
      if (a.sisa !== 0 && b.sisa === 0) return -1;
      return a.sisa - b.sisa;
    })

    // Format Waktu WIB
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'short',
      timeStyle: 'medium'
    })
    const waktuWIB = formatter.format(new Date()) + ' WIB'

    const finalData = {
      last_updated: waktuWIB,
      data: output,
      history: history
    }

    // Buat response dengan CORS enabled & Cache-Control (60 detik)
    response = new Response(JSON.stringify(finalData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60'
      }
    })

    // Simpan ke cache Cloudflare (jika bukan error)
    event.waitUntil(cache.put(cacheKey, response.clone()))

    return response
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
