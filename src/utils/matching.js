import { normalizeText, normalizeSpaces } from './helpers';

export function getBringRecommendations(books, testResults, currentProgramItems) {
  const recommendations = [];
  const askCoachBookIds = new Set(testResults.filter((r) => r.askCoach).map((r) => r.bookId));

  books.forEach((book) => {
    const programMatch = currentProgramItems.find((item) => isProgramBookMatch(item, book));
    const hasCoachQuestion = askCoachBookIds.has(book.id);

    if (hasCoachQuestion || programMatch) {
      recommendations.push({
        book,
        level: 'kesin_gotur',
        reasons: [
          hasCoachQuestion
            ? 'Koça sorulacak işaretli test var'
            : `${programMatch.topicName} • Haftalık programda kitap adıyla geçiyor`,
        ],
      });
      return;
    }

    const topicMatch = currentProgramItems.find((item) => getTopicMatch(book, item));
    if (topicMatch && book.status === 'aktif') {
      recommendations.push({
        book,
        level: 'kesin_gotur',
        reasons: [`${getTopicMatch(book, topicMatch)?.name ?? 'Konu'} - Haftalik programdaki konu aktif kitapta var`],
      });
      return;
    }

    if (topicMatch) {
      recommendations.push({
        book,
        level: 'goturmen_iyi_olur',
        reasons: [`${book.topics[0]?.name ?? 'Konu'} • Aynı konu bu kaynakta da var`],
      });
    }
  });

  return recommendations;
}

export function parseProgramExport(exportJson, books = [], matchRules = []) {
  const tasks = exportJson?.data?.tasks;
  if (!tasks || typeof tasks !== 'object') throw new Error('tasks alanı bulunamadı');

  return Object.entries(tasks)
    .filter(([, rawText]) => String(rawText).trim())
    .map(([key, rawText], index) => {
      const [subjectKey, ...dayParts] = key.split('-');
      const day = normalizeProgramDay(dayParts.join('-'));
      const text = normalizeSpaces(rawText);
      const archiveMatch = findBestBookMatch(text, books, matchRules);
      const bookName = archiveMatch?.book.name ?? inferBookName(text);

      return {
        id: `program_import_${index}_${Date.now()}`,
        source: exportJson.app || 'ders_programi',
        day,
        rawText: text,
        bookName,
        matchedBookId: archiveMatch?.book.id ?? '',
        matchedBookName: archiveMatch?.book.name ?? '',
        matchType: archiveMatch?.type ?? 'none',
        matchScore: archiveMatch?.score ?? 0,
        matchReason: archiveMatch?.reason ?? '',
        subject: subjectLabel(subjectKey),
        topicName: inferTopicName(text, bookName),
        testRange: inferTestRange(text),
        isRequired: true,
      };
    });
}

export function isProgramBookMatch(item, book) {
  if (item.matchedBookId && item.matchedBookId === book.id) return true;
  const bookNorm = normalizeText(book.name);
  if (!bookNorm) return false;
  return normalizeText(item.bookName) === bookNorm
    || normalizeText(item.rawText).includes(bookNorm)
    || compactTextForMatch(item.rawText).includes(compactTextForMatch(book.name))
    || getBookAliases(book).some((alias) => compactTextForMatch(item.rawText).includes(alias.compact));
}

export function getTopicMatch(book, programItem) {
  const rawText = normalizeText(programItem.rawText);
  const topicName = normalizeText(programItem.topicName);
  return book.topics.find((topic) => {
    const normalizedTopic = normalizeText(topic.name);
    return normalizedTopic && (rawText.includes(normalizedTopic) || topicName.includes(normalizedTopic));
  });
}

export function findBestBookMatch(text, books, matchRules = []) {
  const normalizedText = normalizeText(text);
  const compactText = compactTextForMatch(text);
  let bestMatch = null;

  const manualRule = findManualRuleMatch(normalizedText, compactText, matchRules, books);
  if (manualRule) return manualRule;

  books.forEach((book) => {
    const candidates = getBookAliases(book);

    candidates.forEach((candidate) => {
      const normalizedCandidate = normalizeText(candidate.value);
      const compactCandidate = candidate.compact;
      if (!normalizedCandidate) return;

      let score = 0;
      let reason = 'token_match';
      if (normalizedText.includes(normalizedCandidate)) {
        score = candidate.baseScore;
        reason = 'normalized_phrase_match';
      } else if (compactText.includes(compactCandidate)) {
        score = candidate.baseScore - 4;
        reason = 'compact_alias_match';
      }
      else score = tokenMatchScore(normalizedText, normalizedCandidate);

      if (score >= 58 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { book, score, type: candidate.type, reason };
      }
    });
  });

  return bestMatch;
}

function tokenMatchScore(text, candidate) {
  const textTokens = new Set(text.split(/\s+/).filter(Boolean).map(normalizeBookToken));
  const candidateTokens = candidate
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .map(normalizeBookToken)
    .filter((t) => t && !BOOK_MATCH_STOP_WORDS.has(t));

  if (candidateTokens.length === 0) return 0;
  const matchedTokens = candidateTokens.filter((t) => textTokens.has(t));
  const ratio = matchedTokens.length / candidateTokens.length;
  const hasDistinctiveToken = matchedTokens.some((t) => t.length >= 5 || /\d/.test(t));
  if (!hasDistinctiveToken) return 0;
  return Math.round(ratio * 86);
}

