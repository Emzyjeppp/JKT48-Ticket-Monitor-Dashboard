// C:\Users\jefry\.gemini\antigravity\scratch\jkt48-monitor\cloudflare-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event))
})

async function handleRequest(request, event) {
  const cacheUrl = new URL(request.url)
  const cacheKey = new Request(cacheUrl.toString(), request)
  const cache = caches.default

  // 1. Coba ambil data dari cache Cloudflare terlebih dahulu
  let response = await cache.match(cacheKey)
  if (response) {
    // Tambahkan/pastikan header CORS ada di respon cache
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

    // 2. Jika tidak ada di cache, ambil data langsung dari API JKT48 secara paralel
    const [pcSby, pcYogya, shotSby, shotYogya] = await Promise.all([
      fetchJson("https://jkt48.com/api/v1/exclusives/EX9A4A/bonus?lang=id"),
      fetchJson("https://jkt48.com/api/v1/exclusives/EXCB75/bonus?lang=id"),
      fetchJson("https://jkt48.com/api/v1/exclusives/EX3773/bonus?lang=id"),
      fetchJson("https://jkt48.com/api/v1/exclusives/EXCD2C/bonus?lang=id")
    ])

    let output = []

    // Fungsi parsing data terstruktur
    function parseData(jsonData, jenisBenefit, namaEvent) {
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
    }

    parseData(pcSby, 'Photocard', 'LOVE & DREAM (SBY)')
    parseData(pcYogya, 'Photocard', 'PASSION (YOGYA)')
    parseData(shotSby, '2-Shot', 'LOVE & DREAM (SBY)')
    parseData(shotYogya, '2-Shot', 'PASSION (YOGYA)')

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
      data: output
    }

    // Buat response dengan CORS enabled & Cache-Control (60 detik)
    response = new Response(JSON.stringify(finalData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60' // Disimpan di cache browser & CDN selama 60 detik
      }
    })

    // Simpan ke cache Cloudflare
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
