# KitapArsiv Veri Modeli

## Amac
Bu belge KitapArsiv uygulamasinin ilk veri modelini tanimlar. Hedef, YKS kitaplarini, konu-test dagilimlarini, test sonuclarini, haftalik koc programini ve "kesin gotur" onerilerini tutarli bir yapida saklamaktir.

Bu asamada backend, hesap sistemi veya API yoktur. Model, sonraki asamada gercek uygulama yapisina gecmek icin referans olarak kullanilacaktir.

## Temel Kararlar
- Test sonuclarinda dogru, yanlis ve bos sayilari tutulacak.
- Eski cozulmus testler tek tek girilmeyecek; bunun yerine konu bazli baslangic ilerlemesi girilecek.
- Kitap durumlari: `baslanmadi`, `aktif`, `beklemede`, `bitti`.
- Kitap/konu/test dagilimi ilk asamada elle girilecek.
- Koc programi genelde kitap adi ile gelir: `Apotemi Problemler Test 12-14 coz`.
- `Koca Sor` isareti test sonucu girerken eklenebilir.
- Bir kitap "kesin gotur" olabilir, "goturmen iyi olur" olabilir veya hic onerilmeyebilir.

## Veri Tipleri

### Book
Bir fiziksel test kitabini temsil eder.

```json
{
  "id": "book_345_tyt_matematik",
  "name": "345 TYT Matematik",
  "publisher": "345 Yayınları",
  "examType": "TYT",
  "subject": "Matematik",
  "status": "aktif",
  "isActiveRotation": true,
  "totalTests": 60,
  "solvedTests": 41,
  "notes": "Aktif dongude, problemler agirlikli kullaniliyor."
}
```

Alanlar:
- `id`: Kitabin benzersiz kimligi.
- `name`: Kitap adi.
- `publisher`: Yayin adi.
- `examType`: `TYT`, `AYT` veya `TYT-AYT`.
- `subject`: Ana ders.
- `status`: `baslanmadi`, `aktif`, `beklemede`, `bitti`.
- `isActiveRotation`: Kitap aktif calisma dongusunde mi?
- `totalTests`: Kitaptaki toplam test sayisi.
- `solvedTests`: Toplam cozulmus test sayisi.
- `notes`: Serbest not.

### Topic
Bir kitabin icindeki konu/test grubunu temsil eder.

```json
{
  "id": "topic_345_problemler",
  "bookId": "book_345_tyt_matematik",
  "name": "Problemler",
  "totalTests": 15,
  "solvedTests": 15,
  "initialSolvedTests": 10,
  "trackedSolvedTests": 5,
  "accuracy": 72,
  "status": "bitti"
}
```

Alanlar:
- `bookId`: Konunun bagli oldugu kitap.
- `name`: Konu adi.
- `totalTests`: Konudaki toplam test sayisi.
- `solvedTests`: Toplam cozulmus test sayisi.
- `initialSolvedTests`: Uygulamayi kullanmaya baslamadan once cozulmus kabul edilen test sayisi.
- `trackedSolvedTests`: Uygulama icinde detayli girilen test sayisi.
- `accuracy`: Detayli girilen testlerden hesaplanan dogruluk yuzdesi. Eski toplu girisler dogruluga dahil edilmez.
- `status`: `baslanmadi`, `devam_ediyor`, `bitti`.

### TestResult
Uygulama kullanilmaya basladiktan sonra girilen tekil test sonucunu temsil eder.

```json
{
  "id": "result_001",
  "bookId": "book_apotemi_problemler",
  "topicId": "topic_apotemi_problemler",
  "testNo": "14",
  "correct": 24,
  "wrong": 6,
  "empty": 0,
  "status": "koca_sor",
  "askCoach": true,
  "coachNote": "7. soruda yöntem seçimi karıştı.",
  "solvedAt": "2026-05-02"
}
```

Alanlar:
- `testNo`: Kitaptaki test numarasi.
- `correct`: Dogru sayisi.
- `wrong`: Yanlis sayisi.
- `empty`: Bos sayisi.
- `status`: `cozuldu`, `yanlisli`, `koca_sor`.
- `askCoach`: Koca sorulacak isareti.
- `coachNote`: Koca sorulacak not.
- `solvedAt`: Cozum tarihi.

