import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { emptyState, loadStoredState, saveStoredState, storageKey } from './utils/storage';
import {
  bookProgress, clampNumber, createId, getResultSolvedCount, getSolvedTestCountInfo,
  normalizeText, recalculateBookTotals, statusLabel, testEntryLabel, testResultTopicDetail,
  topicStatusFromCounts, topicStatusLabel, bookName,
} from './utils/helpers';
import { getBringRecommendations, parseProgramExport } from './utils/matching';
import { books as sampleBooks, programItems as sampleProgramItems, testResults as sampleTestResults } from './data/sampleData';
import {
  loadAllFromDB,
  clearUserCloudData,
  upsertBook, deleteBook as dbDeleteBook,
  upsertTopic, deleteTopic as dbDeleteTopic,
  upsertTestResult, deleteTestResult as dbDeleteTestResult,
  replaceProgramItems,
  replaceProgramArchives,
  replaceProgramMatchRules,
} from './utils/supabaseDB';

const DEMO_SESSION_KEY = 'kitaparsiv.demoSession';
const DEMO_USER_ID = 'demo-user-codex';
const DEMO_EMAIL = 'codex.demo@kitaparsiv.test';
const THEME_KEY = 'kitaparsiv.theme';
const SELECTED_BOOK_KEY = 'kitaparsiv.selectedBook';
const TOPIC_DISTRIBUTION_SCHEMA_TYPE = 'kitaparsiv-topic-distribution';
const TOPIC_DISTRIBUTION_SCHEMA_VERSION = 1;

const navItems = [
  { id: 'dashboard', label: 'Panel', icon: 'dashboard' },
  { id: 'summary', label: 'Özet', icon: 'analytics' },
  { id: 'library', label: 'Arşiv', icon: 'auto_stories' },
  { id: 'add', label: 'Hızlı Ekle', icon: 'add_circle' },
  { id: 'coach', label: 'Koç', icon: 'psychology' },
  { id: 'profile', label: 'Profil', icon: 'person' },
];

const summaryGroupOptions = [
  { id: 'subject', label: 'Ders' },
  { id: 'examType', label: 'Tür' },
  { id: 'catalog', label: 'Katalog' },
  { id: 'bookFormat', label: 'Yapı' },
  { id: 'status', label: 'Durum' },
];

const summarySortOptions = [
  { id: 'totalTests', label: 'Toplam Test' },
  { id: 'solvedTests', label: 'Çözülen Test' },
  { id: 'bookCount', label: 'Kitap Sayısı' },
  { id: 'progress', label: 'İlerleme' },
];

const subjectOptions = ['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Paragraf', 'Türkçe', 'Edebiyat', 'Coğrafya', 'Tarih', 'Geometri', 'Fen', 'Sosyal'];
const examTypeOptions = ['TYT', 'AYT', 'TYT-AYT', '11. Sınıf', '12. Sınıf'];
const catalogOptions = ['Genel', 'Soru Bankası', 'Konu Anlatımlı Soru Bankası', 'TYT', 'AYT', '11. Sınıf', '12. Sınıf', 'Paragraf', 'Geometri', 'Problem', 'Set', 'Fasikül', 'Deneme', 'Konu Anlatım'];
const bookFormatOptions = ['Tek Kitap', 'Set', 'Fasikül'];
const libraryFilters = ['Tümü', 'Soru Bankası', 'Konu Anlatımlı Soru Bankası', '11. Sınıf', '12. Sınıf', 'TYT', 'AYT', 'Matematik', 'Problem', 'Geometri', 'Fizik', 'Kimya', 'Biyoloji', 'Paragraf', 'Edebiyat', 'Coğrafya', 'Tarih', 'Türkçe', 'Aktif', 'Set', 'Fasikül'];
const inferredCatalogLabels = ['Paragraf', 'Geometri', 'Problem'];

const emptyBookForm = {
  name: '',
  publisher: '',
  examType: 'TYT',
  subject: 'Matematik',
  catalog: 'Genel',
  bookFormat: 'Tek Kitap',
  setName: '',
  status: 'aktif',
  topicName: '',
  topicTotalTests: '',
  initialSolvedTests: '',
  coverImage: '',
};

function createEmptyBookForm(parentSet = null) {
  return {
    ...emptyBookForm,
    examType: parentSet?.examType ?? emptyBookForm.examType,
    subject: parentSet?.subject ?? emptyBookForm.subject,
    catalog: parentSet?.catalog ?? emptyBookForm.catalog,
    bookFormat: parentSet ? 'Tek Kitap' : emptyBookForm.bookFormat,
    setName: parentSet ? (parentSet.setName || parentSet.name) : emptyBookForm.setName,
  };
}

const emptyResultForm = {
  bookId: '',
  topicId: '',
  testNo: '',
  correct: '',
  wrong: '',
  empty: '',
  status: 'cozuldu',
  coachNote: '',
};

function Icon({ name, filled = false }) {
  return (
    <span className={`material-symbols-outlined ${filled ? 'icon-filled' : ''}`}>
      {name}
    </span>
  );
}

function getBookEffectiveCatalog(book) {
  if (book.catalog && book.catalog !== 'Genel') return book.catalog;

  const subject = normalizeText(book.subject ?? '');
  const haystack = normalizeText([
    book.name,
    book.publisher,
    book.subject,
    book.examType,
    book.setName,
    ...(book.topics ?? []).map((topic) => topic.name),
  ].filter(Boolean).join(' '));

  if (subject === 'paragraf' || haystack.includes('paragraf')) return 'Paragraf';
  if (
    subject === 'geometri'
    || haystack.includes('geometri')
    || haystack.includes('cember')
    || haystack.includes('daire')
    || haystack.includes('analitik')
    || haystack.includes('ucgen')
  ) {
    return 'Geometri';
  }
  if (haystack.includes('problem')) return 'Problem';

  return book.catalog || 'Genel';
}

function isSetContainer(book) {
  return book?.bookFormat === 'Set' && !book?.parentSetId;
}

function getLibraryRootBooks(books) {
  return books.filter((book) => !book.parentSetId);
}

function getActionableBooks(books) {
  return books.filter((book) => !isSetContainer(book));
}

function getSetChildren(books, setId) {
  return books.filter((book) => book.parentSetId === setId);
}

function getSetTotals(books, setId) {
  return getSetChildren(books, setId).reduce(
    (acc, child) => ({
      bookCount: acc.bookCount + 1,
      totalTests: acc.totalTests + (Number(child.totalTests) || 0),
      solvedTests: acc.solvedTests + (Number(child.solvedTests) || 0),
      topicCount: acc.topicCount + (child.topics?.length ?? 0),
    }),
    { bookCount: 0, totalTests: 0, solvedTests: 0, topicCount: 0 },
  );
}

function getBookSummaryGroupValue(book, groupBy) {
  if (groupBy === 'status') return statusLabel(book.status);
  if (groupBy === 'catalog') return getBookEffectiveCatalog(book);
  if (groupBy === 'subject') {
    const effectiveCatalog = getBookEffectiveCatalog(book);
    if (book.subject === 'Matematik' && inferredCatalogLabels.includes(effectiveCatalog)) {
      return `Matematik / ${effectiveCatalog}`;
    }
  }
  return book[groupBy];
}

function safeFilePart(value) {
  return normalizeText(value || 'kitap')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'kitap';
}

function createTopicDistributionExport(book) {
  return {
    type: TOPIC_DISTRIBUTION_SCHEMA_TYPE,
    version: TOPIC_DISTRIBUTION_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    book: {
      name: book.name,
      publisher: book.publisher,
      examType: book.examType,
      subject: book.subject,
      catalog: getBookEffectiveCatalog(book),
    },
    topics: (book.topics ?? []).map((topic, index) => ({
      order: index + 1,
      id: topic.id,
      name: topic.name,
      totalTests: Number(topic.totalTests) || 0,
      solvedTests: Number(topic.solvedTests) || 0,
      detail: topic.detail ?? '',
    })),
  };
}

function getTopicArrayFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.topics)) return payload.topics;
  if (Array.isArray(payload?.data?.topics)) return payload.data.topics;
  return null;
}

function normalizeImportedTopic(rawTopic, index, bookName) {
  const name = String(
    rawTopic?.name
    ?? rawTopic?.konu
    ?? rawTopic?.title
    ?? rawTopic?.baslik
    ?? '',
  ).trim();
  if (!name) return null;

  const totalTests = Math.max(0, Number(
    rawTopic?.totalTests
    ?? rawTopic?.testCount
    ?? rawTopic?.tests
    ?? rawTopic?.testSayisi
    ?? rawTopic?.toplamTest
    ?? 0,
  ) || 0);
  const solvedTests = clampNumber(Number(rawTopic?.solvedTests ?? rawTopic?.cozulenTest ?? 0) || 0, 0, totalTests);
  const detail = String(rawTopic?.detail ?? rawTopic?.note ?? rawTopic?.not ?? '').trim();

  return {
    id: rawTopic?.id ? String(rawTopic.id) : createId('topic', `${bookName}_${index + 1}_${name}`),
    name,
    totalTests,
    solvedTests,
    initialSolvedTests: solvedTests,
    trackedSolvedTests: 0,
    status: topicStatusFromCounts(solvedTests, totalTests),
    detail: detail || (solvedTests > 0 ? 'içe aktarılan başlangıç ilerlemesi' : 'içe aktarılan konu dağılımı'),
  };
}

function parseTopicDistributionImport(payload, bookName) {
  const rawTopics = getTopicArrayFromPayload(payload);
  if (!rawTopics) {
    throw new Error('Konu dağılımı JSON içinde topics dizisi bulunamadı.');
  }

  const topics = rawTopics
    .map((topic, index) => normalizeImportedTopic(topic, index, bookName))
    .filter(Boolean);

  if (topics.length === 0) {
    throw new Error('İçe aktarılacak geçerli konu bulunamadı.');
  }

  return topics;
}

function getInitialPage() {
  const page = window.location.hash.replace('#', '').split('/')[0];
  return navItems.some((item) => item.id === page) || page === 'book' ? page : 'dashboard';
}

function getBookIdFromHash() {
  const hash = window.location.hash.replace('#', '');
  const [page, rawBookId] = hash.split('/');
  if (page !== 'book' || !rawBookId) return '';

  try {
    return decodeURIComponent(rawBookId);
  } catch {
    return rawBookId;
  }
}

function selectedBookStorageKey(userId) {
  return `${SELECTED_BOOK_KEY}.${userId}`;
}

function getPreferredBookId(books, userId) {
  const hashBookId = getBookIdFromHash();
  if (hashBookId && books.some((book) => book.id === hashBookId)) return hashBookId;

  const storedBookId = userId ? localStorage.getItem(selectedBookStorageKey(userId)) : '';
  if (storedBookId && books.some((book) => book.id === storedBookId)) return storedBookId;

  return books[0]?.id;
}

