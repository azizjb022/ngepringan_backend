// database/seed_rt03_and_petugas.js
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

const WARGA_RT03 = [
  'Joko Widodo',
  'Wahyu Hidayat',
  'Anang Hermansyah',
  'Tri Sutrisno',
  'Slamet Raharjo',
  'Teguh Santoso',
  'Heri Purwanto',
  'Anton Wibowo',
  'Danang Prasetyo',
  'Fajar Nugroho',
  'Gunawan Wibisono',
  'Indra Kusuma',
  'Kurniawan Dwi',
  'Lukman Hakim',
  'Muchlis Hadi',
  'Rian Hidayatullah',
];

const PETUGAS = [
  { nama: 'Dedi', username: 'dedi', email: 'dedi@ngepringan.id', rt: 'RT 01', no_hp: '081234560199' },
  { nama: 'Bayu', username: 'bayu', email: 'bayu@ngepringan.id', rt: 'RT 02', no_hp: '081234560299' },
  { nama: 'Lingga', username: 'lingga', email: 'lingga@ngepringan.id', rt: 'RT 03', no_hp: '081234560399' },
  // Alias tambahan untuk kemudahan
  { nama: 'Dedi', username: 'petugas_rt01', email: 'petugas01@ngepringan.id', rt: 'RT 01', no_hp: '081234560100' },
  { nama: 'Bayu', username: 'petugas_rt02', email: 'petugas02@ngepringan.id', rt: 'RT 02', no_hp: '081234560200' },
  { nama: 'Lingga', username: 'petugas_rt03', email: 'petugas03@ngepringan.id', rt: 'RT 03', no_hp: '081234560300' },
];

async function seedData() {
  console.log('🚀 Memulai proses seeding data Warga RT 03 dan Petugas RT...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  // 1. Seed / Update Petugas RT
  console.log('\n--- 1. SEED PETUGAS RT ---');
  for (const p of PETUGAS) {
    const [existing] = await pool.query('SELECT id, username FROM users WHERE username = ?', [p.username]);
    if (existing.length > 0) {
      await pool.query(
        'UPDATE users SET nama = ?, email = ?, password = ?, role = ?, rt = ?, no_hp = ?, is_active = 1 WHERE username = ?',
        [p.nama, p.email, hashedPassword, 'petugas_rt', p.rt, p.no_hp, p.username]
      );
      console.log(`✅ User ${p.username} (${p.nama} - ${p.rt}) berhasil diperbarui.`);
    } else {
      await pool.query(
        `INSERT INTO users (nama, username, email, password, role, rt, no_hp, is_active)
         VALUES (?, ?, ?, ?, 'petugas_rt', ?, ?, 1)`,
        [p.nama, p.username, p.email, hashedPassword, p.rt, p.no_hp]
      );
      console.log(`✅ User ${p.username} (${p.nama} - ${p.rt}) berhasil ditambahkan.`);
    }
  }

  // 2. Seed Data Warga RT 03
  console.log('\n--- 2. SEED WARGA RT 03 ---');
  const [existingWarga] = await pool.query("SELECT COUNT(*) AS c FROM warga WHERE rt = 'RT 03'");
  const currentCount = Number(existingWarga[0]?.c || 0);
  console.log(`Jumlah warga RT 03 saat ini: ${currentCount}`);

  let insertedCount = 0;
  for (let i = 0; i < WARGA_RT03.length; i++) {
    const seq = i + 1;
    const no_kk = `340100000003${String(seq).padStart(4, '0')}`;
    const nama_kk = WARGA_RT03[i];
    const alamat = `Dusun Ngepringan, RT 03`;
    const no_hp = `0812345603${String(seq).padStart(2, '0')}`;

    const [exists] = await pool.query('SELECT id FROM warga WHERE no_kk = ? OR (nama_kk = ? AND rt = ?)', [
      no_kk,
      nama_kk,
      'RT 03',
    ]);

    if (exists.length === 0) {
      await pool.query(
        `INSERT INTO warga (no_kk, nama_kk, rt, alamat, no_hp, status, saldo_deposit)
         VALUES (?, ?, 'RT 03', ?, ?, 'aktif', 0)`,
        [no_kk, nama_kk, alamat, no_hp]
      );
      insertedCount++;
      console.log(`+ [${seq}] ${nama_kk} (${no_kk})`);
    }
  }
  console.log(`Total warga RT 03 baru yang ditambahkan: ${insertedCount}`);

  // 3. Ringkasan Akhir
  console.log('\n--- RINGKASAN AKHIR ---');
  const [usersSummary] = await pool.query(
    "SELECT id, nama, username, role, rt FROM users WHERE role = 'petugas_rt' ORDER BY rt, username"
  );
  console.log('Daftar Petugas RT aktif:');
  console.table(usersSummary);

  const [wargaSummary] = await pool.query(
    'SELECT rt, COUNT(*) AS total_kk, SUM(status = "aktif") AS aktif FROM warga GROUP BY rt ORDER BY rt'
  );
  console.log('Daftar Jumlah Warga per RT:');
  console.table(wargaSummary);

  process.exit(0);
}

seedData().catch((err) => {
  console.error('❌ Terjadi kesalahan saat seed:', err);
  process.exit(1);
});
