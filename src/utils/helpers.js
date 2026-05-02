export function bookProgress(book) {
  if (!book.totalTests) return 0;
  return Math.round((book.solvedTests / book.totalTests) * 100);
}

export function recalculateBookTotals(book) {
  const totalTests = book.topics.reduce((sum, topic) => sum + (Number(topic.totalTests) || 0), 0);
  const solvedTests = book.topics.reduce((sum, topic) => sum + (Number(topic.solvedTests) || 0), 0);
  return { ...book, totalTests, solvedTests: Math.min(solvedTests, totalTests) };
}

export function getSolvedTestCountInfo(value) {
  const text = normalizeSpaces(value);
  const rangeMatch = text.match(/^(\d+)\s*[-/]\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return { count: Math.max(1, Math.abs(end - start) + 1), type: 'range' };
    }
  }
  if (/^\d+$/.test(text)) return { count: 1, type: 'single' };
  const testCount = text.match(/\b(\d+)\s*test\b/i);
  if (testCount) return { count: Math.max(1, Number(testCount[1]) || 1), type: 'count' };
  return { count: 0, type: 'flex' };
}

export function getResultSolvedCount(result) {
  if (!result) return 0;
  if (Number.isFinite(Number(result.solvedTestCount))) return Number(result.solvedTestCount);
  return getSolvedTestCountInfo(result.testNo).count || 1;
}

export function testEntryLabel(result) {
  const type = result.testEntryType ?? getSolvedTestCountInfo(result.testNo).type;
  return { single: 'Tek test', range: 'Test araligi', count: 'Toplu test', flex: 'Esnek kayit' }[type] ?? 'Test kaydi';
}

export function testResultTopicDetail(result) {
  if (result.askCoach) return 'koca sorulacak isaret var';
  const count = getResultSolvedCount(result);
  if (result.testEntryType === 'range') return `${result.testNo} araligi kaydedildi`;
  if (result.testEntryType === 'count') return `${count} test toplu kaydedildi`;
  if (result.testEntryType === 'flex') return `${result.testNo} esnek kayit`;
  return `${result.correct} dogru, ${result.wrong} yanlis`;
}

export function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeSpaces(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function normalizeText(value) {
  return normalizeSpaces(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');
}

export function topicStatusFromCounts(solved, total) {
  if (solved <= 0) return 'baslanmadi';
  if (solved >= total) return 'bitti';
  return 'devam_ediyor';
}

export function statusLabel(status) {
  return { baslanmadi: 'Başlanmadı', aktif: 'Aktif', beklemede: 'Beklemede', bitti: 'Bitti' }[status];
}

export function topicStatusLabel(status) {
  return { baslanmadi: 'Başlanmadı', devam_ediyor: 'Devam Ediyor', bitti: 'Bitti' }[status];
}

export function bookName(books, bookId) {
  return books.find((book) => book.id === bookId)?.name ?? 'Kitap';
}

export function createId(prefix, value) {
  const slug = String(value || 'item')
    .trim()
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${prefix}_${slug}_${Date.now()}`;
}