function LoadingScreen() {
  return (
    <div className="login-screen">
      <div className="login-loading">
        <div className="login-brand">
          <div className="avatar large">KA</div>
          <h1>KitapArşiv</h1>
        </div>
        <span className="helper-text">Yükleniyor...</span>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

function createDemoSession() {
  return {
    isDemo: true,
    user: {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
    },
  };
}

function isDemoSession(session) {
  return Boolean(session?.isDemo || session?.user?.id === DEMO_USER_ID);
}

function createDemoState() {
  return {
    books: sampleBooks,
    matchRules: [],
    programItems: sampleProgramItems,
    programArchives: [],
    testResults: sampleTestResults,
  };
}

function LoginScreen({ onDemoLogin }) {
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (event) => {
    event.preventDefault();
    if (!supabase || !email.trim() || !password) return;
    if (authMode === 'signup' && password !== passwordConfirm) {
      setMessage('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    setMessage(authMode === 'signup' ? 'Hesap oluşturuluyor...' : 'Giriş yapılıyor...');

    const { error } = authMode === 'signup'
      ? await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(authMode === 'signup'
        ? 'Hesap oluşturuldu. E-posta kutunu kontrol et, onay gerekebilir.'
        : 'Giriş yapılıyor...');
    }
  };

  const sendMagicLink = async () => {
    if (!supabase || !email.trim()) {
      setMessage('Önce e-posta adresini gir.');
      return;
    }
    setMessage('Bağlantı gönderiliyor...');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setMessage(error ? error.message : 'E-posta kutunu kontrol et, giriş bağlantısı gönderildi.');
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="avatar large">KA</div>
          <h1>KitapArşiv</h1>
          <p>YKS kitap ve test takip uygulaması</p>
        </div>

        {!isSupabaseConfigured && (
          <p className="error-message">Supabase yapılandırması eksik. .env.local dosyasını kontrol et.</p>
        )}

        {isSupabaseConfigured && (
          <>
            <button
              className="google-button"
              disabled={loading}
              onClick={handleGoogleLogin}
              type="button"
            >
              <GoogleIcon />
              Google ile Giriş Yap
            </button>

            <div className="login-divider"><span>veya</span></div>

            <div className="auth-tabs">
              <button
                className={`chip ${authMode === 'signin' ? 'primary' : ''}`}
                onClick={() => { setAuthMode('signin'); setMessage(''); }}
                type="button"
              >
                Giriş
              </button>
              <button
                className={`chip ${authMode === 'signup' ? 'primary' : ''}`}
                onClick={() => { setAuthMode('signup'); setMessage(''); }}
                type="button"
              >
                Kayıt Ol
              </button>
            </div>

            <form className="sync-form" onSubmit={handlePasswordAuth}>
              <label className="field">
                <span>E-posta</span>
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ornek@mail.com"
                  type="email"
                  value={email}
                />
              </label>
              <label className="field">
                <span>Şifre</span>
                <input
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="En az 6 karakter"
                  type="password"
                  value={password}
                />
              </label>
              {authMode === 'signup' && (
                <label className="field">
                  <span>Şifre Tekrar</span>
                  <input
                    autoComplete="new-password"
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    placeholder="Şifreyi tekrar yaz"
                    type="password"
                    value={passwordConfirm}
                  />
                </label>
              )}
              <button className="primary-button" disabled={loading} type="submit">
                {authMode === 'signup' ? 'Hesap Oluştur' : 'Giriş Yap'}
              </button>
            </form>

            <button className="text-button" onClick={sendMagicLink} type="button">
              Şifresiz magic link gönder
            </button>

            <button className="secondary-button full-width" onClick={onDemoLogin} type="button">
              Demo Hesapla Gir
            </button>
          </>
        )}

        {message && <p className="login-message">{message}</p>}
      </div>
    </div>
  );
}

function App() {
  const [appData, setAppData] = useState(emptyState);
  const [page, setPage] = useState(getInitialPage);
  const [selectedBookId, setSelectedBookId] = useState(undefined);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(isSupabaseConfigured));
  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'synced' | 'error'
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const activeUserIdRef = useRef(null);
  const syncTimer = useRef(null);

  const selectedBook = appData.books.find((book) => book.id === selectedBookId) ?? appData.books[0];
  const recommendations = useMemo(
    () => getBringRecommendations(getActionableBooks(appData.books), appData.testResults, appData.programItems),
    [appData.books, appData.programItems, appData.testResults],
  );

  const loadUserData = useCallback(async (userId) => {
    try {
      const { books, testResults, programItems, programArchives, matchRules } = await loadAllFromDB(userId);
      if (activeUserIdRef.current !== userId) return;
      if (books.length > 0 || testResults.length > 0 || programItems.length > 0 || programArchives.length > 0 || matchRules.length > 0) {
        const fresh = { books, testResults, programItems, programArchives, matchRules };
        setAppData(fresh);
        setSelectedBookId(getPreferredBookId(books, userId));
        setLastSavedAt(null);
        saveStoredState(userId, books, testResults, programItems, programArchives, matchRules);
        return;
      }
    } catch {
      if (activeUserIdRef.current !== userId) return;
      setSyncStatus('error');
    }

    if (activeUserIdRef.current !== userId) return;
    const stored = loadStoredState(userId);
    setAppData(stored);
    setSelectedBookId(getPreferredBookId(stored.books, userId));
    setLastSavedAt(null);
  }, []);

  const loadDemoData = useCallback(() => {
    activeUserIdRef.current = DEMO_USER_ID;
    const stored = loadStoredState(DEMO_USER_ID);
    const fresh = stored.books.length > 0 ? stored : createDemoState();
    setAppData(fresh);
    setSelectedBookId(getPreferredBookId(fresh.books, DEMO_USER_ID));
    setLastSavedAt(null);
    saveStoredState(
      DEMO_USER_ID,
      fresh.books,
      fresh.testResults,
      fresh.programItems,
      fresh.programArchives,
      fresh.matchRules,
    );
  }, []);

  useEffect(() => {
    const wantsDemo = new URLSearchParams(window.location.search).get('demo') === '1';
    if (wantsDemo || localStorage.getItem(DEMO_SESSION_KEY) === '1') {
      localStorage.setItem(DEMO_SESSION_KEY, '1');
      setSession(createDemoSession());
      setAuthLoading(false);
      loadDemoData();
      return;
    }

    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const sess = data.session ?? null;
      setSession(sess);
      setAuthLoading(false);
      if (sess?.user?.id) {
        activeUserIdRef.current = sess.user.id;
        setAppData(emptyState());
        setSelectedBookId(undefined);
        setLastSavedAt(null);
        setSyncStatus(null);
        loadUserData(sess.user.id);
      } else {
        activeUserIdRef.current = null;
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const sess = nextSession ?? null;
      const nextUserId = sess?.user?.id ?? null;
      const currentUserId = activeUserIdRef.current;
      setSession(sess);
      setAuthLoading(false);

      if (nextUserId && nextUserId === currentUserId) {
        return;
      }

      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
      if (nextUserId) {
        activeUserIdRef.current = nextUserId;
        setAppData(emptyState());
        setSelectedBookId(undefined);
        setLastSavedAt(null);
        setSyncStatus(null);
        loadUserData(nextUserId);
      } else {
        activeUserIdRef.current = null;
        setAppData(emptyState());
        setSelectedBookId(undefined);
        setLastSavedAt(null);
        setSyncStatus(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadDemoData, loadUserData]);

  useEffect(() => {
    const syncPageFromHash = () => {
      setPage(getInitialPage());
      const hashBookId = getBookIdFromHash();
      if (hashBookId) setSelectedBookId(hashBookId);
    };
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const navigate = (nextPage, bookId = '') => {
    setPage(nextPage);
    window.location.hash = nextPage === 'book' && bookId
      ? `book/${encodeURIComponent(bookId)}`
      : nextPage;
  };

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const startDemoSession = () => {
    localStorage.setItem(DEMO_SESSION_KEY, '1');
    activeUserIdRef.current = DEMO_USER_ID;
    setSession(createDemoSession());
    setAuthLoading(false);
    loadDemoData();
  };

  const signOutSession = async () => {
    if (isDemoSession(session)) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      activeUserIdRef.current = null;
      setSession(null);
      setAppData(emptyState());
      setSelectedBookId(undefined);
      setLastSavedAt(null);
      setSyncStatus(null);
      return;
    }
    if (supabase) await supabase.auth.signOut();
  };

  const autoSync = useCallback(async (userId, books, testResults, programItems, programArchives, matchRules) => {
    if (!supabase || !userId) return;
    setSyncStatus('syncing');
    try {
      // Normalize tablolara yaz
      for (const book of books) {
        const bookResult = await upsertBook(userId, book);
        if (bookResult.error) throw bookResult.error;
        for (const topic of book.topics) {
          const topicResult = await upsertTopic(userId, book.id, topic);
          if (topicResult.error) throw topicResult.error;
        }
      }
      for (const result of testResults) {
        const resultResponse = await upsertTestResult(userId, result);
        if (resultResponse.error) throw resultResponse.error;
      }
      const programResult = await replaceProgramItems(userId, programItems);
      if (programResult.error) throw programResult.error;
      const archiveResult = await replaceProgramArchives(userId, programArchives);
      if (archiveResult.error) throw archiveResult.error;
      const rulesResult = await replaceProgramMatchRules(userId, matchRules);
      if (rulesResult.error) throw rulesResult.error;

      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    }
  }, []);

  const updateData = (
    nextBooks,
    nextResults = appData.testResults,
    nextProgramItems = appData.programItems,
    nextProgramArchives = appData.programArchives,
    nextMatchRules = appData.matchRules,
  ) => {
    setAppData({
      books: nextBooks,
      matchRules: nextMatchRules,
      programItems: nextProgramItems,
      programArchives: nextProgramArchives,
      testResults: nextResults,
    });
    saveStoredState(session.user.id, nextBooks, nextResults, nextProgramItems, nextProgramArchives, nextMatchRules);
    setLastSavedAt(new Date().toISOString());
    if (isDemoSession(session)) {
      setSyncStatus('synced');
      return;
    }
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setSyncStatus('syncing');
    syncTimer.current = setTimeout(() => {
      autoSync(session.user.id, nextBooks, nextResults, nextProgramItems, nextProgramArchives, nextMatchRules);
    }, 1500);
  };

  const addBook = (form, parentSetId = '') => {
    const totalTests = Number(form.topicTotalTests) || 0;
    const initialSolved = Math.min(Number(form.initialSolvedTests) || 0, totalTests);
    const topicId = createId('topic', form.topicName || 'konu');
    const isRootSet = form.bookFormat === 'Set' && !parentSetId;
    const book = {
      id: createId('book', form.name),
      name: form.name.trim(),
      publisher: form.publisher.trim() || 'Yayın bilgisi yok',
      examType: form.examType,
      subject: form.subject,
      catalog: form.catalog,
      bookFormat: form.bookFormat,
      setName: form.setName.trim(),
      parentSetId,
      status: form.status,
      isActiveRotation: form.status === 'aktif',
      totalTests: isRootSet ? 0 : totalTests,
      solvedTests: isRootSet ? 0 : initialSolved,
      coverImage: form.coverImage,
      topics: isRootSet ? [] : [
        {
          id: topicId,
          name: form.topicName.trim(),
          totalTests,
          solvedTests: initialSolved,
          initialSolvedTests: initialSolved,
          trackedSolvedTests: 0,
          status: topicStatusFromCounts(initialSolved, totalTests),
          detail: initialSolved > 0 ? 'başlangıç ilerlemesi' : 'henüz detay girilmedi',
        },
      ],
    };

    const nextBooks = [book, ...appData.books];
    updateData(nextBooks);
    setSelectedBookId(book.id);
    localStorage.setItem(selectedBookStorageKey(session.user.id), book.id);
    navigate('book', book.id);
  };

  const deleteBook = (bookId) => {
    const targetBook = appData.books.find((book) => book.id === bookId);
    if (!targetBook) return;
    const childIds = isSetContainer(targetBook)
      ? appData.books.filter((book) => book.parentSetId === bookId).map((book) => book.id)
      : [];
    const deletedBookIds = new Set([bookId, ...childIds]);

    const confirmed = window.confirm(`${targetBook.name} kitabını silmek istiyor musun? Bu kitaba bağlı test kayıtları da silinir.`);
    if (!confirmed) return;

    const nextBooks = appData.books.filter((book) => !deletedBookIds.has(book.id));
    const nextResults = appData.testResults.filter((result) => !deletedBookIds.has(result.bookId));
    updateData(nextBooks, nextResults);
    deletedBookIds.forEach((id) => dbDeleteBook(session.user.id, id));
    if (selectedBookId === bookId) {
      const nextSelectedBookId = nextBooks[0]?.id;
      setSelectedBookId(nextSelectedBookId);
      if (nextSelectedBookId) localStorage.setItem(selectedBookStorageKey(session.user.id), nextSelectedBookId);
    }
  };

  const updateBookDetails = (bookId, form) => {
    const nextBooks = appData.books.map((book) => {
      if (book.id !== bookId) return book;

      return recalculateBookTotals({
        ...book,
        name: form.name.trim(),
        publisher: form.publisher.trim() || 'Yayin bilgisi yok',
        examType: form.examType,
        subject: form.subject,
        catalog: form.catalog,
        bookFormat: form.bookFormat,
        setName: form.setName.trim(),
        status: form.status,
        isActiveRotation: form.status === 'aktif',
        coverImage: form.coverImage ?? book.coverImage ?? '',
      });
    });

    updateData(nextBooks);
  };

  const addTopic = (bookId, form) => {
    const totalTests = Number(form.totalTests) || 0;
    const solvedTests = Math.min(Number(form.solvedTests) || 0, totalTests);
    const nextBooks = appData.books.map((book) => {
      if (book.id !== bookId) return book;

      const topic = {
        id: createId('topic', form.name),
        name: form.name.trim(),
        totalTests,
        solvedTests,
        initialSolvedTests: solvedTests,
        trackedSolvedTests: 0,
        status: topicStatusFromCounts(solvedTests, totalTests),
        detail: solvedTests > 0 ? 'baslangic ilerlemesi' : 'henuz detay girilmedi',
      };

      return recalculateBookTotals({ ...book, topics: [...book.topics, topic] });
    });

    updateData(nextBooks);
  };

  const updateTopic = (bookId, topicId, form) => {
    const totalTests = Number(form.totalTests) || 0;
    const solvedTests = Math.min(Number(form.solvedTests) || 0, totalTests);
    const nextBooks = appData.books.map((book) => {
      if (book.id !== bookId) return book;

      const topics = book.topics.map((topic) => {
        if (topic.id !== topicId) return topic;

        return {
          ...topic,
          name: form.name.trim(),
          totalTests,
          solvedTests,
          initialSolvedTests: Math.max(0, solvedTests - (topic.trackedSolvedTests || 0)),
          status: topicStatusFromCounts(solvedTests, totalTests),
          detail: form.detail.trim() || topic.detail,
        };
      });

      return recalculateBookTotals({ ...book, topics });
    });

    updateData(nextBooks);
  };

  const importBookTopics = (bookId, topics) => {
    const nextBooks = appData.books.map((book) => {
      if (book.id !== bookId) return book;
      return recalculateBookTotals({ ...book, topics });
    });
    const nextResults = appData.testResults.filter((result) => result.bookId !== bookId);

    updateData(nextBooks, nextResults);
  };

  const deleteTopic = (bookId, topicId) => {
    const book = appData.books.find((item) => item.id === bookId);
    const topic = book?.topics.find((item) => item.id === topicId);
    if (!book || !topic) return;
    const confirmed = window.confirm(`${topic.name} konusu silinsin mi? Bu konuya bagli test kayitlari da silinir.`);
    if (!confirmed) return;

    const nextBooks = appData.books.map((item) => {
      if (item.id !== bookId) return item;
      return recalculateBookTotals({ ...item, topics: item.topics.filter((topicItem) => topicItem.id !== topicId) });
    });
    const nextResults = appData.testResults.filter((result) => result.topicId !== topicId);
    updateData(nextBooks, nextResults);
    dbDeleteTopic(session.user.id, topicId);
  };

  const addTestResult = (form) => {
    const book = appData.books.find((item) => item.id === form.bookId);
    const topic = book?.topics.find((item) => item.id === form.topicId);
    if (!book || !topic) return;
    const testCountInfo = getSolvedTestCountInfo(form.testNo);

    const result = {
      id: createId('result', `${book.name}_${form.testNo}`),
      bookId: book.id,
      topicId: topic.id,
      testNo: form.testNo,
      solvedTestCount: testCountInfo.count,
      testEntryType: testCountInfo.type,
      correct: Number(form.correct) || 0,
      wrong: Number(form.wrong) || 0,
      empty: Number(form.empty) || 0,
      status: form.status,
      askCoach: form.status === 'koca_sor',
      coachNote: form.coachNote.trim(),
      solvedAt: new Date().toISOString().slice(0, 10),
    };

    const nextBooks = appData.books.map((item) => {
      if (item.id !== book.id) return item;

      const nextTopics = item.topics.map((topicItem) => {
        if (topicItem.id !== topic.id) return topicItem;

        const solvedTests = Math.min(topicItem.solvedTests + testCountInfo.count, topicItem.totalTests);
        const trackedSolvedTests = topicItem.trackedSolvedTests + testCountInfo.count;
        return {
          ...topicItem,
          solvedTests,
          trackedSolvedTests,
          status: topicStatusFromCounts(solvedTests, topicItem.totalTests),
          lastEntryType: testCountInfo.type,
          lastEntryText: form.testNo,
          detail: result.askCoach
            ? 'koça sorulacak işaret var'
            : `${result.correct} doğru, ${result.wrong} yanlış`,
        };
      });

      return {
        ...item,
        topics: nextTopics,
        solvedTests: Math.min(item.solvedTests + testCountInfo.count, item.totalTests),
      };
    });

    updateData(nextBooks, [result, ...appData.testResults]);
    setSelectedBookId(book.id);
    localStorage.setItem(selectedBookStorageKey(session.user.id), book.id);
    navigate('book', book.id);
  };

  const updateTestResult = (resultId, form) => {
    const existingResult = appData.testResults.find((result) => result.id === resultId);
    const previousCount = getResultSolvedCount(existingResult);
    const nextCountInfo = getSolvedTestCountInfo(form.testNo);
    const countDelta = nextCountInfo.count - previousCount;
    const nextResults = appData.testResults.map((result) => {
      if (result.id !== resultId) return result;

      return {
        ...result,
        testNo: form.testNo,
        solvedTestCount: nextCountInfo.count,
        testEntryType: nextCountInfo.type,
        correct: Number(form.correct) || 0,
        wrong: Number(form.wrong) || 0,
        empty: Number(form.empty) || 0,
        status: form.status,
        askCoach: form.status === 'koca_sor',
        coachNote: form.coachNote.trim(),
      };
    });

    const nextBooks = countDelta === 0 || !existingResult
      ? appData.books
      : appData.books.map((book) => {
        if (book.id !== existingResult.bookId) return book;

        const topics = book.topics.map((topic) => {
          if (topic.id !== existingResult.topicId) return topic;

          const solvedTests = clampNumber((Number(topic.solvedTests) || 0) + countDelta, 0, Number(topic.totalTests) || 0);
          const trackedSolvedTests = Math.max(0, (Number(topic.trackedSolvedTests) || 0) + countDelta);
          return {
            ...topic,
            solvedTests,
            trackedSolvedTests,
            status: topicStatusFromCounts(solvedTests, topic.totalTests),
            lastEntryType: nextCountInfo.type,
            lastEntryText: form.testNo,
          };
        });

        return recalculateBookTotals({ ...book, topics });
      });

    updateData(nextBooks, nextResults);
  };

  const deleteTestResult = (resultId) => {
    const result = appData.testResults.find((item) => item.id === resultId);
    if (!result) return;

    const decrement = getResultSolvedCount(result);
    const confirmed = window.confirm(`Test ${result.testNo} kaydi silinsin mi? Kitap ilerlemesi ${decrement} test geri alinacak.`);
    if (!confirmed) return;

    const nextBooks = appData.books.map((book) => {
      if (book.id !== result.bookId) return book;

      const topics = book.topics.map((topic) => {
        if (topic.id !== result.topicId) return topic;

        const solvedTests = Math.max(0, (Number(topic.solvedTests) || 0) - decrement);
        const trackedSolvedTests = Math.max(0, (Number(topic.trackedSolvedTests) || 0) - decrement);
        return {
          ...topic,
          solvedTests,
          trackedSolvedTests,
          status: topicStatusFromCounts(solvedTests, topic.totalTests),
          detail: trackedSolvedTests > 0 ? topic.detail : 'henuz detay girilmedi',
        };
      });

      return recalculateBookTotals({ ...book, topics });
    });

    const nextResults = appData.testResults.filter((item) => item.id !== resultId);
    updateData(nextBooks, nextResults);
    dbDeleteTestResult(session.user.id, resultId);
  };

  const resetData = async () => {
    const fresh = emptyState();
    localStorage.removeItem(storageKey(session.user.id));
    setAppData(fresh);
    setSelectedBookId(undefined);
    setLastSavedAt(new Date().toISOString());
    if (isDemoSession(session)) {
      setSyncStatus('synced');
      return fresh;
    }
    const { error } = await clearUserCloudData(session.user.id);
    setSyncStatus(error ? 'error' : 'synced');
    return fresh;
  };

  const importCloudData = (cloudData) => {
    const nextBooks = Array.isArray(cloudData?.books) ? cloudData.books : [];
    const nextResults = Array.isArray(cloudData?.testResults) ? cloudData.testResults : [];
    const nextProgramItems = Array.isArray(cloudData?.programItems) ? cloudData.programItems : [];
    const nextProgramArchives = Array.isArray(cloudData?.programArchives) ? cloudData.programArchives : [];
    const nextMatchRules = Array.isArray(cloudData?.matchRules) ? cloudData.matchRules : [];

    updateData(nextBooks, nextResults, nextProgramItems, nextProgramArchives, nextMatchRules);
    setSelectedBookId(nextBooks[0]?.id);
    return {
      books: nextBooks,
      testResults: nextResults,
      programItems: nextProgramItems,
      programArchives: nextProgramArchives,
      matchRules: nextMatchRules,
    };
  };

  const importLibraryArchive = (archiveData) => {
    const source = archiveData?.data ?? archiveData;
    const nextBooks = Array.isArray(source?.books) ? source.books : [];
    const nextResults = Array.isArray(source?.testResults) ? source.testResults : [];

    updateData(nextBooks, nextResults, appData.programItems, appData.programArchives, appData.matchRules);
    setSelectedBookId(nextBooks[0]?.id);
    return {
      books: nextBooks,
      testResults: nextResults,
    };
  };

  const importProgram = (nextProgramItems, nextProgramArchive) => {
    const nextProgramArchives = [nextProgramArchive, ...appData.programArchives];
    updateData(appData.books, appData.testResults, nextProgramItems, nextProgramArchives);
  };

  const clearProgram = () => {
    updateData(appData.books, appData.testResults, []);
  };

  const restoreProgramArchive = (archiveId) => {
    const archive = appData.programArchives.find((item) => item.id === archiveId);
    if (!archive) return;
    updateData(appData.books, appData.testResults, archive.items ?? [], appData.programArchives);
  };

  const deleteProgramArchive = (archiveId) => {
    const archive = appData.programArchives.find((item) => item.id === archiveId);
    if (!archive) return;

    const confirmed = window.confirm(`${archive.title} geçmişten silinsin mi? Aktif program ve kitap arşivi korunur.`);
    if (!confirmed) return;

    const nextProgramArchives = appData.programArchives.filter((item) => item.id !== archiveId);
    updateData(appData.books, appData.testResults, appData.programItems, nextProgramArchives, appData.matchRules);
  };

  const updateProgramItemMatch = (programItemId, bookId) => {
    const book = appData.books.find((item) => item.id === bookId);
    if (!book) return;

    const nextProgramItems = appData.programItems.map((item) => (
      item.id === programItemId
        ? {
          ...item,
          bookName: book.name,
          matchedBookId: book.id,
          matchedBookName: book.name,
          matchType: 'manual',
        }
        : item
    ));

    const programItem = appData.programItems.find((item) => item.id === programItemId);
    const rulePattern = programItem?.bookName || programItem?.matchedBookName || programItem?.rawText || book.name;
    const normalizedPattern = normalizeText(rulePattern);
    const nextRule = {
      id: createId('match_rule', `${normalizedPattern}_${book.id}`),
      pattern: rulePattern,
      normalizedPattern,
      bookId: book.id,
      bookName: book.name,
      createdAt: new Date().toISOString(),
    };
    const nextMatchRules = [
      nextRule,
      ...appData.matchRules.filter((rule) => rule.normalizedPattern !== normalizedPattern),
    ];

    updateData(appData.books, appData.testResults, nextProgramItems, appData.programArchives, nextMatchRules);
  };

  const clearProgramItemMatch = (programItemId) => {
    const programItem = appData.programItems.find((item) => item.id === programItemId);
    if (!programItem) return;

    const rulePattern = programItem.bookName || programItem.matchedBookName || programItem.rawText;
    const normalizedPattern = normalizeText(rulePattern);
    const nextProgramItems = appData.programItems.map((item) => (
      item.id === programItemId
        ? {
          ...item,
          matchedBookId: '',
          matchedBookName: '',
          matchType: 'none',
          matchScore: 0,
          matchReason: '',
        }
        : item
    ));
    const nextMatchRules = appData.matchRules.filter((rule) => rule.normalizedPattern !== normalizedPattern);

    updateData(appData.books, appData.testResults, nextProgramItems, appData.programArchives, nextMatchRules);
  };

  const openBook = (bookId) => {
    setSelectedBookId(bookId);
    localStorage.setItem(selectedBookStorageKey(session.user.id), bookId);
    navigate('book', bookId);
  };

  if (authLoading) return <LoadingScreen />;
  if (!session) return <LoginScreen onDemoLogin={startDemoSession} />;

  return (
    <AppShell
      onNavigate={navigate}
      onToggleTheme={toggleTheme}
      page={page}
      session={session}
      syncStatus={syncStatus}
      theme={theme}
    >
      {page === 'dashboard' && (
        <Dashboard
          books={getActionableBooks(appData.books)}
          onNavigate={navigate}
          recommendations={recommendations}
          testResults={appData.testResults}
        />
      )}
      {page === 'summary' && (
        <GeneralSummary
          books={appData.books}
          testResults={appData.testResults}
        />
      )}
      {page === 'library' && (
        <FilteredLibrary
          books={appData.books}
          onAddBook={addBook}
          onDeleteBook={deleteBook}
          onOpenBook={openBook}
          userId={session.user.id}
        />
      )}
      {page === 'add' && (
        <AddResult
          books={getActionableBooks(appData.books)}
          onDeleteResult={deleteTestResult}
          onSave={addTestResult}
          onUpdateResult={updateTestResult}
          testResults={appData.testResults}
        />
      )}
      {page === 'book' && selectedBook && (
        <BookDetail
          book={selectedBook}
          books={appData.books}
          onAdd={() => navigate('add')}
          onAddBookToSet={addBook}
          onAddTopic={addTopic}
          onBack={() => navigate('library')}
          onDeleteTopic={deleteTopic}
          onImportTopics={importBookTopics}
          onOpenBook={openBook}
          testResults={appData.testResults}
          onUpdateBook={updateBookDetails}
          onUpdateTopic={updateTopic}
          userId={session.user.id}
        />
      )}
      {page === 'coach' && (
        <CoachDay
          books={appData.books}
          matchRules={appData.matchRules}
          onClearProgram={clearProgram}
          onClearProgramItemMatch={clearProgramItemMatch}
          onDeleteProgramArchive={deleteProgramArchive}
          onImportProgram={importProgram}
          onUpdateProgramItemMatch={updateProgramItemMatch}
          onRestoreProgram={restoreProgramArchive}
          programArchives={appData.programArchives}
          programItems={appData.programItems}
          recommendations={recommendations}
          testResults={appData.testResults}
        />
      )}
      {page === 'profile' && (
        <SupabaseProfile
          books={appData.books}
          dataOwnerId={activeUserIdRef.current}
          matchRules={appData.matchRules}
          lastSavedAt={lastSavedAt}
          onImportCloudData={importCloudData}
          onImportLibraryArchive={importLibraryArchive}
          onReset={resetData}
          onSignOut={signOutSession}
          programItems={appData.programItems}
          programArchives={appData.programArchives}
          session={session}
          syncStatus={syncStatus}
          testResults={appData.testResults}
        />
      )}
    </AppShell>
  );
}

function SyncIndicator({ status }) {
  if (!status) return null;
  const map = {
    syncing: { icon: 'sync', label: 'Kaydediliyor', cls: 'syncing' },
    synced:  { icon: 'cloud_done', label: 'Kaydedildi', cls: 'synced' },
    error:   { icon: 'cloud_off', label: 'Hata', cls: 'sync-error' },
  };
  const item = map[status];
  if (!item) return null;
  return (
    <span className={`sync-indicator ${item.cls}`} title={item.label}>
      <Icon name={item.icon} />
    </span>
  );
}

function AppShell({ children, page, onNavigate, onToggleTheme, session, syncStatus, theme }) {
  const initials = session?.user?.email?.[0]?.toUpperCase() ?? 'KA';
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="avatar">{initials}</div>
          <strong>KitapArşiv</strong>
        </div>
        <div className="topbar-right">
          <SyncIndicator status={syncStatus} />
          <button
            className="icon-button"
            onClick={onToggleTheme}
            type="button"
            aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
            title={theme === 'dark' ? 'Açık tema' : 'Koyu tema'}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
          </button>
          <button className="icon-button" type="button" aria-label="Bildirimler">
            <Icon name="notifications" />
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
      <nav className="bottom-nav" aria-label="Ana menü">
        {navItems.map((item) => (
          <button
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            key={item.id}
            onClick={() => onNavigate(item.id)}
            type="button"
          >
            <Icon name={item.icon} filled={page === item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Dashboard({ books, onNavigate, recommendations, testResults }) {
  const activeBooks = books.filter((book) => book.status === 'aktif');
  const weeklyCount = testResults.length;

  return (
    <>
      <section className="page-heading">
        <span>Bugünkü çalışma paneli</span>
        <h1>Tekrar hoş geldin</h1>
      </section>
      <section className="stats-grid">
        <StatCard icon="auto_stories" value={books.length} label="Kitap" />
        <StatCard icon="quiz" value={weeklyCount} label="Kayıtlı Test" />
      </section>
      <section className="section">
        <div className="section-title">
          <h2>Yarın Kesin Götür</h2>
          <span className="chip primary">Programdan</span>
        </div>
        <div className="stack">
          {recommendations.filter((item) => item.level === 'kesin_gotur').length === 0 && (
            <EmptyState text="Henüz götürülecek kitap yok. Arşivden kitap ekleyince öneriler burada görünecek." />
          )}
          {recommendations
            .filter((item) => item.level === 'kesin_gotur')
            .map((item) => (
              <BringRow key={item.book.id} item={item} />
            ))}
        </div>
      </section>
      <section className="section">
        <div className="section-title">
          <h2>Aktif Kitaplar</h2>
          <button className="text-button" onClick={() => onNavigate('library')} type="button">
            Tümünü Gör
          </button>
        </div>
        <div className="horizontal-list">
          {activeBooks.length === 0 && <EmptyState text="Aktif kitap yok." />}
          {activeBooks.map((book) => (
            <BookMiniCard key={book.id} book={book} />
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-title left">
          <Icon name="warning" />
          <h2>İlgilenmen Gerekenler</h2>
        </div>
        {books.length === 0 && <EmptyState text="Arşivin boş. İlk kitabını Arşiv ekranından ekleyebilirsin." />}
        {books.filter((book) => book.status === 'beklemede' || book.status === 'baslanmadi').slice(0, 2).map((book) => (
          <WarningRow
            key={book.id}
            title={book.name}
            meta={`${statusLabel(book.status)} • ${book.topics[0]?.name ?? 'Konu girilmedi'}`}
          />
        ))}
      </section>
    </>
  );
}

function GeneralSummary({ books, testResults }) {
  const [groupBy, setGroupBy] = useState('subject');
  const [sortBy, setSortBy] = useState('totalTests');
  const [onlyActive, setOnlyActive] = useState(false);
  const [query, setQuery] = useState('');

  const visibleBooks = useMemo(() => {
    const summaryBooks = getActionableBooks(books);
    return onlyActive ? summaryBooks.filter((book) => book.status === 'aktif') : summaryBooks;
  }, [books, onlyActive]);

  const totals = useMemo(() => visibleBooks.reduce(
    (acc, book) => {
      const totalTests = Number(book.totalTests) || 0;
      const solvedTests = Number(book.solvedTests) || 0;
      return {
        bookCount: acc.bookCount + 1,
        totalTests: acc.totalTests + totalTests,
        solvedTests: acc.solvedTests + solvedTests,
        remainingTests: acc.remainingTests + Math.max(0, totalTests - solvedTests),
      };
    },
    { bookCount: 0, totalTests: 0, solvedTests: 0, remainingTests: 0 },
  ), [visibleBooks]);

  const overallProgress = totals.totalTests > 0
    ? Math.round((totals.solvedTests / totals.totalTests) * 100)
    : 0;

  const groupedRows = useMemo(() => {
    const rowMap = new Map();

    visibleBooks.forEach((book) => {
      const effectiveCatalog = getBookEffectiveCatalog(book);
      const rawValue = getBookSummaryGroupValue(book, groupBy);
      const label = rawValue || 'Belirsiz';
      const totalTests = Number(book.totalTests) || 0;
      const solvedTests = Number(book.solvedTests) || 0;

      if (!rowMap.has(label)) {
        rowMap.set(label, {
          label,
          bookCount: 0,
          totalTests: 0,
          solvedTests: 0,
          remainingTests: 0,
          books: [],
        });
      }

      const row = rowMap.get(label);
      row.bookCount += 1;
      row.totalTests += totalTests;
      row.solvedTests += solvedTests;
      row.remainingTests += Math.max(0, totalTests - solvedTests);
      row.books.push({
        id: book.id,
        name: book.name,
        publisher: book.publisher,
        coverImage: book.coverImage,
        examType: book.examType,
        subject: book.subject,
        catalog: effectiveCatalog,
        status: book.status,
        totalTests,
        solvedTests,
        remainingTests: Math.max(0, totalTests - solvedTests),
        progress: totalTests > 0 ? Math.round((solvedTests / totalTests) * 100) : 0,
      });
    });

    return Array.from(rowMap.values())
      .map((row) => ({
        ...row,
        progress: row.totalTests > 0 ? Math.round((row.solvedTests / row.totalTests) * 100) : 0,
      }))
      .filter((row) => !query.trim() || normalizeText(row.label).includes(normalizeText(query)))
      .sort((a, b) => {
        if (sortBy === 'progress') return b.progress - a.progress || b.totalTests - a.totalTests;
        return b[sortBy] - a[sortBy] || a.label.localeCompare(b.label, 'tr');
      });
  }, [visibleBooks, groupBy, sortBy, query]);

  return (
    <>
      <section className="page-heading">
        <span>Genel arşiv durumu</span>
        <h1>Genel Özet</h1>
        <p>Bütün kitaplardan toplam test sayısını, çözdüğün testleri ve ders/katalog kırılımlarını buradan takip edebilirsin.</p>
      </section>

      <section className="stats-grid summary-total-grid">
        <StatCard icon="auto_stories" value={totals.bookCount} label="Kitap" />
        <StatCard icon="format_list_numbered" value={totals.totalTests} label="Toplam Test" />
        <StatCard icon="task_alt" value={totals.solvedTests} label="Çözülen Test" />
        <StatCard icon="pending_actions" value={totals.remainingTests} label="Kalan Test" />
      </section>

      <section className="info-card summary-overall-card">
        <div className="section-title">
          <div>
            <h2>Toplam İlerleme</h2>
            <p>{testResults.length} detaylı test kaydı var.</p>
          </div>
          <span className="chip primary">%{overallProgress}</span>
        </div>
        <ProgressLine label={`${totals.solvedTests}/${totals.totalTests} test çözüldü`} value={overallProgress} />
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Kırılım</h2>
          <label className="summary-toggle">
            <input
              checked={onlyActive}
              onChange={(event) => setOnlyActive(event.target.checked)}
              type="checkbox"
            />
            <span>Sadece aktif</span>
          </label>
        </div>

        <div className="summary-controls">
          <label className="field">
            <span>Grupla</span>
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
              {summaryGroupOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Sırala</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {summarySortOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>

        <div className="search-box">
          <Icon name="search" />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kırılım içinde ara..."
            type="text"
            value={query}
          />
        </div>

        <div className="stack">
          {visibleBooks.length === 0 && <EmptyState text="Özet için kitap yok." />}
          {visibleBooks.length > 0 && groupedRows.length === 0 && <EmptyState text="Bu aramayla eşleşen özet satırı yok." />}
          {groupedRows.map((row) => (
            <SummaryBreakdownRow key={row.label} row={row} />
          ))}
        </div>
      </section>
    </>
  );
}

function SummaryBreakdownRow({ row }) {
  return (
    <details className="summary-breakdown-row">
      <summary>
        <div className="summary-row-head">
          <div>
            <strong>{row.label}</strong>
            <span>{row.bookCount} kitap - {row.totalTests} toplam test</span>
          </div>
          <span className="chip muted">%{row.progress}</span>
        </div>
        <ProgressLine label={`${row.solvedTests}/${row.totalTests} çözüldü - ${row.remainingTests} kaldı`} value={row.progress} />
        <span className="summary-expand-hint">
          <Icon name="expand_more" />
          <span className="summary-hint-closed">Kitapları göster</span>
          <span className="summary-hint-open">Kitapları gizle</span>
        </span>
      </summary>
      <div className="summary-book-list">
        {row.books
          .sort((a, b) => b.totalTests - a.totalTests || a.name.localeCompare(b.name, 'tr'))
          .map((book) => (
            <div className="summary-book-row" key={book.id}>
              <CoverThumb book={book} />
              <div>
                <strong>{book.name}</strong>
                <span>{book.publisher} - {book.examType} - {book.catalog} - {statusLabel(book.status)}</span>
                <ProgressLine label={`${book.solvedTests}/${book.totalTests} çözüldü - ${book.remainingTests} kaldı`} value={book.progress} />
              </div>
            </div>
          ))}
      </div>
    </details>
  );
}

function Library({ books, onAddBook, onDeleteBook, onOpenBook }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tumu');
  const filters = ['Tumu', 'Matematik', 'Fen', 'TYT', 'AYT', 'Aktif'];
  const filteredBooks = books.filter((book) => {
    const searchTarget = normalizeText(`${book.name} ${book.publisher} ${book.subject} ${book.examType} ${book.status} ${book.topics.map((topic) => topic.name).join(' ')}`);
    const matchesQuery = !query.trim() || searchTarget.includes(normalizeText(query));
    const matchesFilter = activeFilter === 'Tumu'
      || normalizeText(book.subject) === normalizeText(activeFilter)
      || normalizeText(book.examType) === normalizeText(activeFilter)
      || (activeFilter === 'Aktif' && book.status === 'aktif');

    return matchesQuery && matchesFilter;
  });

  return (
    <>
      <section className="search-section">
        <div className="section-title">
          <h1>Kitap Arşivi</h1>
          <button className="primary-inline-button" onClick={() => setShowForm((value) => !value)} type="button">
            {showForm ? 'Formu Kapat' : 'Kitap Ekle'}
          </button>
        </div>
        <div className="search-box">
          <Icon name="search" />
          <input placeholder="Kitap, yayın veya konu ara..." type="text" />
        </div>
        <div className="chips-row">
          {['Tümü', 'Matematik', 'Fen', 'TYT', 'AYT', 'Aktif'].map((label, index) => (
            <button className={`chip ${index === 0 ? 'primary' : ''}`} key={label} type="button">
              {label}
            </button>
          ))}
        </div>
      </section>
      {showForm && <BookForm onAddBook={onAddBook} userId={userId} />}
      <section className="stack">
        {books.length === 0 && <EmptyState text="Henüz kitap yok. Kitap Ekle butonuyla gerçek kitaplarını eklemeye başlayabilirsin." />}
        {books.map((book) => (
          <article className="book-card" key={book.id}>
            <div className="card-top">
              <div className="chips-row compact">
                <span className="chip small">{book.subject}</span>
                <span className="chip small muted">{book.examType}</span>
                <span className="chip small primary">{statusLabel(book.status)}</span>
              </div>
              <button
                className="delete-book-button"
                onClick={() => onDeleteBook(book.id)}
                type="button"
                aria-label={`${book.name} kitabını sil`}
              >
                <Icon name="delete" />
              </button>
            </div>
            <button className="book-card-main" onClick={() => onOpenBook(book.id)} type="button">
              <CoverThumb book={book} />
              <div>
                <h2>{book.name}</h2>
                <p>{book.publisher} • {book.topics.map((topic) => topic.name).slice(0, 2).join(', ')}</p>
              </div>
            </button>
            <ProgressLine label={`İlerleme • ${book.solvedTests}/${book.totalTests} test`} value={bookProgress(book)} />
          </article>
        ))}
      </section>
    </>
  );
}

function FilteredLibrary({ books, onAddBook, onDeleteBook, onOpenBook, userId }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [sortSolvedFirst, setSortSolvedFirst] = useState(false);
  const rootBooks = getLibraryRootBooks(books);
  const filterGroups = useMemo(() => {
    const groups = [
      { id: 'catalog', title: 'Katalog', values: ['Soru Bankası', 'Konu Anlatımlı Soru Bankası', 'Konu Anlatım', 'Deneme', 'Problem', 'Geometri', 'Paragraf'] },
      { id: 'class', title: 'Sınıf / Tür', values: ['TYT', 'AYT', 'TYT-AYT', '11. Sınıf', '12. Sınıf'] },
      { id: 'subject', title: 'Ders', values: subjectOptions },
      { id: 'format', title: 'Yapı', values: ['Set', 'Fasikül', 'Tek Kitap'] },
      { id: 'status', title: 'Durum', values: ['Aktif', 'Beklemede', 'Başlanmadı', 'Bitti'] },
    ];

    return groups.map((group) => ({
      ...group,
      values: group.values.filter((value, index, values) => (
        values.indexOf(value) === index
        && rootBooks.some((book) => {
          const effectiveCatalog = getBookEffectiveCatalog(book);
          const status = statusLabel(book.status);
          return [book.subject, book.examType, effectiveCatalog, book.catalog, book.bookFormat, book.setName, status]
            .some((item) => normalizeText(item ?? '') === normalizeText(value));
        })
      )),
    })).filter((group) => group.values.length > 0);
  }, [rootBooks]);

  const toggleFilter = (value) => {
    setSelectedFilters((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
  };

  const filteredBooks = rootBooks.filter((book) => {
    const effectiveCatalog = getBookEffectiveCatalog(book);
    const childSearchTarget = isSetContainer(book)
      ? getSetChildren(books, book.id).map((child) => `${child.name} ${child.publisher} ${child.subject} ${child.examType} ${child.topics.map((topic) => topic.name).join(' ')}`).join(' ')
      : '';
    const searchTarget = normalizeText(`${book.name} ${book.publisher} ${book.subject} ${book.examType} ${effectiveCatalog} ${book.catalog ?? ''} ${book.bookFormat ?? ''} ${book.setName ?? ''} ${book.status} ${book.topics.map((topic) => topic.name).join(' ')} ${childSearchTarget}`);
    const matchesQuery = !query.trim() || searchTarget.includes(normalizeText(query));
    const bookFilterValues = [
      book.subject,
      book.examType,
      effectiveCatalog,
      book.catalog,
      book.bookFormat,
      book.setName,
      statusLabel(book.status),
    ].map((item) => normalizeText(item ?? ''));
    const matchesFilter = selectedFilters.length === 0
      || selectedFilters.every((filter) => bookFilterValues.includes(normalizeText(filter)));

    return matchesQuery && matchesFilter;
  });
  const visibleBooks = sortSolvedFirst
    ? [...filteredBooks].sort((a, b) => (
      (Number(b.solvedTests) || 0) - (Number(a.solvedTests) || 0)
      || bookProgress(b) - bookProgress(a)
      || (Number(b.totalTests) || 0) - (Number(a.totalTests) || 0)
      || a.name.localeCompare(b.name, 'tr')
    ))
    : filteredBooks;

  return (
    <>
      <section className="search-section">
        <div className="section-title">
          <h1>Kitap Arsivi</h1>
          <div className="library-actions">
            <button
              className={sortSolvedFirst ? 'primary-inline-button' : 'secondary-inline-button'}
              onClick={() => setSortSolvedFirst((value) => !value)}
              type="button"
            >
              <Icon name="sort" />
              {sortSolvedFirst ? 'Sıralı' : 'Sırala'}
            </button>
            <button
              className={showFilters || selectedFilters.length > 0 ? 'primary-inline-button' : 'secondary-inline-button'}
              onClick={() => setShowFilters((value) => !value)}
              type="button"
            >
              <Icon name="filter_list" />
              Filtrele{selectedFilters.length > 0 ? ` (${selectedFilters.length})` : ''}
            </button>
            <button className="primary-inline-button" onClick={() => setShowForm((value) => !value)} type="button">
              {showForm ? 'Formu Kapat' : 'Kitap Ekle'}
            </button>
          </div>
        </div>
        <div className="search-box">
          <Icon name="search" />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kitap, yayin veya konu ara..."
            type="text"
            value={query}
          />
        </div>
        {showFilters && (
          <div className="filter-panel">
            <div className="filter-panel-head">
              <strong>Filtreler</strong>
              {selectedFilters.length > 0 && (
                <button className="text-button" onClick={() => setSelectedFilters([])} type="button">
                  Temizle
                </button>
              )}
            </div>
            <div className="filter-groups">
              {filterGroups.map((group) => (
                <fieldset className="filter-group" key={group.id}>
                  <legend>{group.title}</legend>
                  <div className="filter-checks">
                    {group.values.map((value) => (
                      <label className="filter-check" key={`${group.id}-${value}`}>
                        <input
                          checked={selectedFilters.includes(value)}
                          onChange={() => toggleFilter(value)}
                          type="checkbox"
                        />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        )}
      </section>
      {showForm && <BookForm onAddBook={onAddBook} userId={userId} />}
      <section className="stack">
        {rootBooks.length === 0 && <EmptyState text="Henuz kitap yok. Kitap Ekle butonuyla gercek kitaplarini eklemeye baslayabilirsin." />}
        {books.length > 0 && visibleBooks.length === 0 && <EmptyState text="Bu arama veya filtreyle eslesen kitap yok." />}
        {visibleBooks.map((book) => (
          <article className="book-card" key={book.id}>
            {(() => {
              const effectiveCatalog = getBookEffectiveCatalog(book);
              const setTotals = isSetContainer(book) ? getSetTotals(books, book.id) : null;
              return (
                <>
                  <div className="card-top">
                    <div className="chips-row compact">
                      <span className="chip small">{book.subject}</span>
                      <span className="chip small muted">{book.examType}</span>
                      {effectiveCatalog && effectiveCatalog !== 'Genel' && <span className="chip small muted">{effectiveCatalog}</span>}
                      {isSetContainer(book) ? <span className="chip small muted">Set Klasörü</span> : book.bookFormat && book.bookFormat !== 'Tek Kitap' && <span className="chip small muted">{book.bookFormat}</span>}
                      <span className="chip small primary">{statusLabel(book.status)}</span>
                    </div>
                    <button
                      className="delete-book-button"
                      onClick={() => onDeleteBook(book.id)}
                      type="button"
                      aria-label={`${book.name} kitabini sil`}
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                  <button className="book-card-main" onClick={() => onOpenBook(book.id)} type="button">
                    <CoverThumb book={book} />
                    <div>
                      <h2>{book.name}</h2>
                      <p>
                        {isSetContainer(book)
                          ? `${book.publisher} - ${setTotals.bookCount} kitap - ${setTotals.solvedTests}/${setTotals.totalTests} test`
                          : `${book.publisher} - ${[book.setName, ...book.topics.map((topic) => topic.name).slice(0, 2)].filter(Boolean).join(', ')}`}
                      </p>
                    </div>
                  </button>
                  <ProgressLine
                    label={isSetContainer(book) ? `Set ilerleme - ${setTotals.solvedTests}/${setTotals.totalTests} test` : `Ilerleme - ${book.solvedTests}/${book.totalTests} test`}
                    value={isSetContainer(book) && setTotals.totalTests > 0 ? Math.round((setTotals.solvedTests / setTotals.totalTests) * 100) : bookProgress(book)}
                  />
                </>
              );
            })()}
          </article>
        ))}
      </section>
    </>
  );
}

function BookForm({ onAddBook, parentSet = null, userId }) {
  const [form, setForm] = useState(() => createEmptyBookForm(parentSet));
  const isSetChildForm = Boolean(parentSet);
  const formatOptions = isSetChildForm
    ? bookFormatOptions.filter((item) => item !== 'Set')
    : bookFormatOptions;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    const isRootSet = form.bookFormat === 'Set' && !isSetChildForm;
    if (!form.name.trim()) return;
    if (!isRootSet && (!form.topicName.trim() || !form.topicTotalTests)) return;
    onAddBook(form);
    setForm(createEmptyBookForm(parentSet));
  };

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="form-note">
        <strong>Geçmiş çözümleri tek tek girme.</strong>
        <span>Konu için toplam test ve şu ana kadar çözdüğün test sayısını yazman yeterli.</span>
      </div>
      <label className="field">
        <span>Kitap Adı</span>
        <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Örn. Apotemi Problemler" />
      </label>
      <label className="field">
        <span>Yayın</span>
        <input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} placeholder="Örn. Apotemi Yayınları" />
      </label>
      <div className="input-grid">
        <label className="field">
          <span>Ders</span>
          <select value={form.subject} onChange={(event) => update('subject', event.target.value)}>
            {subjectOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Tür</span>
          <select value={form.examType} onChange={(event) => update('examType', event.target.value)}>
            {examTypeOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="input-grid">
        <label className="field">
          <span>Katalog</span>
          <select value={form.catalog} onChange={(event) => update('catalog', event.target.value)}>
            {catalogOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Kitap Yapısı</span>
          <select value={form.bookFormat} onChange={(event) => update('bookFormat', event.target.value)}>
            {formatOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Set / Fasikül Katalog Adı</span>
        <input value={form.setName} onChange={(event) => update('setName', event.target.value)} placeholder="Örn. Orijinal 12 Fasikül Seti" />
        <small>Set içinden ayrı fasiküller ekliyorsan aynı katalog adını kullan.</small>
      </label>
      <label className="field">
        <span>Durum</span>
        <select value={form.status} onChange={(event) => update('status', event.target.value)}>
          <option value="aktif">Aktif</option>
          <option value="beklemede">Beklemede</option>
          <option value="baslanmadi">Başlanmadı</option>
          <option value="bitti">Bitti</option>
        </select>
      </label>
      <label className="field">
        <span>İlk Konu</span>
        <input value={form.topicName} onChange={(event) => update('topicName', event.target.value)} placeholder="Örn. Problemler" />
      </label>
      <div className="input-grid">
        <label className="field">
          <span>Toplam Test</span>
          <input value={form.topicTotalTests} onChange={(event) => update('topicTotalTests', event.target.value)} placeholder="30" type="number" />
        </label>
        <label className="field">
          <span>Şimdiye Kadar Çözdüm</span>
          <input value={form.initialSolvedTests} onChange={(event) => update('initialSolvedTests', event.target.value)} placeholder="12" type="number" />
        </label>
      </div>
      <ImagePicker userId={userId} value={form.coverImage} onChange={(image) => update('coverImage', image)} />
      <button className="primary-button" type="submit">Kitabı Arşive Ekle</button>
    </form>
  );
}

function ImagePicker({ userId, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (supabase && userId) {
      setUploading(true);
      setUploadError('');
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('covers').upload(path, file, { upsert: true });
      setUploading(false);
      if (error) {
        setUploadError('Görsel yüklenemedi, base64 olarak kaydediliyor.');
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result);
        reader.readAsDataURL(file);
      } else {
        const { data } = supabase.storage.from('covers').getPublicUrl(path);
        onChange(data.publicUrl);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <label className="field">
      <span>Kapak Görseli</span>
      <input accept="image/*" capture="environment" onChange={handleFile} type="file" disabled={uploading} />
      {uploading && <small>Yükleniyor...</small>}
      {uploadError && <small className="field-error">{uploadError}</small>}
      {value && <img className="cover-preview" src={value} alt="Kitap kapağı önizlemesi" />}
      <small>Telefondan fotoğraf çekebilir veya galeriden kapak seçebilirsin.</small>
    </label>
  );
}

function AddResult({ books, onDeleteResult, onSave, onUpdateResult, testResults }) {
  const [form, setForm] = useState(() => ({
    ...emptyResultForm,
    bookId: books[0]?.id ?? '',
    topicId: books[0]?.topics[0]?.id ?? '',
  }));

  const selectedBook = books.find((book) => book.id === form.bookId);
  const topics = selectedBook?.topics ?? [];

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const changeBook = (bookId) => {
    const book = books.find((item) => item.id === bookId);
    setForm((current) => ({
      ...current,
      bookId,
      topicId: book?.topics[0]?.id ?? '',
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.bookId || !form.topicId || !form.testNo) return;
    onSave(form);
    setForm({
      ...emptyResultForm,
      bookId: books[0]?.id ?? '',
      topicId: books[0]?.topics[0]?.id ?? '',
    });
  };

  return (
    <>
    <form onSubmit={submit}>
      <section className="page-heading">
        <h1>Test Sonucu Gir</h1>
        <p>Bundan sonraki çözümleri detaylı kaydet. Geçmiş çözümler kitap eklerken başlangıç ilerlemesi olarak tutulur.</p>
      </section>
      <section className="form-card">
        <label className="field">
          <span>Kitap / Kaynak</span>
          <select value={form.bookId} onChange={(event) => changeBook(event.target.value)}>
            {books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Konu</span>
          <select value={form.topicId} onChange={(event) => update('topicId', event.target.value)}>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
          </select>
        </label>
        <div className="input-grid">
          <InputField label="Test No / Aralik" value={form.testNo} onChange={(value) => update('testNo', value)} placeholder="Orn. 14, 12-14, karma, 20 soru" inputType="text" />
          <InputField label="Boş" value={form.empty} onChange={(value) => update('empty', value)} placeholder="0" />
          <InputField label="Doğru" value={form.correct} onChange={(value) => update('correct', value)} placeholder="Örn. 24" />
          <InputField label="Yanlış" value={form.wrong} onChange={(value) => update('wrong', value)} placeholder="Örn. 6" />
        </div>
      </section>
      <section className="section">
        <h2 className="label-heading">Sonuç</h2>
        <div className="result-grid">
          <ResultButton active={form.status === 'cozuldu'} icon="check_circle" label="Çözüldü" onClick={() => update('status', 'cozuldu')} tone="success" />
          <ResultButton active={form.status === 'yanlisli'} icon="cancel" label="Yanlışlı" onClick={() => update('status', 'yanlisli')} tone="danger" />
          <ResultButton active={form.status === 'koca_sor'} icon="help" label="Koça Sor" onClick={() => update('status', 'koca_sor')} tone="warning" />
        </div>
      </section>
      <section className="section">
        <label className="field-label" htmlFor="coach-note">Koça Sorulacak Not</label>
        <input
          id="coach-note"
          className="input"
          onChange={(event) => update('coachNote', event.target.value)}
          placeholder="Örn. Problemler Test 14, 7. soruda yöntem seçimi"
          value={form.coachNote}
        />
        <button className="primary-button" type="submit">Sonucu Kaydet</button>
        <p className="helper-text">Kayıtlar bu tarayıcıda saklanır. Ortak hesap ve bulut kaydı sonraki aşamada eklenecek.</p>
      </section>
    </form>
    <TestResultsManager
      books={books}
      onDeleteResult={onDeleteResult}
      onUpdateResult={onUpdateResult}
      testResults={testResults}
    />
    </>
  );
}

function TestResultsManager({ books, onDeleteResult, onUpdateResult, testResults }) {
  const [query, setQuery] = useState('');
  const filteredResults = testResults.filter((result) => {
    const book = books.find((item) => item.id === result.bookId);
    const topic = book?.topics.find((item) => item.id === result.topicId);
    const searchTarget = normalizeText(`${book?.name ?? ''} ${topic?.name ?? ''} ${result.testNo} ${result.coachNote} ${result.status}`);
    return !query.trim() || searchTarget.includes(normalizeText(query));
  });

  return (
    <section className="section">
      <div className="section-title">
        <h2>Kayitli Testler</h2>
        <span className="chip muted">{testResults.length} kayit</span>
      </div>
      <div className="search-box">
        <Icon name="search" />
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kitap, konu, test no veya not ara..."
          type="text"
          value={query}
        />
      </div>
      <div className="stack">
        {testResults.length === 0 && <EmptyState text="Henuz test kaydi yok." />}
        {testResults.length > 0 && filteredResults.length === 0 && <EmptyState text="Bu aramayla eslesen test kaydi yok." />}
        {filteredResults.map((result) => (
          <TestResultRow
            book={books.find((item) => item.id === result.bookId)}
            key={result.id}
            onDelete={() => onDeleteResult(result.id)}
            onUpdate={(form) => onUpdateResult(result.id, form)}
            result={result}
          />
        ))}
      </div>
    </section>
  );
}

function TestResultRow({ book, onDelete, onUpdate, result }) {
  const topic = book?.topics.find((item) => item.id === result.topicId);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    testNo: result.testNo,
    correct: String(result.correct),
    wrong: String(result.wrong),
    empty: String(result.empty),
    status: result.status,
    coachNote: result.coachNote,
  });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (isEditing) {
    return (
      <div className="test-result-row editing">
        <div className="section-title">
          <strong>{book?.name ?? 'Kitap'} - {topic?.name ?? 'Konu'}</strong>
          <button className="text-button" onClick={() => setIsEditing(false)} type="button">Vazgec</button>
        </div>
        <div className="input-grid">
          <InputField label="Test No / Aralik" value={form.testNo} onChange={(value) => update('testNo', value)} placeholder="14, 12-14, karma" inputType="text" />
          <InputField label="Bos" value={form.empty} onChange={(value) => update('empty', value)} placeholder="0" />
          <InputField label="Dogru" value={form.correct} onChange={(value) => update('correct', value)} placeholder="24" />
          <InputField label="Yanlis" value={form.wrong} onChange={(value) => update('wrong', value)} placeholder="6" />
        </div>
        <label className="field">
          <span>Durum</span>
          <select value={form.status} onChange={(event) => update('status', event.target.value)}>
            <option value="cozuldu">Cozuldu</option>
            <option value="yanlisli">Yanlisli</option>
            <option value="koca_sor">Koca Sor</option>
          </select>
        </label>
        <label className="field">
          <span>Koc Notu</span>
          <input value={form.coachNote} onChange={(event) => update('coachNote', event.target.value)} />
        </label>
        <button
          className="primary-button"
          onClick={() => {
            onUpdate(form);
            setIsEditing(false);
          }}
          type="button"
        >
          Kaydi Guncelle
        </button>
      </div>
    );
  }

  return (
    <div className="test-result-row">
      <div>
        <strong>{book?.name ?? 'Kitap'} - Test {result.testNo}</strong>
        <span>{topic?.name ?? 'Konu'} - {result.correct}D / {result.wrong}Y / {result.empty}B</span>
        <span>{testEntryLabel(result)} - ilerlemeye {getResultSolvedCount(result)} test yansidi</span>
        {result.coachNote && <span>{result.coachNote}</span>}
      </div>
      <div className="row-actions">
        <button className="icon-button small-action" onClick={() => setIsEditing(true)} type="button" aria-label="Test kaydini duzenle">
          <Icon name="edit" />
        </button>
        <button className="icon-button small-action danger" onClick={onDelete} type="button" aria-label="Test kaydini sil">
          <Icon name="delete" />
        </button>
      </div>
    </div>
  );
}

function BookDetail({
  book,
  books,
  onAdd,
  onAddBookToSet,
  onAddTopic,
  onBack,
  onDeleteTopic,
  onImportTopics,
  onOpenBook,
  onUpdateBook,
  onUpdateTopic,
  testResults,
  userId,
}) {
  const topicImportRef = useRef(null);
  const [showBookEditor, setShowBookEditor] = useState(false);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [topicImportMessage, setTopicImportMessage] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const selectedTopicResults = selectedTopic
    ? testResults.filter((result) => result.bookId === book.id && result.topicId === selectedTopic.id)
    : [];
  const bookResultCount = testResults.filter((result) => result.bookId === book.id).length;
  const isSet = isSetContainer(book);
  const setChildren = isSet ? getSetChildren(books, book.id) : [];
  const setTotals = isSet ? getSetTotals(books, book.id) : null;

  const exportTopicDistribution = () => {
    const payload = createTopicDistributionExport(book);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kitaparsiv-konu-dagilimi-${safeFilePart(book.name)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setTopicImportMessage(`${book.topics.length} konu JSON olarak dışa aktarıldı.`);
  };

  const importTopicDistributionFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const importedTopics = parseTopicDistributionImport(parsed, book.name);
        const confirmed = window.confirm(
          `${book.name} kitabının mevcut konu dağılımı ${importedTopics.length} konu ile değiştirilsin mi?`
          + (bookResultCount > 0 ? ` Bu kitaba bağlı ${bookResultCount} detaylı test kaydı temizlenir.` : ''),
        );
        if (!confirmed) return;

        onImportTopics(book.id, importedTopics);
        setSelectedTopic(null);
        setShowTopicForm(false);
        setTopicImportMessage(`${importedTopics.length} konu içe aktarıldı.`);
      } catch (error) {
        setTopicImportMessage(error?.message || 'JSON okunamadı. Konu dağılımı şemasına uygun dosya seç.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <>
      <button className="back-button" onClick={onBack} type="button">
        <Icon name="arrow_back" />
        <span>{book.name}</span>
      </button>
      <section className="hero-card">
        <CoverHero book={book} />
        <ProgressRing value={bookProgress(book)} />
        <h1>{book.name}</h1>
        <p>{book.publisher} • {book.examType} {book.subject} • {statusLabel(book.status)}</p>
        <div className="summary-pills">
          {isSet ? (
            <>
              <span><Icon name="folder" /> {setTotals.bookCount} Kitap</span>
              <span><Icon name="task_alt" /> {setTotals.solvedTests}/{setTotals.totalTests} Test</span>
            </>
          ) : (
            <>
              <span><Icon name="library_books" /> {book.topics.length} Konu</span>
              <span><Icon name="task_alt" /> {book.solvedTests}/{book.totalTests} Test</span>
            </>
          )}
        </div>
        {!isSet && <button className="primary-button" onClick={onAdd} type="button">Test Sonucu Gir</button>}
        <button className="secondary-button" onClick={() => setShowBookEditor((value) => !value)} type="button">
          {showBookEditor ? 'Duzenlemeyi Kapat' : 'Kitabi Duzenle'}
        </button>
      </section>
      {showBookEditor && (
        <BookEditForm
          book={book}
          onCancel={() => setShowBookEditor(false)}
          onSave={(form) => {
            onUpdateBook(book.id, form);
            setShowBookEditor(false);
          }}
          userId={userId}
        />
      )}
      {isSet && (
        <SetBooksSection
          books={setChildren}
          onAddBook={(form) => onAddBookToSet(form, book.id)}
          onOpenBook={onOpenBook}
          parentSet={book}
          userId={userId}
        />
      )}
      {!isSet && (
      <section className="section topic-management">
        <div className="section-title">
          <h2>Konu Dagilimi</h2>
          <div className="topic-actions-row">
            <button className="secondary-inline-button" onClick={exportTopicDistribution} type="button">
              <Icon name="download" />
              JSON Dışa Aktar
            </button>
            <button className="secondary-inline-button" onClick={() => topicImportRef.current?.click()} type="button">
              <Icon name="upload" />
              JSON İçe Aktar
            </button>
            <button className="primary-inline-button" onClick={() => setShowTopicForm((value) => !value)} type="button">
              {showTopicForm ? 'Kapat' : 'Konu Ekle'}
            </button>
          </div>
        </div>
        <input
          accept="application/json,.json"
          className="hidden-file-input"
          onChange={importTopicDistributionFile}
          ref={topicImportRef}
          type="file"
        />
        {topicImportMessage && <p className="success-message">{topicImportMessage}</p>}
        {showTopicForm && (
          <TopicForm
            onCancel={() => setShowTopicForm(false)}
            onSave={(form) => {
              onAddTopic(book.id, form);
              setShowTopicForm(false);
            }}
          />
        )}
        <div className="stack">
          {book.topics.length === 0 && <EmptyState text="Bu kitapta henuz konu yok. Konu Ekle ile baslayabilirsin." />}
          {book.topics.map((topic) => (
            <TopicCard
              key={topic.id}
              onDelete={() => onDeleteTopic(book.id, topic.id)}
              onOpen={() => setSelectedTopic(topic)}
              onUpdate={(form) => onUpdateTopic(book.id, topic.id, form)}
              topic={topic}
            />
          ))}
        </div>
      </section>
      )}
      {selectedTopic && (
        <TopicStatsModal
          onClose={() => setSelectedTopic(null)}
          results={selectedTopicResults}
          topic={selectedTopic}
        />
      )}
    </>
  );
}

function SetBooksSection({ books, onAddBook, onOpenBook, parentSet, userId }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="section topic-management">
      <div className="section-title">
        <div>
          <h2>Set İçindeki Kitaplar</h2>
          <p>{books.length} kitap bu set klasörüne bağlı.</p>
        </div>
        <button className="primary-inline-button" onClick={() => setShowForm((value) => !value)} type="button">
          {showForm ? 'Kapat' : 'Kitap Ekle'}
        </button>
      </div>
      {showForm && (
        <BookForm
          onAddBook={(form) => {
            onAddBook(form);
            setShowForm(false);
          }}
          parentSet={parentSet}
          userId={userId}
        />
      )}
      <div className="stack">
        {books.length === 0 && <EmptyState text="Bu setin içinde henüz kitap yok. Kitap Ekle ile setin parçalarını ekleyebilirsin." />}
        {books.map((book) => (
          <article className="book-card" key={book.id}>
            <div className="card-top">
              <div className="chips-row compact">
                <span className="chip small">{book.subject}</span>
                <span className="chip small muted">{book.examType}</span>
                {book.bookFormat && <span className="chip small muted">{book.bookFormat}</span>}
                <span className="chip small primary">{statusLabel(book.status)}</span>
              </div>
            </div>
            <button className="book-card-main" onClick={() => onOpenBook(book.id)} type="button">
              <CoverThumb book={book} />
              <div>
                <h2>{book.name}</h2>
                <p>{book.publisher} - {book.topics.map((topic) => topic.name).slice(0, 2).join(', ')}</p>
              </div>
            </button>
            <ProgressLine label={`İlerleme - ${book.solvedTests}/${book.totalTests} test`} value={bookProgress(book)} />
          </article>
        ))}
      </div>
    </section>
  );
}

function BookEditForm({ book, onCancel, onSave, userId }) {
  const [form, setForm] = useState({
    name: book.name,
    publisher: book.publisher,
    examType: book.examType,
    subject: book.subject,
    catalog: book.catalog ?? 'Genel',
    bookFormat: book.bookFormat ?? 'Tek Kitap',
    setName: book.setName ?? '',
    status: book.status,
    coverImage: book.coverImage ?? '',
  });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="section-title">
        <h2>Kitap Bilgileri</h2>
        <button className="text-button" onClick={onCancel} type="button">Vazgec</button>
      </div>
      <label className="field">
        <span>Kitap Adi</span>
        <input value={form.name} onChange={(event) => update('name', event.target.value)} />
      </label>
      <label className="field">
        <span>Yayin</span>
        <input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} />
      </label>
      <div className="input-grid">
        <label className="field">
          <span>Ders</span>
          <select value={form.subject} onChange={(event) => update('subject', event.target.value)}>
            {subjectOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Tur</span>
          <select value={form.examType} onChange={(event) => update('examType', event.target.value)}>
            {examTypeOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="input-grid">
        <label className="field">
          <span>Katalog</span>
          <select value={form.catalog} onChange={(event) => update('catalog', event.target.value)}>
            {catalogOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Kitap Yapısı</span>
          <select value={form.bookFormat} onChange={(event) => update('bookFormat', event.target.value)}>
            {bookFormatOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Set / Fasikül Katalog Adı</span>
        <input value={form.setName} onChange={(event) => update('setName', event.target.value)} />
      </label>
      <label className="field">
        <span>Durum</span>
        <select value={form.status} onChange={(event) => update('status', event.target.value)}>
          <option value="aktif">Aktif</option>
          <option value="beklemede">Beklemede</option>
          <option value="baslanmadi">Baslanmadi</option>
          <option value="bitti">Bitti</option>
        </select>
      </label>
      <ImagePicker userId={userId} value={form.coverImage} onChange={(image) => update('coverImage', image)} />
      <button className="primary-button" type="submit">Kitabi Kaydet</button>
    </form>
  );
}

function TopicForm({ initialTopic, onCancel, onSave }) {
  const [form, setForm] = useState({
    name: initialTopic?.name ?? '',
    totalTests: String(initialTopic?.totalTests ?? ''),
    solvedTests: String(initialTopic?.solvedTests ?? ''),
    detail: initialTopic?.detail ?? '',
  });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.totalTests) return;
    onSave(form);
  };

  return (
    <form className="form-card compact-form" onSubmit={submit}>
      <label className="field">
        <span>Konu Adi</span>
        <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Orn. Problemler" />
      </label>
      <div className="input-grid">
        <label className="field">
          <span>Toplam Test</span>
          <input type="number" value={form.totalTests} onChange={(event) => update('totalTests', event.target.value)} />
        </label>
        <label className="field">
          <span>Cozulen Test</span>
          <input type="number" value={form.solvedTests} onChange={(event) => update('solvedTests', event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Not</span>
        <input value={form.detail} onChange={(event) => update('detail', event.target.value)} placeholder="Orn. 5 test kaldi" />
      </label>
      <div className="form-actions">
        <button className="secondary-button" onClick={onCancel} type="button">Vazgec</button>
        <button className="primary-inline-button" type="submit">Kaydet</button>
      </div>
    </form>
  );
}

function CoachDay({
  books,
  matchRules,
  onClearProgram,
  onClearProgramItemMatch,
  onDeleteProgramArchive,
  onImportProgram,
  onUpdateProgramItemMatch,
  onRestoreProgram,
  programArchives,
  programItems,
  recommendations,
  testResults,
}) {
  const [activeCoachTab, setActiveCoachTab] = useState('summary');
  const [importMessage, setImportMessage] = useState('');
  const coachQuestions = testResults.filter((result) => result.askCoach);
  const mustBring = recommendations.filter((item) => item.level === 'kesin_gotur');
  const niceToBring = recommendations.filter((item) => item.level === 'goturmen_iyi_olur');

  const coachTabs = [
    { id: 'summary', icon: 'insights', label: 'Özet' },
    { id: 'program', icon: 'event_note', label: 'Program', count: programItems.length },
    { id: 'history', icon: 'history', label: 'Geçmiş', count: programArchives.length },
    { id: 'questions', icon: 'help', label: 'Sorular', count: coachQuestions.length },
    { id: 'bring', icon: 'backpack', label: 'Götür', count: mustBring.length + niceToBring.length },
  ];

  const handleProgramFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const items = parseProgramExport(parsed, books, matchRules);
        const unmatchedCount = items.filter((item) => !item.matchedBookId).length;
        const archive = createProgramArchive(parsed, items, unmatchedCount);
        onImportProgram(items, archive);
        setImportMessage(`${items.length} program görevi içe aktarıldı.`);
        if (unmatchedCount) {
          setImportMessage(`${items.length} program gorevi ice aktarildi. ${unmatchedCount} gorev arsivdeki kitaplarla eslesmedi.`);
        }
      } catch {
        setImportMessage('JSON okunamadı. Ders programı dışa aktarma dosyasını seçtiğinden emin ol.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleClearProgram = () => {
    if (programItems.length === 0) {
      setImportMessage('Silinecek program gorevi yok.');
      return;
    }

    const confirmed = window.confirm('Ice aktarilan ders programi gorevleri silinsin mi? Kitaplar ve test sonuclari korunur.');
    if (!confirmed) return;

    onClearProgram();
    setImportMessage('Ders programi gorevleri silindi.');
  };

  return (
    <>
      <section className="page-heading">
        <h1>Koç Günü</h1>
        <p>Haftalık ilerlemeni gözden geçir, koça sorulacakları ve götürülecek kitapları netleştir.</p>
      </section>
      <nav className="coach-tabs" aria-label="Koç ekranı sekmeleri">
        {coachTabs.map((item) => (
          <button
            aria-current={activeCoachTab === item.id ? 'page' : undefined}
            className={activeCoachTab === item.id ? 'active' : ''}
            key={item.id}
            onClick={() => setActiveCoachTab(item.id)}
            type="button"
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {typeof item.count === 'number' && <strong>{item.count}</strong>}
          </button>
        ))}
      </nav>
      <div className="coach-tab-panel">
        {activeCoachTab === 'summary' && (
          <>
            <section className="form-card">
              <label className="field">
                <span>Ders Programı JSON İçe Aktar</span>
                <input accept="application/json,.json" onChange={handleProgramFile} type="file" />
                <small>Sayac program yedeğindeki `data.tasks` alanı okunur ve haftalık görev listesine dönüştürülür.</small>
              </label>
              {importMessage && <p className="success-message">{importMessage}</p>}
              <button className="danger-button" onClick={handleClearProgram} type="button">
                Ice Aktarilan Programi Sil
              </button>
            </section>
            <section className="info-card">
              <div className="section-title">
                <h2><Icon name="insights" filled /> Haftalık Özet</h2>
                <span className="chip muted">{programArchives[0]?.title ?? 'Program yok'}</span>
              </div>
              <div className="stats-grid">
                <StatCard icon="local_fire_department" value={books.filter((book) => book.status === 'aktif').length} label="Aktif Kitap" />
                <StatCard icon="trending_up" value={testResults.length} label="Kayıtlı Test" />
              </div>
              <p>{books.length === 0 ? 'Arşiv boş olduğu için taşıma önerisi üretilmiyor.' : 'Programdaki kitap adı ve koça sorulacak işaretler bu ekrandaki taşıma önerilerini belirler.'}</p>
            </section>
          </>
        )}

        {activeCoachTab === 'program' && (
          <section className="section">
            <div className="section-title">
              <h2>Haftalık Programdan Gelenler</h2>
              <span className="chip primary">Bağlı</span>
            </div>
            <div className="stack">
              {programItems.length === 0 && <EmptyState text="Henüz program içe aktarılmadı." />}
              {programItems.map((item) => (
                <ProgramRow
                  books={books}
                  item={item}
                  key={item.id}
                  onClearMatch={onClearProgramItemMatch}
                  onUpdateMatch={onUpdateProgramItemMatch}
                />
              ))}
            </div>
          </section>
        )}

        {activeCoachTab === 'history' && (
          <section className="section">
            <div className="section-title">
              <h2>Program Geçmişi</h2>
              <span className="chip muted">{programArchives.length} kayıt</span>
            </div>
            <div className="stack">
              {programArchives.length === 0 && <EmptyState text="Henüz program geçmişi yok." />}
              {programArchives.map((archive) => (
                <ProgramArchiveRow
                  key={archive.id}
                  archive={archive}
                  onDelete={onDeleteProgramArchive}
                  onRestore={onRestoreProgram}
                />
              ))}
            </div>
          </section>
        )}

        {activeCoachTab === 'questions' && (
          <section className="section">
            <h2>Koça Sorulacaklar</h2>
            {coachQuestions.length === 0 && (
              <EmptyState text="Koça sorulacak işaretli test yok." />
            )}
            {coachQuestions.map((result) => (
              <WarningRow key={result.id} title={result.coachNote || 'Koça sorulacak test'} meta={`${bookName(books, result.bookId)} • Test ${result.testNo}`} />
            ))}
          </section>
        )}

        {activeCoachTab === 'bring' && (
          <>
            <section className="section">
              <h2>Kesin Götür</h2>
              <div className="stack">
                {mustBring.length === 0 && (
                  <EmptyState text="Kesin götür önerisi yok." />
                )}
                {mustBring.map((item) => (
                  <BringRow key={item.book.id} item={item} />
                ))}
              </div>
            </section>
            <section className="section">
              <h2>Götürmen İyi Olur</h2>
              {niceToBring.length === 0 && (
                <EmptyState text="Ek öneri yok." />
              )}
              {niceToBring.map((item) => (
                <BringRow key={item.book.id} item={item} />
              ))}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function createProgramArchive(rawExport, items, unmatchedCount) {
  const data = rawExport?.data ?? {};
  const programDate = normalizeDateValue(data.date) || normalizeDateValue(rawExport?.exportedAt);
  const meetingNo = String(data.meetingNo ?? '').trim();
  const title = meetingNo
    ? `${meetingNo}. Koç Programı`
    : programDate
      ? `${formatDateLabel(programDate)} Programı`
      : 'Haftalık Program';

  return {
    id: createId('program_archive', `${title}_${Date.now()}`),
    title,
    programDate,
    meetingNo,
    advisor: String(data.advisor ?? '').trim(),
    studentName: String(data.studentName ?? '').trim(),
    source: rawExport?.app || 'ders_programi',
    itemCount: items.length,
    unmatchedCount,
    importedAt: new Date().toISOString(),
    items,
    rawExport,
  };
}

function normalizeDateValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value) {
  if (!value) return 'Tarih yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatDateTimeLabel(value) {
  if (!value) return 'Henüz yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function buildHealthReport({
  books,
  dataOwnerId,
  matchRules,
  programArchives,
  programItems,
  session,
  syncStatus,
  testResults,
}) {
  const issues = [];
  const bookIds = new Set(books.map((book) => book.id));
  const topicIds = new Set(books.flatMap((book) => (book.topics ?? []).map((topic) => topic.id)));

  if (session?.user?.id && dataOwnerId && session.user.id !== dataOwnerId) {
    issues.push({ level: 'critical', text: 'Ekrandaki veri aktif hesapla eşleşmiyor. Sayfayı yenile veya çıkış yapıp tekrar gir.' });
  }

  books.forEach((book) => {
    const topics = book.topics ?? [];
    const topicTotal = topics.reduce((sum, topic) => sum + (Number(topic.totalTests) || 0), 0);
    const topicSolved = topics.reduce((sum, topic) => sum + (Number(topic.solvedTests) || 0), 0);
    const bookTotal = Number(book.totalTests) || 0;
    const bookSolved = Number(book.solvedTests) || 0;

    if (topics.length === 0) {
      issues.push({ level: 'warning', text: `${book.name}: konu girilmemiş.` });
    }
    if (bookTotal !== topicTotal) {
      issues.push({ level: 'warning', text: `${book.name}: kitap toplamı (${bookTotal}) konu toplamıyla (${topicTotal}) eşleşmiyor.` });
    }
    if (bookSolved !== topicSolved) {
      issues.push({ level: 'warning', text: `${book.name}: çözülen test (${bookSolved}) konu çözümleriyle (${topicSolved}) eşleşmiyor.` });
    }
    if (bookSolved > bookTotal) {
      issues.push({ level: 'critical', text: `${book.name}: çözülen test toplam testi geçmiş.` });
    }

    topics.forEach((topic) => {
      const total = Number(topic.totalTests) || 0;
      const solved = Number(topic.solvedTests) || 0;
      if (total <= 0) {
        issues.push({ level: 'warning', text: `${book.name} / ${topic.name}: toplam test 0 veya boş.` });
      }
      if (solved > total) {
        issues.push({ level: 'critical', text: `${book.name} / ${topic.name}: çözülen test toplamı geçmiş.` });
      }
    });
  });

  testResults.forEach((result) => {
    if (!bookIds.has(result.bookId)) {
      issues.push({ level: 'critical', text: `Test ${result.testNo}: bağlı olduğu kitap arşivde yok.` });
    }
    if (result.topicId && !topicIds.has(result.topicId)) {
      issues.push({ level: 'warning', text: `Test ${result.testNo}: bağlı olduğu konu arşivde yok.` });
    }
  });

  const unmatchedProgramCount = programItems.filter((item) => !item.matchedBookId).length;
  if (unmatchedProgramCount > 0) {
    issues.push({ level: 'warning', text: `Aktif programda ${unmatchedProgramCount} görev kitapla eşleşmemiş.` });
  }

  const emptyArchiveCount = programArchives.filter((archive) => !Array.isArray(archive.items) || archive.items.length === 0).length;
  if (emptyArchiveCount > 0) {
    issues.push({ level: 'warning', text: `${emptyArchiveCount} program geçmişinde görev detayı yok.` });
  }

  const brokenMatchRules = matchRules.filter((rule) => rule.bookId && !bookIds.has(rule.bookId)).length;
  if (brokenMatchRules > 0) {
    issues.push({ level: 'warning', text: `${brokenMatchRules} eşleşme kuralı arşivde olmayan kitaba bağlı.` });
  }

  if (!isDemoSession(session) && syncStatus === 'error') {
    issues.push({ level: 'critical', text: 'Otomatik bulut senkronizasyonunda hata var.' });
  }

  const criticalCount = issues.filter((issue) => issue.level === 'critical').length;
  return {
    criticalCount,
    issues,
    status: criticalCount > 0 ? 'critical' : issues.length > 0 ? 'warning' : 'ready',
    warningCount: issues.length - criticalCount,
  };
}

function Profile({ books, onReset, programItems, testResults }) {
  const [resetMessage, setResetMessage] = useState('');

  const handleReset = async () => {
    const fresh = await onReset();
    setResetMessage(`Örnek veriler silindi: ${fresh.books.length} kitap, ${fresh.testResults.length} test kaydı, ${fresh.programItems.length} program görevi.`);
  };

  return (
    <section className="info-card">
      <h1>Profil</h1>
      <p>Veriler şu an bu tarayıcıdaki localStorage içinde saklanır. PC/telefon ortak hesap sonraki aşamada eklenecek.</p>
      <div className="profile-stats">
        <span>{books.length} kitap</span>
        <span>{testResults.length} test kaydı</span>
        <span>{programItems.length} program görevi</span>
      </div>
      <button className="danger-button" onClick={handleReset} type="button">Örnek Verileri Sil</button>
      {resetMessage && <p className="success-message">{resetMessage}</p>}
    </section>
  );
}

function SupabaseProfile({
  books,
  dataOwnerId,
  lastSavedAt,
  matchRules = [],
  onImportCloudData,
  onImportLibraryArchive,
  onReset,
  onSignOut,
  programItems,
  programArchives = [],
  session,
  syncStatus,
  testResults,
}) {
  const libraryImportRef = useRef(null);
  const [libraryMessage, setLibraryMessage] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const healthReport = useMemo(() => buildHealthReport({
    books,
    dataOwnerId,
    matchRules,
    programArchives,
    programItems,
    session,
    syncStatus,
    testResults,
  }), [books, dataOwnerId, matchRules, programArchives, programItems, session, syncStatus, testResults]);
  const syncLabel = isDemoSession(session)
    ? 'Demo'
    : syncStatus === 'synced'
      ? 'Kaydedildi'
      : syncStatus === 'syncing'
        ? 'Kaydediliyor'
        : syncStatus === 'error'
          ? 'Hata'
          : 'Bekliyor';
  const healthLabel = healthReport.status === 'ready'
    ? 'Yayına hazır'
    : healthReport.status === 'critical'
      ? 'Kritik kontrol'
      : 'Kontrol gerekli';

  const handleReset = async () => {
    const fresh = await onReset();
    setResetMessage(`Veriler sıfırlandı: ${fresh.books.length} kitap, ${fresh.testResults.length} test kaydı, ${fresh.programItems.length} program görevi.`);
  };

  const saveCloudBackup = async () => {
    if (isDemoSession(session)) {
      setSyncMessage('Demo hesap yalnızca bu tarayıcıda saklanır.');
      return;
    }
    if (!supabase || !session?.user) return;

    setSyncMessage('Buluta kaydediliyor...');
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      books,
      testResults,
      programItems,
      programArchives,
      matchRules,
    };
    const { error } = await supabase
      .from('app_states')
      .upsert({ user_id: session.user.id, data: payload }, { onConflict: 'user_id' });

    setSyncMessage(error ? error.message : 'Bulut yedeği kaydedildi.');
  };

  const loadCloudBackup = async () => {
    if (isDemoSession(session)) {
      setSyncMessage('Demo hesap için bulut yedeği kullanılmaz.');
      return;
    }
    if (!supabase || !session?.user) return;

    const confirmed = window.confirm('Buluttaki yedek bu cihazdaki verinin üzerine yazılsın mı?');
    if (!confirmed) return;

    setSyncMessage('Buluttan yükleniyor...');
    const { data, error } = await supabase
      .from('app_states')
      .select('data, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      setSyncMessage(error.message);
      return;
    }

    if (!data?.data) {
      setSyncMessage('Bulutta kayıtlı yedek bulunamadı.');
      return;
    }

    const imported = onImportCloudData(data.data);
    setSyncMessage(`Buluttan yüklendi: ${imported.books.length} kitap, ${imported.testResults.length} test kaydı.`);
  };

  const exportLibraryArchive = () => {
    const payload = {
      type: 'kitaparsiv-library-archive',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        books,
        testResults,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateLabel = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `kitaparsiv-kitaplik-${dateLabel}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setLibraryMessage(`${books.length} kitap ve ${testResults.length} test kaydı JSON olarak dışa aktarıldı.`);
  };

  const importLibraryArchiveFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const source = parsed?.data ?? parsed;
        if (!Array.isArray(source?.books)) {
          setLibraryMessage('JSON dosyasında kitap arşivi bulunamadı.');
          return;
        }

        const confirmed = window.confirm('Bu JSON dosyası mevcut kitaplık arşivinin üzerine yazılsın mı? Koç programı ve program geçmişi korunur.');
        if (!confirmed) return;

        const imported = onImportLibraryArchive(parsed);
        setLibraryMessage(`${imported.books.length} kitap ve ${imported.testResults.length} test kaydı içe aktarıldı.`);
      } catch {
        setLibraryMessage('JSON okunamadı. KitapArşiv kitaplık yedeği seçtiğinden emin ol.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <section className="info-card">
      <h1>Profil</h1>
      <div className="profile-user-row">
        <div className="profile-user-avatar">{session?.user?.email?.[0]?.toUpperCase() ?? '?'}</div>
        <div>
          <strong>{session?.user?.email}</strong>
          <span className="helper-text">Giriş yapıldı</span>
        </div>
      </div>
      <div className="profile-stats">
        <span>{books.length} kitap</span>
        <span>{testResults.length} test kaydı</span>
        <span>{programItems.length} program görevi</span>
        <span>{programArchives.length} program geçmişi</span>
        <span>{matchRules.length} eşleşme kuralı</span>
      </div>
      <section className={`health-panel ${healthReport.status}`}>
        <div className="section-title">
          <h2>Yayın Kontrolü</h2>
          <span className={`chip small ${healthReport.status === 'ready' ? 'primary' : 'muted'}`}>{healthLabel}</span>
        </div>
        <div className="health-grid">
          <div>
            <Icon name={healthReport.status === 'ready' ? 'verified' : 'rule'} filled />
            <strong>{healthReport.issues.length}</strong>
            <span>Bulgu</span>
          </div>
          <div>
            <Icon name="cloud_done" filled />
            <strong>{syncLabel}</strong>
            <span>Sync</span>
          </div>
          <div>
            <Icon name="save" filled />
            <strong>{formatDateTimeLabel(lastSavedAt)}</strong>
            <span>Son kayıt</span>
          </div>
          <div>
            <Icon name="inventory_2" filled />
            <strong>{books.length + testResults.length + programItems.length}</strong>
            <span>Veri parçası</span>
          </div>
        </div>
        {healthReport.issues.length === 0 && (
          <p className="success-message">Kritik veri tutarsızlığı bulunmadı. Arşiv yayına hazır görünüyor.</p>
        )}
        {healthReport.issues.length > 0 && (
          <div className="health-issue-list">
            {healthReport.issues.slice(0, 8).map((issue, index) => (
              <div className={`health-issue ${issue.level}`} key={`${issue.text}_${index}`}>
                <Icon name={issue.level === 'critical' ? 'error' : 'warning'} />
                <span>{issue.text}</span>
              </div>
            ))}
            {healthReport.issues.length > 8 && (
              <span className="helper-text">+{healthReport.issues.length - 8} ek bulgu daha var.</span>
            )}
          </div>
        )}
      </section>
      <section className="sync-panel">
        <div className="section-title">
          <h2>Bulut Yedeği</h2>
          <span className="chip small primary">Bağlı</span>
        </div>
        <div className="form-actions">
          <button className="primary-inline-button" onClick={saveCloudBackup} type="button">Buluta Kaydet</button>
          <button className="secondary-button" onClick={loadCloudBackup} type="button">Buluttan Yükle</button>
        </div>
        {syncMessage && <p className="success-message">{syncMessage}</p>}
      </section>
      <section className="sync-panel">
        <div className="section-title">
          <h2>Kitaplık JSON Yedeği</h2>
          <span className="chip small muted">Yerel</span>
        </div>
        <p className="helper-text">Sadece kitap arşivi ve test kayıtları yedeklenir. Koç programı, program geçmişi ve eşleşme kuralları korunur.</p>
        <div className="form-actions">
          <button className="primary-inline-button" onClick={exportLibraryArchive} type="button">JSON Dışa Aktar</button>
          <button className="secondary-button" onClick={() => libraryImportRef.current?.click()} type="button">JSON İçe Aktar</button>
        </div>
        <input
          accept="application/json,.json"
          className="hidden-file-input"
          onChange={importLibraryArchiveFile}
          ref={libraryImportRef}
          type="file"
        />
        {libraryMessage && <p className="success-message">{libraryMessage}</p>}
      </section>
      <button className="secondary-button full-width" onClick={onSignOut} type="button">
        <Icon name="logout" />
        Çıkış Yap
      </button>
      <div className="divider-line" />
      <button className="danger-button" onClick={handleReset} type="button">Örnek Verileri Sil</button>
      {resetMessage && <p className="success-message">{resetMessage}</p>}
    </section>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <div className="stat-card">
      <Icon name={icon} filled />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <Icon name="inbox" />
      <span>{text}</span>
    </div>
  );
}

function BookMiniCard({ book }) {
  return (
    <div className="mini-card">
      <h3>{book.name}</h3>
      <ProgressLine label={`${bookProgress(book)}% tamamlandı`} value={bookProgress(book)} />
    </div>
  );
}

function BringRow({ item }) {
  return (
    <div className={`bring-row ${item.level}`}>
      <div className="row-icon"><Icon name="menu_book" filled /></div>
      <div>
        <strong>{item.book.name}</strong>
        <span>{item.reasons[0]}</span>
      </div>
    </div>
  );
}

function WarningRow({ title, meta }) {
  return (
    <div className="warning-row">
      <Icon name="help" />
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
    </div>
  );
}

function countBy(items, getKey) {
  return items.reduce((map, item) => {
    const key = getKey(item) || 'Belirsiz';
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
}

function topEntries(map, limit = 8) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr'))
    .slice(0, limit);
}

function ProgramArchiveRow({ archive, onDelete, onRestore }) {
  const items = Array.isArray(archive.items) ? archive.items : [];
  const matchedCount = items.filter((item) => item.matchedBookId).length;
  const unmatchedCount = archive.unmatchedCount ?? Math.max(0, items.length - matchedCount);
  const dayRows = topEntries(countBy(items, (item) => item.day), 10);
  const bookRows = topEntries(countBy(items, (item) => item.matchedBookName || item.bookName), 10);
  const topicRows = topEntries(countBy(items, (item) => item.topicName), 10);

  return (
    <details className="program-archive-row">
      <summary>
        <Icon name="history" />
        <div>
          <strong>{archive.title}</strong>
          <span>
            {formatDateLabel(archive.programDate || archive.importedAt)}
            {archive.advisor ? ` • ${archive.advisor}` : ''}
            {archive.studentName ? ` • ${archive.studentName}` : ''}
          </span>
        </div>
        <span className="chip muted">{archive.itemCount ?? archive.items?.length ?? 0} görev</span>
      </summary>
      <div className="program-archive-detail">
        <div className="archive-analysis-grid">
          <StatCard icon="event_note" value={items.length || archive.itemCount || 0} label="Görev" />
          <StatCard icon="link" value={matchedCount} label="Eşleşen" />
          <StatCard icon="link_off" value={unmatchedCount} label="Eşleşmeyen" />
          <StatCard icon="calendar_month" value={dayRows.length} label="Gün" />
        </div>

        <div className="archive-analysis-section">
          <strong>Gün Dağılımı</strong>
          {dayRows.length === 0 && <span>Gün bilgisi yok.</span>}
          {dayRows.map((row) => (
            <div className="archive-analysis-row" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.count} görev</strong>
            </div>
          ))}
        </div>

        <div className="archive-analysis-section">
          <strong>Kitap Dağılımı</strong>
          {bookRows.length === 0 && <span>Kitap bilgisi yok.</span>}
          {bookRows.map((row) => (
            <div className="archive-analysis-row" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.count} görev</strong>
            </div>
          ))}
        </div>

        <details className="archive-topic-detail">
          <summary>Konu dağılımını göster</summary>
          <div className="archive-analysis-section compact">
            {topicRows.length === 0 && <span>Konu bilgisi yok.</span>}
            {topicRows.map((row) => (
              <div className="archive-analysis-row" key={row.label}>
                <span>{row.label}</span>
                <strong>{row.count} görev</strong>
              </div>
            ))}
          </div>
        </details>

        <p>
          {unmatchedCount > 0
            ? `${unmatchedCount} görev arşivdeki kitaplarla eşleşmedi.`
            : 'Tüm eşleşebilen görevler arşivle kontrol edildi.'}
        </p>
        <div className="program-archive-actions">
          <button className="secondary-button" onClick={() => onRestore(archive.id)} type="button">
            Bu Programı Aktif Yap
          </button>
          <button className="danger-button" onClick={() => onDelete(archive.id)} type="button">
            Geçmişten Sil
          </button>
        </div>
      </div>
    </details>
  );
}

function ProgramRow({ books, item, onClearMatch, onUpdateMatch }) {
  const [showMatcher, setShowMatcher] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(item.matchedBookId || books[0]?.id || '');
  const hasMatch = Boolean(item.matchedBookId);
  const matchLabel = item.matchType === 'manual'
    ? `${item.matchedBookName} ile elle eşleşti`
    : `${item.matchedBookName} ile eşleşti`;

  const saveMatch = () => {
    if (!selectedBookId) return;
    onUpdateMatch(item.id, selectedBookId);
    setShowMatcher(false);
  };

  return (
    <div className="program-row">
      <Icon name="event_note" />
      <div>
        {hasMatch && <span className="program-match success">{matchLabel}</span>}
        {!hasMatch && <span className="program-match warning">Arşivde kitap eşleşmesi yok</span>}
        <strong>{item.bookName} • {item.topicName}</strong>
        <span>{item.day} • {item.rawText}</span>
        {showMatcher && (
          <div className="program-match-editor">
            <select value={selectedBookId} onChange={(event) => setSelectedBookId(event.target.value)}>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
            <button className="primary-inline-button" disabled={!selectedBookId} onClick={saveMatch} type="button">
              Eşleştir
            </button>
          </div>
        )}
        <button className="text-button program-match-button" onClick={() => setShowMatcher((value) => !value)} type="button">
          {hasMatch ? 'Değiştir' : 'Kitapla eşleştir'}
        </button>
        {hasMatch && (
          <button className="text-button program-match-remove" onClick={() => onClearMatch(item.id)} type="button">
            Eşleşmeyi kaldır
          </button>
        )}
      </div>
    </div>
  );
}

function InputField({ inputType = 'number', label, placeholder, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={inputType} value={value} />
    </label>
  );
}

function ResultButton({ active, icon, label, onClick, tone }) {
  return (
    <button className={`result-button ${tone} ${active ? 'active' : ''}`} onClick={onClick} type="button">
      <Icon name={icon} filled />
      <span>{label}</span>
    </button>
  );
}

function TopicCard({ onDelete, onOpen, onUpdate, topic }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <TopicForm
        initialTopic={topic}
        onCancel={() => setIsEditing(false)}
        onSave={(form) => {
          onUpdate(form);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <button className={`topic-card topic-card-button ${topic.status}`} onClick={onOpen} type="button">
      <div>
        <h3>{topic.name}</h3>
        <p>{topic.solvedTests}/{topic.totalTests} Test Çözüldü • {topic.detail}</p>
        {topic.lastEntryType && topic.lastEntryType !== 'single' && (
          <span className="chip small muted">{topic.lastEntryType === 'range' ? 'Aralik kaydi' : 'Esnek kayit'}: {topic.lastEntryText}</span>
        )}
        <span className="chip small">{topicStatusLabel(topic.status)}</span>
        {topic.status === 'devam_ediyor' && <ProgressLine value={Math.round((topic.solvedTests / topic.totalTests) * 100)} />}
      </div>
      <div className="topic-actions">
        <button className="icon-button small-action" onClick={(event) => { event.stopPropagation(); setIsEditing(true); }} type="button" aria-label={`${topic.name} konusunu duzenle`}>
          <Icon name="edit" />
        </button>
        <button className="icon-button small-action danger" onClick={(event) => { event.stopPropagation(); onDelete(); }} type="button" aria-label={`${topic.name} konusunu sil`}>
          <Icon name="delete" />
        </button>
        <Icon name={topic.status === 'bitti' ? 'check_circle' : topic.status === 'devam_ediyor' ? 'schedule' : 'lock'} filled={topic.status === 'bitti'} />
      </div>
    </button>
  );
}

function TopicStatsModal({ onClose, results, topic }) {
  const totals = results.reduce(
    (acc, result) => ({
      correct: acc.correct + (Number(result.correct) || 0),
      wrong: acc.wrong + (Number(result.wrong) || 0),
      empty: acc.empty + (Number(result.empty) || 0),
      tracked: acc.tracked + getResultSolvedCount(result),
      askCoach: acc.askCoach + (result.askCoach ? 1 : 0),
    }),
    { correct: 0, wrong: 0, empty: 0, tracked: 0, askCoach: 0 },
  );
  const answered = totals.correct + totals.wrong;
  const accuracy = answered > 0 ? Math.round((totals.correct / answered) * 100) : 0;
  const remaining = Math.max(0, (Number(topic.totalTests) || 0) - (Number(topic.solvedTests) || 0));
  const progress = topic.totalTests ? Math.round((topic.solvedTests / topic.totalTests) * 100) : 0;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="topic-modal" role="dialog" aria-modal="true" aria-label={`${topic.name} istatistikleri`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="label-heading">Konu Istatistikleri</span>
            <h2>{topic.name}</h2>
          </div>
          <button className="icon-button small-action" onClick={onClose} type="button" aria-label="Pencereyi kapat">
            <Icon name="close" />
          </button>
        </div>

        <ProgressLine label={`${progress}% tamamlandi`} value={progress} />

        <div className="stats-grid modal-stats">
          <StatCard icon="task_alt" value={`${topic.solvedTests}/${topic.totalTests}`} label="Cozulen" />
          <StatCard icon="pending_actions" value={remaining} label="Kalan" />
          <StatCard icon="edit_note" value={topic.initialSolvedTests ?? 0} label="Baslangic" />
          <StatCard icon="history" value={totals.tracked || topic.trackedSolvedTests || 0} label="Takipli" />
          <StatCard icon="percent" value={accuracy ? `%${accuracy}` : '-'} label="Dogruluk" />
          <StatCard icon="help" value={totals.askCoach} label="Koca Sor" />
        </div>

        <div className="info-card compact-info">
          <strong>Kayit Ozeti</strong>
          <span>{totals.correct} dogru, {totals.wrong} yanlis, {totals.empty} bos</span>
          <span>{topic.lastEntryType && topic.lastEntryType !== 'single' ? `${topic.lastEntryText} son esnek/aralik kaydi` : 'Son kayit tek test veya baslangic ilerlemesi'}</span>
        </div>

        <div className="stack">
          <div className="section-title">
            <h3>Test Kayitlari</h3>
            <span className="chip muted">{results.length} kayit</span>
          </div>
          {results.length === 0 && <EmptyState text="Bu konu icin henuz detayli test kaydi yok." />}
          {results.map((result) => (
            <div className="modal-result-row" key={result.id}>
              <strong>Test {result.testNo}</strong>
              <span>{testEntryLabel(result)} - {getResultSolvedCount(result)} test</span>
              <span>{result.correct}D / {result.wrong}Y / {result.empty}B</span>
              {result.coachNote && <span>{result.coachNote}</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CoverThumb({ book }) {
  if (book.coverImage) {
    return <img className="cover-thumb" src={book.coverImage} alt={`${book.name} kapağı`} />;
  }
  return (
    <div className="cover-placeholder">
      <Icon name="menu_book" />
    </div>
  );
}

function CoverHero({ book }) {
  if (!book.coverImage) return null;
  return <img className="cover-hero" src={book.coverImage} alt={`${book.name} kapağı`} />;
}

function ProgressLine({ label, value }) {
  return (
    <div className="progress-block">
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <strong>{value}%</strong>
        </div>
      )}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ProgressRing({ value }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="progress-ring">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" fill="none" r={radius} stroke="#f2f4f6" strokeWidth="8" />
        <circle cx="50" cy="50" fill="none" r={radius} stroke="#4f46e5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" strokeWidth="8" />
      </svg>
      <div>
        <strong>{value}%</strong>
        <span>Tamamlandı</span>
      </div>
    </div>
  );
}


createRoot(document.getElementById('root')).render(<App />);
