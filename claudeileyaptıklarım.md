# Claude ile Yaptıklarım — KitapArşiv Projesi

Bu dosya, Claude Code ile gerçekleştirilen geliştirme oturumunun detaylı kaydıdır.

---

## 1. Giriş Ekranı (Login Gating)

**Sorun:** Uygulama, hesap açılmadan da kullanılabiliyordu.

**Çözüm:**
- Session yönetimi `SupabaseProfile` bileşeninden alınıp `App` üst bileşenine taşındı.
- `authLoading` ve `session` state'leri `App`'e eklendi.
- Uygulama açılışında `supabase.auth.getSession()` çağrılır; session yoksa `<LoginScreen />` render edilir.
- `onAuthStateChange` ile oturum değişiklikleri (giriş/çıkış) anlık takip edilir.
- Yeni bileşenler: `LoadingScreen` (Supabase yanıtı beklenirken), `LoginScreen` (tam ekran giriş formu).

---

## 2. Google OAuth Desteği

**İstenen özellik:** Email/şifre ve magic link'e ek olarak Google hesabıyla giriş.

**Yapılanlar:**
- `LoginScreen`'e Google ile Giriş Yap butonu eklendi (`GoogleIcon` SVG bileşeni).
- `supabase.auth.signInWithOAuth({ provider: 'google', options: { queryParams: { prompt: 'select_account' } } })` çağrısı eklendi.
- `prompt: 'select_account'` ile her girişte Google hesap seçici açılır (aynı hesaba kilitlenme sorunu çözüldü).

**Gerekli kurulum (kullanıcı tarafında):**
1. Google Cloud Console → Yeni OAuth 2.0 istemcisi oluştur (Web application).
2. Authorized redirect URI olarak Supabase callback URL'sini ekle.
3. Client ID ve Client Secret'ı Supabase Dashboard → Authentication → Providers → Google'a gir.

---

## 3. Çoklu Hesap Veri İzolasyonu

**Sorun:** Farklı hesaplarla giriş yapılınca aynı localStorage verisi görünüyordu.

**Çözüm (`src/utils/storage.js`):**
- localStorage anahtarı `kitaparsiv.v1` → `` `kitaparsiv.v1.${userId}` `` olarak değiştirildi.
- Her kullanıcı kendi ayrı localStorage alanına yazar/okur.
- Hesap değişiminde `onAuthStateChange` yeni kullanıcının verisini yükler.

---

## 4. Otomatik Bulut Senkronizasyonu

**Özellik:** Veriler her değiştiğinde otomatik olarak Supabase'e yazılır.

