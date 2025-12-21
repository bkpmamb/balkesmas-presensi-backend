Dokumentasi **README.md** yang baik sangat penting agar orang lain (atau Anda di masa depan) tahu cara menjalankan project ini. File ini akan tampil di halaman depan repositori GitHub Anda.

Berikut adalah draf **README.md** profesional yang sudah disesuaikan dengan fitur-fitur yang kita bangun:

---

```markdown
# Balkesmas Presensi Backend 🏥

Sistem backend manajemen kehadiran karyawan berbasis Node.js, Express, dan MongoDB. Dilengkapi dengan fitur autentikasi JWT, validasi GPS, manajemen user (CRUD), pelaporan, dan ekspor data ke CSV.

## ✨ Fitur Utama

* **Autentikasi & Otorisasi**: Login menggunakan JWT (JSON Web Token) dengan pemisahan role Admin dan Employee.
* **Sistem Presensi**: Clock-in dan Clock-out dengan pencatatan lokasi (GPS), foto, dan deteksi keterlambatan otomatis.
* **Dashboard Admin**: Statistik real-time jumlah karyawan dan kehadiran harian.
* **Manajemen Karyawan (CRUD)**: Create, Read (dengan Pagination), Update, Delete, serta fitur Reset Password.
* **Pelaporan & Filter**: Filter riwayat absensi berdasarkan rentang tanggal, nama, atau kategori jabatan.
* **Export Data**: Mengunduh laporan presensi ke dalam format `.csv` yang kompatibel dengan Microsoft Excel.
* **Optimasi Performa**: Implementasi Pagination pada endpoint dengan data besar.

## 🚀 Teknologi yang Digunakan

* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: MongoDB (Mongoose ODM)
* **Security**: Bcrypt.js (Password Hashing), JWT (Authentication)
* **Utility**: json-2-csv (Export Data), Multer (File Upload)

## 🛠️ Cara Instalasi

1. Clone repositori ini:
   ```bash
   git clone [https://github.com/username/balkesmas-presensi-backend.git](https://github.com/username/balkesmas-presensi-backend.git)
   cd balkesmas-presensi-backend

```

2. Instal dependensi:
```bash
npm install

```


3. Buat file `.env` di direktori utama dan isi konfigurasinya:
```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/balkesmas
JWT_SECRET=rahasia_negara_123

```


4. Jalankan aplikasi:
```bash
# Mode Development
npm run dev

# Mode Production
npm start

```



## 📂 Struktur API (Admin)

| Method | Endpoint | Deskripsi |
| --- | --- | --- |
| `GET` | `/api/admin/stats` | Statistik dashboard |
| `GET` | `/api/admin/employees` | Daftar karyawan (Pagination & Search) |
| `POST` | `/api/admin/employees` | Tambah karyawan baru |
| `PUT` | `/api/admin/employees/:id` | Edit data karyawan |
| `DELETE` | `/api/admin/employees/:id` | Hapus karyawan |
| `PUT` | `/api/admin/employees/:id/reset-password` | Reset password karyawan |
| `GET` | `/api/admin/report` | Filter laporan presensi |
| `GET` | `/api/admin/export` | Download laporan CSV |

## 📝 Catatan Penting

* Gunakan header `Authorization: Bearer <token_anda>` untuk mengakses endpoint yang dilindungi.
* Format tanggal untuk filter laporan adalah `YYYY-MM-DD`.
* File CSV hasil export menggunakan pemisah koma (`,`) dengan instruksi `sep=,` agar otomatis rapi di Excel.

```

---

### Tips Sebelum Push ke GitHub:
1.  **`.gitignore`**: Pastikan Anda sudah memiliki file `.gitignore` yang berisi `node_modules` dan `.env`. Jangan pernah mem-push file `.env` ke publik karena berisi kredibel database dan secret key Anda.
2.  **Keterangan Komit**: Gunakan pesan commit yang jelas, misalnya: `git commit -m "feat: complete admin features with pagination and csv export"`.

**Apakah ada bagian lain yang ingin Anda tambahkan di README ini, atau Anda sudah siap untuk melakukan push ke GitHub?**

```