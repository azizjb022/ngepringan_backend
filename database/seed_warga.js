// Menjamin minimal 15 data warga (KK) untuk setiap RT.
// Jalankan: node database/seed_warga.js
const pool = require('../src/config/database');

const TARGET_PER_RT = 15;
const RTS = ['RT 01', 'RT 02'];

const NAMA = {
  'RT 01': [
    'Sutrisno', 'Sugiyanto', 'Bambang Supriyadi', 'Slamet Riyadi',
    'Wagiman', 'Sukardi', 'Paimin', 'Tukimin', 'Sarwono',
    'Ngadimin', 'Suparman', 'Sukamto', 'Darto', 'Hartono', 'Waluyo',
  ],
  'RT 02': [
    'Suryanto', 'Edi Susanto', 'Triyono', 'Purwanto', 'Mulyadi',
    'Nur Kholis', 'Ahmad Fauzi', 'Sigit Purnomo', 'Hendro Wibowo',
    'Yanto', 'Budi Santoso', 'Rudi Hartono', 'Agung Nugroho',
    'Darmawan', 'Susilo',
  ],
};

const noKK = (rtCode, seq) => `3401000000${rtCode}${String(seq).padStart(4, '0')}`;
const noHP = (rtCode, seq) => `08123456${rtCode}${String(seq).padStart(2, '0')}`;

(async () => {
  for (const rt of RTS) {
    const rtCode = rt.replace(/\D/g, '').padStart(2, '0');
    const [rows] = await pool.query('SELECT COUNT(*) AS c FROM warga WHERE rt = ?', [rt]);
    const existing = Number(rows[0].c);
    const need = TARGET_PER_RT - existing;

    if (need <= 0) {
      console.log(`${rt}: sudah ${existing} warga, tidak perlu seed.`);
      continue;
    }

    const names = NAMA[rt] || NAMA['RT 01'];
    let inserted = 0;
    for (let i = 0; i < need; i += 1) {
      const seq = existing + i + 1;
      const nama = names[(seq - 1) % names.length];
      await pool.query(
        `INSERT INTO warga (no_kk, nama_kk, rt, alamat, no_hp, status)
         VALUES (?, ?, ?, ?, ?, 'aktif')`,
        [noKK(rtCode, seq), nama, rt, `Dusun Ngepringan, ${rt}`, noHP(rtCode, seq)]
      );
      inserted += 1;
    }
    console.log(`${rt}: +${inserted} warga`);
  }

  const [result] = await pool.query('SELECT rt, COUNT(*) AS c FROM warga GROUP BY rt ORDER BY rt');
  console.log('Total warga per RT:', result.map((r) => `${r.rt}=${r.c}`).join(', '));
  process.exit(0);
})().catch((error) => {
  console.error('Seed gagal:', error.message);
  process.exit(1);
});
