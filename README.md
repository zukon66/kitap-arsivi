# KitapArsiv

KitapArsiv, YKS hazırlığında kullanılan test kitaplarını, konu/test ilerlemesini, koça sorulacak testleri, haftalık ders programından gelen görevleri ve koç gününde götürülecek kitapları takip etmek için geliştirilen mobil öncelikli bir web uygulamasıdır.

Ana amaç, çok fazla test kitabı taşımak yerine gerçek arşiv, haftalık program ve işaretlenen testlere göre hangi kitapların gerçekten götürülmesi gerektiğini netleştirmektir.

## Güncel Durum

Proje React + Vite uygulaması olarak çalışıyor. Supabase entegrasyonu artık ilk JSON yedek aşamasından daha ileri durumda:

- Giriş zorunlu hale getirildi.
- Supabase Auth ile Google, e-posta/şifre, kayıt olma ve magic link akışları var.
- Kullanıcı oturumu `App` seviyesinde yönetiliyor.
- Her kullanıcı için ayrı localStorage anahtarı kullanılıyor: `kitaparsiv.v1.${userId}`.
- Normalize Supabase tabloları için kod ve SQL dosyası eklendi:
  - `public.books`
  - `public.topics`
  - `public.test_results`
  - `public.program_items`
- `public.app_states` JSON yedek/fallback olarak korunuyor.
- Veri değişiklikleri 1500ms debounce ile normalize Supabase tablolarına otomatik olarak yazılıyor.
- Profil ekranında manuel `Buluta Kaydet` / `Buluttan Yükle` akışı hâlâ JSON yedek üzerinden mevcut.
- Kapak görselleri kitap eklerken veya kitabı düzenlerken Supabase Storage `covers` bucket'ına yüklenmeye çalışılıyor; başarısız olursa base64/data URL olarak saklanıyor.

Canlı Supabase projesinde normalize tablolar ve `covers` Storage bucket/policy kurulumu uygulanıp doğrulandı. Kurulumu tekrar oluşturmak için SQL dosyaları `supabase/` altındadır.

## Özellikler

- Mobil öncelikli panel ekranı.
- Kitap arşivi, arama ve filtreleme.
- Kitap ekleme, düzenleme ve silme.
- Kitap eklerken veya düzenlerken kapak görseli ekleme/değiştirme.
- Konu ekleme, düzenleme ve silme.
- Kitap ve konu toplamlarını otomatik yeniden hesaplama.
- Geçmiş çözümler için toplu başlangıç ilerlemesi.
- Test sonucu ekleme, listeleme, arama, düzenleme ve silme.
- Atlamalı test takibi:
  - `14` tek test olarak sayılır.
  - `12-14` veya `12/14` aralık olarak sayılır.
  - `3 test` toplu test olarak sayılır.
  - `karma`, `20 soru`, `deneme analizi` gibi esnek kayıtlar veri olarak tutulur ama test ilerlemesini artırmaz.
- Konu kartına tıklayınca popup içinde istatistik gösterimi.
- Koç günü ekranı:
  - ders programı JSON içe aktarma
  - içe aktarılan programı silme
  - haftalık program görevleri
  - koça sorulacaklar
  - kesin götür / götürmen iyi olur önerileri
- `ders-programi-taslak` / `sayac-program-editor` JSON formatındaki `data.tasks` okunur.
- Program görevleri arşiv kitaplarıyla eşleştirilmeye çalışılır.
- Profil ekranı:
  - kullanıcı bilgisi
  - sync durumu
  - buluta kaydet
  - buluttan yükle
  - çıkış yap
  - local ve bulut verisini sıfırlama

## Teknoloji

- React
- Vite
- CSS
- localStorage
- Supabase Auth
- Supabase Database
- Supabase Storage
- `@supabase/supabase-js`
- Material Symbols

## Proje Yapısı

```txt
.
├─ README.md
├─ claudeileyaptıklarım.md
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
│  ├─ data/
│  │  └─ sampleData.js
│  └─ utils/
│     ├─ helpers.js
│     ├─ matching.js
│     ├─ storage.js
│     └─ supabaseDB.js
├─ supabase/
│  ├─ covers_storage.sql
│  ├─ kitaparsiv_app_state.sql
│  └─ normalize_schema.sql
├─ sayfa1.html
├─ sayfa2.html
├─ sayfa3.html
├─ sayfa4.html
└─ sayfa5.html
```

