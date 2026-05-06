# Konu Dagilimi JSON Semasi ve Master Prompt

Bu dosya, bir test kitabinin konu listesini ChatGPT, Claude veya Gemini ile KitapArsiv uygulamasina uygun JSON formatina cevirmek icin kullanilir.

## Uygulamanin Bekledigi JSON

```json
{
  "type": "kitaparsiv-topic-distribution",
  "version": 1,
  "book": {
    "name": "Kitap adi",
    "publisher": "Yayin adi",
    "examType": "TYT",
    "subject": "Matematik",
    "catalog": "Soru Bankasi"
  },
  "topics": [
    {
      "order": 1,
      "name": "Temel Kavramlar",
      "totalTests": 12,
      "solvedTests": 0,
      "detail": "Sayfa veya unite notu varsa buraya yaz"
    }
  ]
}
```

## Zorunlu Alanlar

- `topics`: konu dizisi.
- `topics[].name`: konu adi.
- `topics[].totalTests`: o konudaki toplam test sayisi. Bilmiyorsan `0` yaz.

## Opsiyonel Alanlar

- `book`: kitap bilgisi. Uygulama import icin zorunlu tutmaz.
- `topics[].order`: konu sirasi.
- `topics[].solvedTests`: genelde `0` yaz.
- `topics[].detail`: unite, sayfa araligi, bolum notu gibi ek bilgi.

## Master Prompt

Asagidaki promptu ChatGPT, Claude veya Gemini'ye ver. Kitabin icindekiler/kazanimlar/konu dagilimi sayfasinin fotografini da ekleyebilir veya metin olarak tarif edebilirsin.

```txt
Sen bir YKS test kitabi konu dagilimi donusturme asistani olarak calis.

Gorevin:
Verilen kitap icerigi, fotograf, OCR metni veya kullanici tarifinden konu dagilimini cikar ve KitapArsiv uygulamasina uygun JSON uret.

Kesin kurallar:
1. Sadece gecerli JSON dondur. Markdown, aciklama, yorum, kod blogu kullanma.
2. JSON kok nesnesi su alanlari icersin:
   - type: "kitaparsiv-topic-distribution"
   - version: 1
   - book
   - topics
3. topics bir dizi olmali.
4. Her topic nesnesinde su alanlar olmali:
   - order: sayi
   - name: konu adi
   - totalTests: sayi
   - solvedTests: 0
   - detail: string
5. Konu adlarini kisa, temiz ve tekrar etmeyecek sekilde yaz.
6. Unite basliklari test sayisi icermiyorsa topic olarak yazma; sadece alt konulari topic yap. Eger sadece unite basliklari varsa unite basliklarini topic yap.
7. Test sayisi net okunmuyorsa totalTests alanina 0 yaz ve detail alanina "test sayisi net okunamadi" yaz.
8. Bir konu birden fazla sayfada/parcada geciyorsa tek topic olarak birlestir.
9. Turkce karakter kullanabilirsin.
10. Emin olmadigin kisimlari uydurma; detail alanina belirsizligi yaz.

Kitap bilgisi:
- book.name: "<KITAP_ADI>"
- book.publisher: "<YAYIN>"
- book.examType: "<TYT/AYT/11. Sinif/12. Sinif/TYT-AYT>"
- book.subject: "<DERS>"
- book.catalog: "<Soru Bankasi/Konu Anlatimli Soru Bankasi/Paragraf/Geometri/Problem/Deneme/Konu Anlatim>"

Cikti formati:
{
  "type": "kitaparsiv-topic-distribution",
  "version": 1,
  "book": {
    "name": "<KITAP_ADI>",
    "publisher": "<YAYIN>",
    "examType": "<TUR>",
    "subject": "<DERS>",
    "catalog": "<KATALOG>"
  },
  "topics": [
    {
      "order": 1,
      "name": "Konu adi",
      "totalTests": 0,
      "solvedTests": 0,
      "detail": ""
    }
  ]
}

Simdi verecegim kitap iceriginden bu JSON'u uret.
```

## Kullanim Notu

Uygulamada kitap detayina gir, `Konu Dagilimi` bolumunden `JSON Ice Aktar` tusuna bas ve bu prompttan gelen `.json` dosyasini sec.

Iceri aktarma mevcut konu dagilimini degistirir. O kitaba bagli detayli test kayitlari varsa konu id'leri degisecegi icin temizlenir.