function findManualRuleMatch(normalizedText, compactText, matchRules, books) {
  for (const rule of matchRules) {
    const pattern = normalizeText(rule.normalizedPattern || rule.pattern);
    const compactPattern = compactTextForMatch(pattern);
    if (!pattern || !rule.bookId) continue;
    if (!normalizedText.includes(pattern) && !compactText.includes(compactPattern)) continue;

    const book = books.find((item) => item.id === rule.bookId);
    if (book) {
      return {
        book,
        score: 120,
        type: 'manual_rule',
        reason: 'manual_rule_match',
      };
    }
  }
  return null;
}

function getBookAliases(book) {
  const values = [
    { value: book.name, type: 'archive_name', baseScore: 100 },
    { value: `${book.publisher} ${book.name}`, type: 'publisher_name', baseScore: 96 },
    { value: `${book.name} ${book.subject}`, type: 'subject_name', baseScore: 90 },
    ...expandAliasValues(book.name).map((value) => ({ value, type: 'alias_name', baseScore: 94 })),
    ...expandAliasValues(`${book.publisher} ${book.name}`).map((value) => ({ value, type: 'publisher_alias', baseScore: 90 })),
  ];

  const seen = new Set();
  return values
    .map((candidate) => ({
      ...candidate,
      value: normalizeSpaces(candidate.value),
      compact: compactTextForMatch(candidate.value),
    }))
    .filter((candidate) => {
      if (!candidate.value || seen.has(candidate.compact)) return false;
      seen.add(candidate.compact);
      return true;
    });
}

function expandAliasValues(value) {
  const normalized = normalizeText(value);
  const aliases = new Set();
  const replacements = [
    ['orjinal', 'orijinal'],
    ['orijinal', 'orjinal'],
    ['mikro orijinal', 'mikroorijinal'],
    ['mikro orijinal', 'mikro orjinal'],
    ['mikro orjinal', 'mikroorjinal'],
    ['bilgi sarmal', 'bilgisarmal'],
    ['kafa dengi', 'kafadengi'],
    ['kafadengi', 'kafa dengi'],
    ['uc dort bes', '345'],
    ['345', 'uc dort bes'],
    ['ucdortbes', '345'],
  ];

  replacements.forEach(([from, to]) => {
    if (normalized.includes(from)) aliases.add(normalized.replaceAll(from, to));
  });

  aliases.add(compactTextForMatch(normalized));
  return [...aliases].filter(Boolean);
}

function compactTextForMatch(value) {
  return normalizeAliasText(value).replace(/[^a-z0-9]/g, '');
}

function normalizeAliasText(value) {
  return normalizeText(value)
    .replaceAll('orjinal', 'orijinal')
    .replaceAll('mikroorjinal', 'mikroorijinal')
    .replaceAll('bilgisarmal', 'bilgi sarmal')
    .replaceAll('kafadengi', 'kafa dengi')
    .replaceAll('ucdortbes', '345');
}

function normalizeBookToken(token) {
  return token
    .replace('orjinal', 'orijinal')
    .replace('mikroorjinal', 'mikroorijinal')
    .replace('bilgisarmal', 'bilgi')
    .replace('kafadengi', 'dengi')
    .replace('ucdortbes', '345')
    .replace('paragrafin', 'paragraf');
}

const BOOK_MATCH_STOP_WORDS = new Set(['tyt', 'ayt', 'yayin', 'yayinlari', 'kitap', 'test', 'soru', 'coz']);

function inferBookName(text) {
  const normalized = normalizeText(text);
  const knownBooks = [
    ['mikro orijinal', 'Mikro Orijinal'], ['mikro orjinal', 'Mikro Orijinal'],
    ['mikroorjinal', 'Mikro Orijinal'], ['bilgi sarmal', 'Bilgi Sarmal'],
    ['kafadengi', 'Kafadengi'], ['apotemi', 'Apotemi'],
    ['periskop', 'Periskop'], ['sonuc', 'Sonuç'],
  ];
  return knownBooks.find(([needle]) => normalized.includes(needle))?.[1] || '';
}

function inferTopicName(text, bookNameStr) {
  let cleaned = normalizeSpaces(text)
    .replace(/\b\d+\s*test\b/gi, '').replace(/\btest\s*\d+([-/]\d+)?\b/gi, '')
    .replace(/\b\d+\s+\d+\b/g, '').replace(/\bçöz\b/gi, '').trim();
  if (bookNameStr) cleaned = cleaned.replace(new RegExp(bookNameStr, 'i'), '').trim();
  return normalizeSpaces(cleaned) || 'Genel';
}

function inferTestRange(text) {
  const testRange = String(text).match(/test\s*(\d+\s*[-/]\s*\d+|\d+)/i);
  if (testRange) return testRange[1].replace(/\s/g, '');
  const looseRange = String(text).match(/\b(\d+\s+\d+)\b/);
  if (looseRange) return looseRange[1].trim().replace(/\s+/, '-');
  const count = String(text).match(/\b(\d+)\s*test\b/i);
  if (count) return `${count[1]} test`;
  const questionCount = String(text).match(/\b(\d+)\s*soru\b/i);
  if (questionCount) return `${questionCount[1]} soru`;
  return '';
}

function normalizeProgramDay(day) {
  const cleaned = normalizeSpaces(day).replace(/_/g, ' ');
  return cleaned || 'Belirtilmedi';
}

function subjectLabel(subjectKey) {
  return {
    matematik: 'Matematik', geometri: 'Geometri', turkce: 'Türkçe',
    fizik: 'Fizik', kimya: 'Kimya', biyoloji: 'Biyoloji',
  }[normalizeText(subjectKey)] || subjectKey;
}