`sayfa1.html` - `sayfa5.html` eski statik prototip referanslarıdır. Asıl çalışan uygulama `index.html` ve `src/` altındadır.

## Kurulum

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

## Komutlar

```bash
npm run dev
npm run build
npm run preview
```

## Ortam Değişkenleri

Supabase için `.env.local` gerekir. Örnek dosya: `.env.example`.

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`VITE_SUPABASE_PUBLISHABLE_KEY` tarayıcı tarafında kullanılır. Service role key veya gizli anahtar frontend'e konulmamalıdır.

`.env.local` değiştirildikten sonra Vite dev server yeniden başlatılmalıdır.

## Supabase

Proje:

- Ad: `KitapArsiv`
- Region: `eu-central-1`
- Project ref: `oatiiyggnejqwxroobpq`

SQL dosyaları:

- `supabase/kitaparsiv_app_state.sql`: JSON yedek/fallback tablosu.
- `supabase/normalize_schema.sql`: normalize uygulama tabloları.
- `supabase/covers_storage.sql`: `covers` Storage bucket ve RLS policy kurulumu.

Normalize tablo mantığı:

- Her satır `user_id` ile Supabase Auth kullanıcısına bağlıdır.
- Primary key yapısı `(id, user_id)` şeklindedir.
- RLS açıktır.
- Kullanıcı sadece kendi `user_id` değerine ait satırları okuyup yazabilir.

Storage:

- Kapak görselleri için bucket adı: `covers`.
- Kod dosyayı `${userId}/${timestamp}.${ext}` yoluna yükler.
- Bucket yoksa veya policy eksikse uygulama base64 fallback kullanır.
- Supabase Storage upsert için sadece insert yeterli değildir; select ve update izinleri de gerekir.

## Veri Akışı

1. Kullanıcı giriş yapar.
2. `loadAllFromDB(userId)` normalize Supabase tablolarını okumayı dener.
3. Normalize tabloda veri varsa uygulama state'i bu veriden kurulur.
4. Normalize tablo yoksa veya hata alınırsa kullanıcı bazlı localStorage fallback okunur.
5. Kullanıcı veri eklediğinde önce localStorage güncellenir.
6. 1500ms sonra normalize tablolar Supabase'e yazılır.
7. `app_states` sadece Profil ekranındaki manuel `Buluta Kaydet` / `Buluttan Yükle` snapshot yedeği için kullanılır.

## Google OAuth Ayarları

Google Cloud Console:

- Authorized JavaScript origins:
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
- Authorized redirect URI:
  - `https://oatiiyggnejqwxroobpq.supabase.co/auth/v1/callback`

Supabase Dashboard:

- Authentication -> Providers -> Google:
  - Google provider açıldı.
  - Google Client ID ve Client Secret girildi.
- Authentication -> URL Configuration:
  - Site URL: `http://127.0.0.1:5173`
  - Redirect URLs:
    - `http://127.0.0.1:5173`
    - `http://localhost:5173`

## Bilinen Riskler

- Normalize şema Supabase Dashboard'da çalıştırılmadıysa otomatik sync hata verir ve uygulama localStorage fallback ile devam eder.
- `covers` bucket'ı veya Storage policy'leri eksikse kapak görselleri base64 olarak saklanır.
- `app_states` manuel bulut yedeği için tutuluyor; otomatik sync ana veri kaynağı olarak normalize tabloları kullanır.
- Program metinlerinden kitap/konu çıkarımı kural bazlıdır; bazı yazım farkları eşleşmeyebilir.
- Kodun önemli bir kısmı hâlâ `src/main.jsx` içinde; refactor yapılacaksa davranış korunarak küçük parçalara ayrılmalı.
- Supabase Auth advisor tarafında leaked password protection uyarısı kalabilir; bu Dashboard'dan açılacak bir Auth ayarıdır.

## Sonraki İşler

1. Kitap düzenleme ekranından kapak ekleme/değiştirme akışını gerçek hesapla test et.
2. Kitap ekleme -> otomatik sync -> çıkış/giriş sonrası veri geri yükleme akışını gerçek veriyle tekrar kontrol et.
3. Profilde manuel `Buluta Kaydet` / `Buluttan Yükle` snapshot yedeğini yeniden test et.
4. Supabase Auth Dashboard'da leaked password protection ayarını değerlendirme.
5. `data-model.md` ve eski prototip notlarını güncel mimariye göre sadeleştirme.
6. `src/main.jsx` içindeki büyük bileşenleri davranışı bozmadan küçük modüllere ayırma.