### WeeklyProgramItem
Kocun haftalik programda verdigi gorevi temsil eder.

```json
{
  "id": "program_001",
  "source": "ders_programi",
  "day": "Pazartesi",
  "rawText": "Apotemi Problemler Test 12-14 çöz",
  "bookName": "Apotemi Problemler",
  "subject": "Matematik",
  "topicName": "Problemler",
  "testRange": "12-14",
  "isRequired": true
}
```

Alanlar:
- `source`: `manuel` veya `ders_programi`.
- `rawText`: Kocun yazdigi orijinal gorev metni.
- `bookName`: Metinden gelen kitap adi.
- `subject`: Ders.
- `topicName`: Konu.
- `testRange`: Test araligi veya test numarasi.
- `isRequired`: Programda zorunlu gorulen gorev mi?

### BringRecommendation
Koc gunu icin kitap goturme onerilerini temsil eder.

```json
{
  "bookId": "book_apotemi_problemler",
  "level": "kesin_gotur",
  "reasons": [
    "Haftalık programda Apotemi Problemler Test 12-14 var.",
    "Koça sorulacak işaretli test bulunuyor."
  ]
}
```

Alanlar:
- `level`: `kesin_gotur`, `goturmen_iyi_olur`, `onerme`.
- `reasons`: Onerinin nedenleri.

## Kesin Gotur Kurallari

1. Bir kitapta `askCoach: true` olan test sonucu varsa kitap `kesin_gotur` olur.
2. Haftalik programda kitap adi geciyorsa ve kitap arsivde bulunuyorsa kitap `kesin_gotur` olur.
3. Haftalik programdaki konu aktif dongudeki bir kitapta varsa kitap `kesin_gotur` olur.
4. Ayni konu aktif olmayan veya beklemede olan bir kitapta varsa kitap `goturmen_iyi_olur` olabilir.
5. Kitap haftalik programla, aktif donguyle veya koca sorulacak notlarla iliskili degilse onerilmez.

Oncelik sirasi:
1. Koca sorulacak isaret
2. Haftalik programda kitap adiyla verilmis gorev
3. Haftalik programdaki konu ile aktif kitap eslesmesi
4. Ayni konuda bekleyen kaynak

## Gecmis Cozumleri Girme Mantigi

Cok fazla eski test tek tek girilmeyecek. Bunun yerine konu eklerken veya duzenlerken baslangic ilerlemesi girilecek.

Ornek:

```json
{
  "bookId": "book_345_tyt_matematik",
  "topicName": "Fonksiyonlar",
  "totalTests": 20,
  "initialSolvedTests": 12,
  "trackedSolvedTests": 0
}
```

Bu durumda uygulama:
- Konu ilerlemesini `12/20` olarak gosterir.
- Dogru/yanlis/bos istatistiklerini sadece bundan sonra girilen testlerden hesaplar.
- Eski cozumler icin ayrintili test sonucu istemez.

## Ornek Senaryo

Haftalik program:
- `Apotemi Problemler Test 12-14 çöz`
- `Aydın TYT Fizik Hareket grafik soruları çöz`
- `Paragrafın Ritmi her gün 20 soru`

Arsivdeki durum:
- `Apotemi Problemler`: aktif, koça sorulacak test var.
- `Aydın TYT Fizik`: beklemede ama programda kitap adiyla geciyor.
- `Paragrafın Ritmi`: baslanmadi, sure takibi zayif.

Koc gunu onerisi:
- `Apotemi Problemler`: kesin gotur.
- `Aydın TYT Fizik`: kesin gotur.
- `Paragrafın Ritmi`: goturmen iyi olur.

## Sonraki Asamada Kullanimi

Bu veri modeli 5. asamada statik HTML prototipinden gercek uygulama yapisina gecis icin temel alinacak. Ilk teknik uygulamada bu model local veri dosyasi veya uygulama icindeki ornek veri olarak baslayabilir; daha sonra Supabase gibi bir veritabani yapisina tasinabilir.
