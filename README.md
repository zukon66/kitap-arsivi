# KitapArşiv

KitapArşiv, YKS hazırlığında kullanılan test kitaplarını, konu/test ilerlemesini, koça sorulacak testleri, haftalık ders programından gelen görevleri ve koç gününde götürülecek kitapları takip etmek için geliştirilen mobil öncelikli bir web uygulamasıdır.

Ana amaç: çok fazla test kitabı taşımak yerine, gerçek arşiv, haftalık program ve işaretlenen testlere göre hangi kitapların gerçekten götürülmesi gerektiğini netleştirmek.

## Current Status

Proje şu anda React + Vite uygulaması olarak çalışıyor. Ana veri hâlâ tarayıcıdaki `localStorage` içinde tutuluyor, ancak Supabase entegrasyonunun ilk adımı eklendi:

- Supabase projesi oluşturuldu: `KitapArsiv`
- `public.app_states` tablosu oluşturuldu.
- RLS aktif ve kullanıcılar sadece kendi yedek verilerine erişebiliyor.
- Profil ekranında e-posta/şifre ile giriş ve kayıt olma akışı var.
- Giriş yapan kullanıcı yerel verisini Supabase’e JSON yedek olarak kaydedip geri yükleyebiliyor.

Supabase entegrasyonu şu an normalize kitap/konu/test tabloları değil, tek kullanıcıya ait JSON bulut yedeği şeklindedir. Bu, mevcut localStorage veri modelini bozmadan PC/telefon ortak kullanımına geçiş için ilk güvenli adımdır.

## Features

- Mobil öncelikli panel ekranı.
- Kitap arşivi.
- Arşivde kitap arama ve filtreleme.
- Kitap ekleme:
  - kitap adı
  - yayın
  - ders
  - TYT/AYT
  - durum
  - ilk konu
  - toplam test sayısı
  - geçmiş çözülmüş test sayısı
  - kapak görseli
- Kitap düzenleme ve silme.
- Konu ekleme, düzenleme ve silme.
- Konu silinirse bağlı test kayıtları da temizlenir.
- Kitap ve konu toplamları düzenleme/silme sonrası otomatik yeniden hesaplanır.
- Geçmiş çözümler için toplu başlangıç ilerlemesi.
- Test sonucu kaydı:
  - kitap
  - konu
  - test no / test aralığı / esnek kayıt
  - doğru
  - yanlış
  - boş
  - çözüldü / yanlışlı / koça sor
  - koç notu
- Atlamalı test takibi:
  - `14` tek test olarak sayılır.
  - `12-14` veya `12/14` aralık olarak sayılır.
  - `3 test` toplu test olarak sayılır.
  - `karma`, `20 soru`, `deneme analizi` gibi kayıtlar veri olarak tutulur ama test ilerlemesini artırmaz.
- Test kayıtlarını listeleme, arama, düzenleme ve silme.
- Kitap detayında konu dağılımı ve ilerleme.
- Konu kartına tıklayınca popup içinde istatistik gösterimi:
  - çözülen/kalan test
  - başlangıç ilerlemesi
  - takipli test sayısı
  - doğruluk oranı
  - koça sor sayısı
  - doğru/yanlış/boş toplamı
  - konuya bağlı test kayıtları
- Koç günü ekranı:
  - ders programı JSON içe aktarma
  - içe aktarılan programı silme
  - haftalık programdan gelen görevler
  - koça sorulacaklar
  - kesin götür
  - götürmen iyi olur
- `ders-programi-taslak` / `sayac-program-editor` JSON formatından `data.tasks` okunur.
- Program görevleri arşivdeki kitaplarla eşleştirilmeye çalışılır.
- Eşleşen/eşleşmeyen program görevleri kullanıcıya gösterilir.
- Profil ekranı:
  - local veriyi sıfırlama
  - Supabase giriş/kayıt
  - Supabase bulut yedeği kaydetme
  - Supabase bulut yedeği yükleme
  - çıkış yapma

## Tech Stack

- React
- Vite
- CSS
- localStorage
- Supabase Auth
- Supabase Database
- `@supabase/supabase-js`
- Material Symbols ikon fontu

## Project Structure

```txt
.
├─ README.md
├─ data-model.md
├─ design.md
├─ index.html
├─ package.json
├─ package-lock.json
├─ .env.example
├─ .env.local
├─ src/
│  ├─ main.jsx
│  ├─ styles.css
│  ├─ supabaseClient.js
│  └─ data/
│     └─ sampleData.js
├─ supabase/
│  └─ kitaparsiv_app_state.sql
├─ sayfa1.html
├─ sayfa2.html
├─ sayfa3.html
├─ sayfa4.html
└─ sayfa5.html
```

Notlar:

- `sayfa1.html` - `sayfa5.html` eski statik prototip referanslarıdır.
- Asıl çalışan React uygulaması `index.html` ve `src/` altındadır.
- `data-model.md` veri kararlarının kaynak dokümanıdır.
- `design.md` tasarım dili referansıdır.
- `supabase/kitaparsiv_app_state.sql` Supabase tarafında uygulanan ilk RLS şemasını içerir.

## Setup

Bağımlılıkları kur:

```bash
npm install
```

Geliştirme sunucusunu başlat:

```bash
npm run dev
```

Varsayılan yerel adres:

```txt
http://127.0.0.1:5173/
```

Kullanışlı hash adresleri:

```txt
http://127.0.0.1:5173/#library
http://127.0.0.1:5173/#add
http://127.0.0.1:5173/#coach
http://127.0.0.1:5173/#profile
```

## Available Scripts

```bash
npm run dev
```

Vite geliştirme sunucusunu `127.0.0.1` üzerinde başlatır.

```bash
npm run build
```

Production build alır.

```bash
npm run preview
```

Vite preview sunucusunu `127.0.0.1` üzerinde başlatır.

## Environment Variables

Supabase için `.env.local` gerekir. Örnek dosya: `.env.example`.

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`VITE_SUPABASE_PUBLISHABLE_KEY` tarayıcı tarafında kullanılabilen publishable key’dir. Service role key veya gizli anahtar frontend’e konulmamalıdır.

`.env.local` değiştirildikten sonra Vite dev server yeniden başlatılmalıdır.

## Supabase

Oluşturulan proje:

- Ad: `KitapArsiv`
- Region: `eu-central-1`
- Project ref: `oatiiyggnejqwxroobpq`

Uygulanan tablo:

- `public.app_states`

Tablo mantığı:

- Her kullanıcı için tek satır bulunur.
- `user_id` alanı `auth.users.id` ile ilişkilidir.
- `data` alanında kitaplar, konular, test kayıtları ve program görevleri JSON olarak saklanır.
- RLS açıktır.
- Kullanıcı sadece kendi `user_id` değerine ait satırı okuyabilir/yazabilir.

## Implementation Notes

- İlk açılışta `src/data/sampleData.js` içindeki örnek veriler kullanılır.
- Kullanıcı kitap, konu, test sonucu veya program JSON’u eklediğinde veriler `kitaparsiv.v1` anahtarıyla localStorage içine yazılır.
- Supabase’e giriş yapılırsa aynı veri `app_states.data` alanına JSON yedek olarak kaydedilebilir.
- Supabase’den yükleme yapılırsa buluttaki JSON yedek localStorage verisinin üzerine yazılır.
- Geçmiş testler tek tek girilmez; kitap/konu eklerken başlangıç ilerlemesi olarak tutulur.
- Bundan sonra çözülen testler detaylı doğru/yanlış/boş olarak kaydedilir.
- Test aralığı girilirse ilerleme aralıktaki test sayısı kadar artar.
- Esnek kayıtlar veri olarak saklanır ama toplam test ilerlemesini artırmaz.
- `Koça Sor` seçilen sonuçlar koç günü ekranında görünür ve kitap önerilerini etkiler.
- Kitap kapağı şu an base64/data URL olarak localStorage içinde tutulur.
- Profildeki `Ornek Verileri Sil` butonu kitapları, test kayıtlarını ve program görevlerini boşaltır.
- Koç ekranındaki JSON içe aktarma, `sayac-program-editor` dışa aktarımındaki `data.tasks` nesnesini okur.
- Program görevleri ders/gün anahtarından ve görev metninden kitap, konu ve test bilgisi çıkarılarak saklanır.

## Completed Work

- Fikir netleştirme: kitap arşivi, test takibi, koç günü ve kesin götür mantığı belirlendi.
- Statik HTML prototipleri YKS senaryosuna göre Türkçeleştirildi.
- Statik ekran akışı panel, arşiv, test sonucu, kitap detayı ve koç günü ekranlarına dönüştürüldü.
- `data-model.md` oluşturuldu.
- React + Vite uygulama iskeleti kuruldu.
- localStorage ile gerçek veri girişi eklendi.
- Ders programı JSON içe aktarma eklendi.
- Program görevlerini arşiv kitaplarıyla eşleştirme güçlendirildi.
- İçe aktarılan programı silme eklendi.
- Kitap ve konu düzenleme/silme eklendi.
- Arşiv arama/filtreleme eklendi.
- Test kayıtlarını düzenleme/silme eklendi.
- Atlamalı/esnek test takibi eklendi.
- Konu istatistik popup’ı eklendi.
- Supabase projesi oluşturuldu.
- Supabase Auth giriş/kayıt ekranı eklendi.
- Supabase JSON bulut yedekleme/yükleme eklendi.

## Next Steps

Önerilen sıradaki işler:

1. Supabase login/signup akışını gerçek e-posta ile tarayıcıda test etmek.
2. Supabase Auth ayarlarında redirect URL’leri kontrol etmek.
3. Buluta kaydet / buluttan yükle akışını gerçek kullanıcıyla doğrulamak.
4. Kapak görsellerini localStorage/base64 yerine Supabase Storage’a taşımak.
5. `app_states` JSON yedeğinden normalize tablolara geçiş planlamak:
   - books
   - topics
   - test_results
   - program_items
6. Ders programı uygulamasıyla dosya içe aktarma dışında daha doğrudan entegrasyon seçeneği değerlendirmek.

## Known Risks

- localStorage hâlâ ana çalışma katmanıdır; Supabase şu an otomatik canlı senkron değil, manuel yedekleme/yükleme mantığıdır.
- Supabase’den yükleme local verinin üzerine yazar; bu yüzden kullanıcıdan onay alınır.
- Kapak fotoğrafları localStorage içinde base64 olarak tutulduğu için büyük görseller uzun vadede sorun çıkarabilir.
- Supabase Storage henüz kullanılmıyor.
- Program metinlerinden kitap adı/konu çıkarımı hâlâ kural bazlıdır; bazı yazım farkları eşleşmeyebilir.
- README `.env.local` değerlerini bilinçli olarak içermez.
