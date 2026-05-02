import { supabase } from '../supabaseClient';

// ── books ─────────────────────────────────────────────────────────────

export async function fetchBooks(userId) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function upsertBook(userId, book) {
  const { error } = await supabase.from('books').upsert({
    id: book.id,
    user_id: userId,
    name: book.name,
    publisher: book.publisher ?? '',
    exam_type: book.examType ?? 'TYT',
    subject: book.subject ?? 'Matematik',
    status: book.status ?? 'aktif',
    is_active_rotation: book.isActiveRotation ?? false,
    total_tests: book.totalTests ?? 0,
    solved_tests: book.solvedTests ?? 0,
    cover_image: book.coverImage ?? '',
    notes: book.notes ?? '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id,user_id' });
  return { error };
}

export async function deleteBook(userId, bookId) {
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', bookId)
    .eq('user_id', userId);
  return { error };
}

// ── topics ────────────────────────────────────────────────────────────

export async function fetchTopics(userId) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return { data: data ?? [], error };
}

export async function upsertTopic(userId, bookId, topic) {
  const { error } = await supabase.from('topics').upsert({
    id: topic.id,
    book_id: bookId,
    user_id: userId,
    name: topic.name,
    total_tests: topic.totalTests ?? 0,
    solved_tests: topic.solvedTests ?? 0,
    initial_solved_tests: topic.initialSolvedTests ?? 0,
    tracked_solved_tests: topic.trackedSolvedTests ?? 0,
    status: topic.status ?? 'baslanmadi',
    detail: topic.detail ?? '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id,user_id' });
  return { error };
}

export async function deleteTopic(userId, topicId) {
  const { error } = await supabase
    .from('topics')
    .delete()
    .eq('id', topicId)
    .eq('user_id', userId);
  return { error };
}

// ── test_results ──────────────────────────────────────────────────────

export async function fetchTestResults(userId) {
  const { data, error } = await supabase
    .from('test_results')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function upsertTestResult(userId, result) {
  const { error } = await supabase.from('test_results').upsert({
    id: result.id,
    book_id: result.bookId,
    topic_id: result.topicId,
    user_id: userId,
    test_no: result.testNo ?? '',
    solved_test_count: result.solvedTestCount ?? 0,
    test_entry_type: result.testEntryType ?? 'single',
    correct: result.correct ?? 0,
    wrong: result.wrong ?? 0,
    empty: result.empty ?? 0,
    status: result.status ?? 'cozuldu',
    ask_coach: result.askCoach ?? false,
    coach_note: result.coachNote ?? '',
    solved_at: result.solvedAt ?? new Date().toISOString().slice(0, 10),
  }, { onConflict: 'id,user_id' });
  return { error };
}

export async function deleteTestResult(userId, resultId) {
  const { error } = await supabase
    .from('test_results')
    .delete()
    .eq('id', resultId)
    .eq('user_id', userId);
  return { error };
}

// ── program_items ─────────────────────────────────────────────────────

export async function fetchProgramItems(userId) {
  const { data, error } = await supabase
    .from('program_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return { data: data ?? [], error };
}

export async function replaceProgramItems(userId, items) {
  await supabase.from('program_items').delete().eq('user_id', userId);
  if (!items.length) return { error: null };
  const rows = items.map((item) => ({
    id: item.id,
    user_id: userId,
    source: item.source ?? 'ders_programi',
    day: item.day ?? '',
    raw_text: item.rawText ?? '',
    book_name: item.bookName ?? '',
    matched_book_id: item.matchedBookId ?? '',
    matched_book_name: item.matchedBookName ?? '',
    match_type: item.matchType ?? 'none',
    subject: item.subject ?? '',
    topic_name: item.topicName ?? '',
    test_range: item.testRange ?? '',
    is_required: item.isRequired ?? true,
  }));
  const { error } = await supabase.from('program_items').insert(rows);
  return { error };
}

// ── full load (tüm tabloları çek, uygulama state'i olarak döndür) ─────

export async function loadAllFromDB(userId) {
  const [booksRes, topicsRes, resultsRes, programRes] = await Promise.all([
    fetchBooks(userId),
    fetchTopics(userId),
    fetchTestResults(userId),
    fetchProgramItems(userId),
  ]);

  // Kitapları JS formatına çevir ve topic'leri içine göm
  const topicsByBook = {};
  (topicsRes.data ?? []).forEach((t) => {
    if (!topicsByBook[t.book_id]) topicsByBook[t.book_id] = [];
    topicsByBook[t.book_id].push(dbTopicToJs(t));
  });

  const books = (booksRes.data ?? []).map((b) => ({
    ...dbBookToJs(b),
    topics: topicsByBook[b.id] ?? [],
  }));

  const testResults = (resultsRes.data ?? []).map(dbResultToJs);
  const programItems = (programRes.data ?? []).map(dbProgramItemToJs);

  return { books, testResults, programItems };
}

// ── format converters ─────────────────────────────────────────────────

function dbBookToJs(row) {
  return {
    id: row.id,
    name: row.name,
    publisher: row.publisher,
    examType: row.exam_type,
    subject: row.subject,
    status: row.status,
    isActiveRotation: row.is_active_rotation,
    totalTests: row.total_tests,
    solvedTests: row.solved_tests,
    coverImage: row.cover_image,
    notes: row.notes,
  };
}

function dbTopicToJs(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    name: row.name,
    totalTests: row.total_tests,
    solvedTests: row.solved_tests,
    initialSolvedTests: row.initial_solved_tests,
    trackedSolvedTests: row.tracked_solved_tests,
    status: row.status,
    detail: row.detail,
  };
}

function dbResultToJs(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    topicId: row.topic_id,
    testNo: row.test_no,
    solvedTestCount: row.solved_test_count,
    testEntryType: row.test_entry_type,
    correct: row.correct,
    wrong: row.wrong,
    empty: row.empty,
    status: row.status,
    askCoach: row.ask_coach,
    coachNote: row.coach_note,
    solvedAt: row.solved_at,
  };
}

function dbProgramItemToJs(row) {
  return {
    id: row.id,
    source: row.source,
    day: row.day,
    rawText: row.raw_text,
    bookName: row.book_name,
    matchedBookId: row.matched_book_id,
    matchedBookName: row.matched_book_name,
    matchType: row.match_type,
    subject: row.subject,
    topicName: row.topic_name,
    testRange: row.test_range,
    isRequired: row.is_required,
  };
}
