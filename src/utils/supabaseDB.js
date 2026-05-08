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
    catalog: book.catalog ?? 'Genel',
    book_format: book.bookFormat ?? 'Tek Kitap',
    set_name: book.setName ?? '',
    parent_set_id: book.parentSetId ?? '',
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
  const { error: deleteError } = await supabase.from('program_items').delete().eq('user_id', userId);
  if (deleteError) return { error: deleteError };
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
    match_score: item.matchScore ?? 0,
    match_reason: item.matchReason ?? '',
    subject: item.subject ?? '',
    topic_name: item.topicName ?? '',
    test_range: item.testRange ?? '',
    is_required: item.isRequired ?? true,
  }));
  const { error } = await supabase.from('program_items').insert(rows);
  return { error };
}

export async function fetchProgramArchives(userId) {
  const { data, error } = await supabase
    .from('program_archives')
    .select('*')
    .eq('user_id', userId)
    .order('program_date', { ascending: false })
    .order('imported_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function replaceProgramArchives(userId, archives) {
  const { error: deleteError } = await supabase.from('program_archives').delete().eq('user_id', userId);
  if (deleteError) return { error: deleteError };
  if (!archives.length) return { error: null };

  const rows = archives.map((archive) => ({
    id: archive.id,
    user_id: userId,
    title: archive.title ?? '',
    program_date: archive.programDate ?? null,
    meeting_no: archive.meetingNo ?? '',
    advisor: archive.advisor ?? '',
    student_name: archive.studentName ?? '',
    source: archive.source ?? 'ders_programi',
    item_count: archive.itemCount ?? archive.items?.length ?? 0,
    unmatched_count: archive.unmatchedCount ?? 0,
    imported_at: archive.importedAt ?? new Date().toISOString(),
    items: archive.items ?? [],
    raw_export: archive.rawExport ?? {},
  }));

  const { error } = await supabase.from('program_archives').insert(rows);
  return { error };
}

export async function fetchProgramMatchRules(userId) {
  const { data, error } = await supabase
    .from('program_match_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function replaceProgramMatchRules(userId, rules) {
  const { error: deleteError } = await supabase.from('program_match_rules').delete().eq('user_id', userId);
  if (deleteError) return { error: deleteError };
  if (!rules.length) return { error: null };

  const rows = rules.map((rule) => ({
    id: rule.id,
    user_id: userId,
    pattern: rule.pattern ?? '',
    normalized_pattern: rule.normalizedPattern ?? '',
    book_id: rule.bookId ?? '',
    book_name: rule.bookName ?? '',
    created_at: rule.createdAt ?? new Date().toISOString(),
  }));

  const { error } = await supabase.from('program_match_rules').insert(rows);
  return { error };
}

// ── full load (tüm tabloları çek, uygulama state'i olarak döndür) ─────

export async function loadAllFromDB(userId) {
  const [booksRes, topicsRes, resultsRes, programRes, archivesRes, rulesRes] = await Promise.all([
    fetchBooks(userId),
    fetchTopics(userId),
    fetchTestResults(userId),
    fetchProgramItems(userId),
    fetchProgramArchives(userId),
    fetchProgramMatchRules(userId),
  ]);

  const firstError = booksRes.error || topicsRes.error || resultsRes.error || programRes.error || archivesRes.error || rulesRes.error;
  if (firstError) throw firstError;

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
  const programArchives = (archivesRes.data ?? []).map(dbProgramArchiveToJs);
  const matchRules = (rulesRes.data ?? []).map(dbProgramMatchRuleToJs);

  return { books, testResults, programItems, programArchives, matchRules };
}

export async function clearUserCloudData(userId) {
  const results = await Promise.all([
    supabase.from('program_items').delete().eq('user_id', userId),
    supabase.from('program_archives').delete().eq('user_id', userId),
    supabase.from('program_match_rules').delete().eq('user_id', userId),
    supabase.from('test_results').delete().eq('user_id', userId),
    supabase.from('topics').delete().eq('user_id', userId),
    supabase.from('books').delete().eq('user_id', userId),
    supabase.from('app_states').delete().eq('user_id', userId),
  ]);

  const firstError = results.find((result) => result.error)?.error;
  return { error: firstError ?? null };
}

// ── format converters ─────────────────────────────────────────────────

function dbBookToJs(row) {
  return {
    id: row.id,
    name: row.name,
    publisher: row.publisher,
    examType: row.exam_type,
    subject: row.subject,
    catalog: row.catalog ?? 'Genel',
    bookFormat: row.book_format ?? 'Tek Kitap',
    setName: row.set_name ?? '',
    parentSetId: row.parent_set_id ?? '',
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
    matchScore: row.match_score ?? 0,
    matchReason: row.match_reason ?? '',
    subject: row.subject,
    topicName: row.topic_name,
    testRange: row.test_range,
    isRequired: row.is_required,
  };
}

function dbProgramArchiveToJs(row) {
  return {
    id: row.id,
    title: row.title,
    programDate: row.program_date,
    meetingNo: row.meeting_no,
    advisor: row.advisor,
    studentName: row.student_name,
    source: row.source,
    itemCount: row.item_count,
    unmatchedCount: row.unmatched_count,
    importedAt: row.imported_at,
    items: row.items ?? [],
    rawExport: row.raw_export ?? {},
  };
}

function dbProgramMatchRuleToJs(row) {
  return {
    id: row.id,
    pattern: row.pattern,
    normalizedPattern: row.normalized_pattern,
    bookId: row.book_id,
    bookName: row.book_name,
    createdAt: row.created_at,
  };
}
