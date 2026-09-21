# Robinchan

Companion market berkarakter Live2D untuk saham tokenized di Robinhood Chain.

Implementasi ini mencakup **M1 (landing page statis)** dan **M2 (data hidup)** dari
`robinchan-dev-brief.md` §17. M3 (wallet, SIWE, chat streaming) dan M4 (trading) sengaja belum
dikerjakan — lihat [Batas cakupan](#batas-cakupan).

---

## Jalankan

Butuh Node 20+.

```bash
npm install
cp .env.example .env        # semuanya boleh dibiarkan kosong
npm run dev
```

Tiga proses jalan bersamaan: web di `http://localhost:3000`, API di `http://localhost:4000`, dan
worker di latar belakang. Halaman Market akan mulai terisi dalam sepuluh detik pertama.

Untuk mengisi data sekali saja tanpa menyalakan worker terus-menerus:

```bash
npm run once -w @robinchan/worker
```

Perintah lain: `npm run build`, `npm run typecheck`, `npm run lint`.

### Tanpa Postgres dan Redis

`.env` kosong berarti cache dan database jatuh ke berkas JSON di `.data/`. Ini bukan penyimpanan
in-memory: API dan worker adalah dua proses terpisah dan harus tetap saling melihat data.

Isi `DATABASE_URL` dan `REDIS_URL` untuk memakai yang sungguhan — kodenya sama, hanya
implementasinya yang bertukar (`packages/store`). Skema Postgres ada di
`packages/store/src/schema.sql` dan dijalankan otomatis saat API atau worker start.

### Tanpa API key provider

Provider yang belum punya kunci berstatus **abu ("belum dikonfigurasi")** di kartu "Sumber yang
dipantau", bukan merah — belum dikonfigurasi bukan kegagalan. Di `RC_ENV=dev`, provider yang gagal
atau belum dikonfigurasi diganti data palsu yang menandai dirinya sendiri lewat field `source`.

Kunci yang membuat data jadi nyata:

| Variabel | Mengaktifkan |
| --- | --- |
| `FINNHUB_API_KEY` | Harga, index, feed berita, kalender earnings |
| `SEC_EDGAR_USER_AGENT` | Filing SEC (wajib berisi kontak yang bisa dihubungi) |
| `YOUTUBE_API_KEY` | Id stream aktif per channel dan klip Sorotan |
| `NEXT_PUBLIC_RCHAN_ADDRESS` | Harga $RCHAN dari DexScreener |

Tanpa `YOUTUBE_API_KEY`, `videoId` sengaja dikosongkan supaya frontend jatuh ke poster statis +
tombol "Buka di YouTube" — jalur fallback yang memang diwajibkan brief §6, bukan id palsu yang akan
gagal dimuat diam-diam.

---

## Struktur

```
apps/
  web/          Next.js 15 App Router — Home, Robinchan, Market
  api/          Fastify — REST, membaca cache dan database saja
  worker/       Cron — menarik provider, menulis cache dan database
packages/
  shared/       Tipe, konstanta, util format (dipakai ketiganya)
  store/        Cache dan database di balik satu antarmuka
```

`packages/store` adalah tambahan di luar struktur yang disebut brief §2. Alasannya: API dan worker
sama-sama butuh akses cache dan database, dan `packages/shared` tidak boleh menarik `pg` atau
`ioredis` ke dalam bundle frontend.

Worker menarik data sesuai jadwal dan menulis ke cache dan database. API hanya membaca, tidak pernah
memanggil provider saat ada permintaan masuk. Efeknya: halaman tetap cepat, rate limit provider
aman, dan kalau provider mati, data terakhir masih tersaji dengan penanda `stale`.

---

## Karakter Live2D

Model: [Zundamon](https://www.live2d.com/en/learn/sample/zundamon/), sample model Live2D Inc.
Aset runtime ada di `apps/web/public/live2d/zundamon/`.

- Jalur model dibaca dari `NEXT_PUBLIC_LIVE2D_MODEL_URL`, tidak di-hardcode, supaya bisa ditukar
  tanpa ubah kode (brief §5).
- Peta ekspresi produk (`senang`, `fokus`, `waspada`, `santai`) dipisah dari nama ekspresi di
  `model3.json`, di `apps/web/src/components/live2d/expressions.ts`. Menukar model berarti mengubah
  satu tabel itu saja.
- Cubism Core dimuat dari CDN resmi Live2D — paketnya tidak dipublikasikan di npm.
- `model3.json` yang disalin ke `public/` diberi isi untuk grup `EyeBlink` dan `LipSync`. Live2D
  mengirimnya kosong; tanpa itu kedip otomatis dan lip-sync tidak punya parameter untuk digerakkan.
- Tanpa WebGL, stage jatuh ke placeholder statis dan tombol ekspresi dimatikan.

**Lisensi belum tuntas.** `ReadMe.txt` bawaan menyebut penggunaan komersial boleh untuk pengguna
umum dan usaha kecil dengan persetujuan syarat, sementara usaha menengah–besar hanya boleh untuk
pengujian non-publik. Di luar itu, karakter Zundamon punya panduan penggunaannya sendiri dari
Tohoku Zunko / Zundamon Project. Keduanya perlu dikonfirmasi sebelum produksi — lihat design.md §9.
Sampai itu jelas, perlakukan aset ini sebagai placeholder. Salinan notis aslinya ada di
`apps/web/public/live2d/zundamon/LICENSE-NOTICE.txt`.

---

## Batas cakupan

Yang **belum** dikerjakan karena di luar M1–M2:

- `POST /api/chat`, `/api/order/*`, `/api/user/tier`, `/api/user/watchlist` — M3 dan M4. Kerangka
  UI-nya sudah ada (panel chat, kartu tier, `<OrderPreviewCard>`) dan dirender dalam keadaan
  nonaktif dengan alasannya disebut, bukan dibiarkan terlihat aktif lalu gagal saat ditekan.
- Connect wallet dan SIWE — M3. Tombolnya sudah menempati ruangnya di topbar supaya tinggi topbar
  tidak berubah waktu fiturnya menyala.
- Komponen social pada heat score — fase 3. Bobotnya dibagi proporsional ke on-chain dan berita
  sesuai brief §13, bukan dibiarkan nol.
- Job pencatatan buyback — brief §14; tidak ada di daftar M2.

Hal yang perlu diputuskan sebelum M3 ada di brief §18 (alamat kontrak $RCHAN, ambang tier, provider
LLM).

### Catatan teknis

- **Sentimen berita** memakai skor leksikon di `apps/worker/src/lib/sentiment.ts`. Alpha Vantage
  News Sentiment baru masuk di fase 2, sementara titik sentimen dan komponen berita pada heat score
  sudah butuh angka sekarang.
- **Gating heat score** selalu memperlakukan permintaan sebagai anonim sampai verifikasi tier
  sungguhan masuk di M3. Memulangkan skor penuh karena client mengaku punya tier akan jadi gating
  palsu.
- **`npm audit`** menyisakan dua temuan yang tidak bisa ditutup dari sini:
  `pixi-live2d-display` mencantumkan `gh-pages` sebagai dependency padahal itu alat deploy
  dokumentasinya sendiri dan tidak pernah diimpor dari `dist/`; dan `postcss` yang dibundel Next
  baru diperbaiki di Next 16, sementara brief mengunci Next 14+ dengan Tailwind v3.