**Yapılanlar (`src/main.jsx`):**
- `syncStatus` state'i eklendi: `'idle' | 'syncing' | 'synced' | 'error'`
- `autoSync` fonksiyonu 1500ms debounce ile çalışır (hızlı değişikliklerde API'yi patlatmaz).
- `updateData` her çağrıldığında localStorage'a yazar + debounced sync başlatır.
- Topbar'da `<SyncIndicator />` bileşeni sync durumunu gösterir (dönen ikon / yeşil tik / kırmızı X).

---

## 5. Normalize Supabase Tabloları

**Önceki durum:** Tüm veri tek bir `app_states` tablosunda JSON blob olarak saklanıyordu.

**Yeni yapı (`supabase/normalize_schema.sql`):**

| Tablo | İçerik |
|-------|--------|
| `books` | Kitap bilgileri (isim, yayınevi, ders, durum, toplam/çözülen test...) |
| `topics` | Konular (kitaba bağlı, başlangıç/takip edilen çözülen test sayıları) |
| `test_results` | Test sonuçları (doğru/yanlış/boş, tarih, koç sorusu...) |
| `program_items` | Haftalık ders programı maddeleri |

**Özellikler:**
- Her tablo `user_id uuid references auth.users(id) on delete cascade` ile kullanıcıya bağlı.
- Primary key: `(id, user_id)` composite — upsert güvenliği için.
- Tüm tablolarda Row Level Security (RLS) aktif: select/insert/update/delete policy'leri `auth.uid() = user_id` kontrolü yapar.

**SQL dosyasını uygulamak için:** Supabase Dashboard → SQL Editor → `supabase/normalize_schema.sql` içeriğini yapıştır ve çalıştır.

---

## 6. Kapak Resmi Storage Desteği

**Özellik:** Kitap kapak resimleri Supabase Storage'a yüklenir (base64 yerine URL).

**Yapılanlar:**
- `ImagePicker` bileşeni `userId` prop alır.
- Resim seçilince önce `supabase.storage.from('covers').upload(...)` denenir.
- Storage başarısızsa (bucket yoksa veya hata) base64'e düşer — geriye dönük uyumluluk.
- `FilteredLibrary` ve `BookForm` bileşenleri `userId` prop'u alır.

**Storage bucket'ı oluşturmak için:** Supabase Dashboard → Storage → New bucket → `covers` (public).

---

## 7. main.jsx Dosya Bölümlenmesi

**Sorun:** `main.jsx` 2000+ satıra ulaşmıştı, bakımı zorlaşıyordu.

**Çıkarılan dosyalar:**

### `src/utils/helpers.js`
Saf yardımcı fonksiyonlar:
- `bookProgress`, `recalculateBookTotals`, `getSolvedTestCountInfo`, `getResultSolvedCount`
- `testEntryLabel`, `testResultTopicDetail`, `clampNumber`
- `normalizeSpaces`, `normalizeText`
- `topicStatusFromCounts`, `statusLabel`, `topicStatusLabel`, `bookName`, `createId`

### `src/utils/matching.js`
Kitap/program eşleştirme mantığı:
- `getBringRecommendations` — hangi kitapların götürülmesi gerektiğini hesaplar
- `parseProgramExport` — haftalık program JSON'unu parse eder
- `isProgramBookMatch`, `getTopicMatch`, `findBestBookMatch`
- Token tabanlı skor hesaplama, stop words, metin normalleştirme

### `src/utils/storage.js`
localStorage işlemleri:
- `storageKey(userId)`, `emptyState()`
- `loadStoredState(userId)`, `saveStoredState(userId, books, results, programItems)`

### `src/utils/supabaseDB.js`
Supabase CRUD işlemleri:
- `upsertBook`, `deleteBook`, `fetchBooks`
- `upsertTopic`, `deleteTopic`, `fetchTopics`
- `upsertTestResult`, `deleteTestResult`, `fetchTestResults`
- `replaceProgramItems`, `fetchProgramItems`
- `loadAllFromDB(userId)` — tüm tabloları yükler, JS state formatına çevirir
- Format dönüştürücüler: `dbBookToJs`, `dbTopicToJs`, `dbResultToJs`, `dbProgramItemToJs`

---

## 8. CSS Eklemeleri (`src/styles.css`)

Yeni eklenen stiller:
- `.login-screen`, `.login-card`, `.login-brand` — tam ekran giriş sayfası
- `.google-button` — Google giriş butonu
- `.login-divider` — "veya" ayırıcı çizgi
- `.login-message`, `.error-message`, `.field-error` — form geri bildirimleri
- `.sync-indicator` + `.syncing` / `.synced` / `.sync-error` — senkron durum göstergesi
- `.topbar-right` — topbar sağ bölümü
- `.profile-user-row`, `.profile-user-avatar` — profil sayfası kullanıcı bilgisi
- `.secondary-button.full-width`, `.divider-line` — profil sayfası butonları
- `@keyframes spin` — senkron ikonunun döndürme animasyonu

---

## 9. Veri Yükleme Akışı

```
Kullanıcı giriş yapar
    ↓
loadUserData() çağrılır
    ↓
loadAllFromDB(userId) → Supabase normalize tabloları
    ↓ (eğer veri boşsa)
loadStoredState(userId) → localStorage fallback
    ↓
State güncellenir, uygulama render edilir
```

---

## 10. Yapılacaklar (Deferred)

Aşağıdaki adımlar kullanıcı tarafından yapılması gereken kurulum adımları veya ertelenen özelliklerdir:

- [ ] `supabase/normalize_schema.sql` dosyasını Supabase SQL Editor'da çalıştır
- [ ] Supabase Dashboard → Storage → `covers` bucket'ını oluştur (public)
- [ ] Vercel'e deploy et:
  - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Supabase Dashboard → Authentication → URL Configuration → Site URL = Vercel URL
  - Google Cloud Console → OAuth istemcisi → Redirect URI'ye Vercel URL'sini ekle

---

## Özet

Bu oturumda KitapArşiv projesi:
- Korumalı hale getirildi (giriş zorunluluğu)
- Google OAuth ile genişletildi
- Çoklu hesap desteği düzeltildi
- Supabase normalize tablolarla gerçek veritabanı yapısına kavuştu
- Otomatik senkronizasyon kazandı
- Kodbase bakımı kolaylaştırıldı (4 yardımcı modüle bölündü)
