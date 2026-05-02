import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import {
  books as initialBooks,
  programItems,
  testResults as initialTestResults,
} from './data/sampleData';

const STORAGE_KEY = 'kitaparsiv.v1';

const navItems = [
  { id: 'dashboard', label: 'Panel', icon: 'dashboard' },
  { id: 'library', label: 'Arşiv', icon: 'auto_stories' },
  { id: 'add', label: 'Hızlı Ekle', icon: 'add_circle' },
  { id: 'coach', label: 'Koç', icon: 'psychology' },
  { id: 'profile', label: 'Profil', icon: 'person' },
];

const emptyBookForm = {
  name: '',
  publisher: '',
  examType: 'TYT',
  subject: 'Matematik',
  status: 'aktif',
  topicName: '',
  topicTotalTests: '',
  initialSolvedTests: '',
  coverImage: '',
};

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

function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        books: structuredClone(initialBooks),
        programItems: structuredClone(programItems),
        testResults: structuredClone(initialTestResults),
      };
    }
    const parsed = JSON.parse(raw);
    return {
      books: parsed.books ?? structuredClone(initialBooks),
      programItems: parsed.programItems ?? structuredClone(programItems),
      testResults: parsed.testResults ?? structuredClone(initialTestResults),
    };
  } catch {
    return {
      books: structuredClone(initialBooks),
      programItems: structuredClone(programItems),
      testResults: structuredClone(initialTestResults),
    };
  }
}

function saveStoredState(nextBooks, nextResults, nextProgramItems = programItems) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ books: nextBooks, programItems: nextProgramItems, testResults: nextResults }),
    );
    return true;
  } catch {
    return false;
  }
}

function getInitialPage() {
  const page = window.location.hash.replace('#', '');
  return navItems.some((item) => item.id === page) || page === 'book' ? page : 'dashboard';
}

function App() {
  const [appData, setAppData] = useState(loadStoredState);
  const [page, setPage] = useState(getInitialPage);
  const [selectedBookId, setSelectedBookId] = useState(appData.books[0]?.id);

  const selectedBook = appData.books.find((book) => book.id === selectedBookId) ?? appData.books[0];
  const recommendations = useMemo(
    () => getBringRecommendations(appData.books, appData.testResults, appData.programItems),
    [appData.books, appData.programItems, appData.testResults],
  );

  useEffect(() => {
    const syncPageFromHash = () => setPage(getInitialPage());
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);

  const navigate = (nextPage) => {
    setPage(nextPage);
    window.location.hash = nextPage;
  };

  const updateData = (nextBooks, nextResults = appData.testResults, nextProgramItems = appData.programItems) => {
    setAppData({ books: nextBooks, programItems: nextProgramItems, testResults: nextResults });
    saveStoredState(nextBooks, nextResults, nextProgramItems);
  };

  const addBook = (form) => {
    const totalTests = Number(form.topicTotalTests) || 0;
    const initialSolved = Math.min(Number(form.initialSolvedTests) || 0, totalTests);
    const topicId = createId('topic', form.topicName || 'konu');
    const book = {
      id: createId('book', form.name),
      name: form.name.trim(),
      publisher: form.publisher.trim() || 'Yayın bilgisi yok',
      examType: form.examType,
      subject: form.subject,
      status: form.status,
      isActiveRotation: form.status === 'aktif',
      totalTests,
      solvedTests: initialSolved,
      coverImage: form.coverImage,
      topics: [
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
    navigate('book');
  };

  const deleteBook = (bookId) => {
    const targetBook = appData.books.find((book) => book.id === bookId);
    if (!targetBook) return;

    const confirmed = window.confirm(`${targetBook.name} kitabını silmek istiyor musun? Bu kitaba bağlı test kayıtları da silinir.`);
    if (!confirmed) return;

    const nextBooks = appData.books.filter((book) => book.id !== bookId);
    const nextResults = appData.testResults.filter((result) => result.bookId !== bookId);
    updateData(nextBooks, nextResults);
    if (selectedBookId === bookId) {
      setSelectedBookId(nextBooks[0]?.id);
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
        status: form.status,
        isActiveRotation: form.status === 'aktif',
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
    navigate('book');
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
  };

  const resetData = () => {
    const fresh = { books: [], programItems: [], testResults: [] };
    localStorage.removeItem(STORAGE_KEY);
    saveStoredState(fresh.books, fresh.testResults, fresh.programItems);
    setAppData(fresh);
    setSelectedBookId(undefined);
    return fresh;
  };

  const importCloudData = (cloudData) => {
    const nextBooks = Array.isArray(cloudData?.books) ? cloudData.books : [];
    const nextResults = Array.isArray(cloudData?.testResults) ? cloudData.testResults : [];
    const nextProgramItems = Array.isArray(cloudData?.programItems) ? cloudData.programItems : [];

    updateData(nextBooks, nextResults, nextProgramItems);
    setSelectedBookId(nextBooks[0]?.id);
    return { books: nextBooks, testResults: nextResults, programItems: nextProgramItems };
  };

  const importProgram = (nextProgramItems) => {
    updateData(appData.books, appData.testResults, nextProgramItems);
  };

  const clearProgram = () => {
    updateData(appData.books, appData.testResults, []);
  };

  const openBook = (bookId) => {
    setSelectedBookId(bookId);
    navigate('book');
  };

  return (
    <AppShell page={page} onNavigate={navigate}>
      {page === 'dashboard' && (
        <Dashboard
          books={appData.books}
          onNavigate={navigate}
          recommendations={recommendations}
          testResults={appData.testResults}
        />
      )}
      {page === 'library' && (
        <FilteredLibrary
          books={appData.books}
          onAddBook={addBook}
          onDeleteBook={deleteBook}
          onOpenBook={openBook}
        />
      )}
      {page === 'add' && (
        <AddResult
          books={appData.books}
          onDeleteResult={deleteTestResult}
          onSave={addTestResult}
          onUpdateResult={updateTestResult}
          testResults={appData.testResults}
        />
      )}
      {page === 'book' && selectedBook && (
        <BookDetail
          book={selectedBook}
          onAdd={() => navigate('add')}
          onAddTopic={addTopic}
          onBack={() => navigate('library')}
          onDeleteTopic={deleteTopic}
          testResults={appData.testResults}
          onUpdateBook={updateBookDetails}
          onUpdateTopic={updateTopic}
        />
      )}
      {page === 'coach' && (
        <CoachDay
          books={appData.books}
          onClearProgram={clearProgram}
          onImportProgram={importProgram}
          programItems={appData.programItems}
          recommendations={recommendations}
          testResults={appData.testResults}
        />
      )}
      {page === 'profile' && (
        <SupabaseProfile
          books={appData.books}
          onImportCloudData={importCloudData}
          onReset={resetData}
          programItems={appData.programItems}
          testResults={appData.testResults}
        />
      )}
    </AppShell>
  );
}

function AppShell({ children, page, onNavigate }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="avatar">KA</div>
          <strong>KitapArşiv</strong>
        </div>
        <button className="icon-button" type="button" aria-label="Bildirimler">
          <Icon name="notifications" />
        </button>
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
      {showForm && <BookForm onAddBook={onAddBook} />}
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

function FilteredLibrary({ books, onAddBook, onDeleteBook, onOpenBook }) {
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
          <h1>Kitap Arsivi</h1>
          <button className="primary-inline-button" onClick={() => setShowForm((value) => !value)} type="button">
            {showForm ? 'Formu Kapat' : 'Kitap Ekle'}
          </button>
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
        <div className="chips-row">
          {filters.map((label) => (
            <button
              className={`chip ${activeFilter === label ? 'primary' : ''}`}
              key={label}
              onClick={() => setActiveFilter(label)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {showForm && <BookForm onAddBook={onAddBook} />}
      <section className="stack">
        {books.length === 0 && <EmptyState text="Henuz kitap yok. Kitap Ekle butonuyla gercek kitaplarini eklemeye baslayabilirsin." />}
        {books.length > 0 && filteredBooks.length === 0 && <EmptyState text="Bu arama veya filtreyle eslesen kitap yok." />}
        {filteredBooks.map((book) => (
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
                aria-label={`${book.name} kitabini sil`}
              >
                <Icon name="delete" />
              </button>
            </div>
            <button className="book-card-main" onClick={() => onOpenBook(book.id)} type="button">
              <CoverThumb book={book} />
              <div>
                <h2>{book.name}</h2>
                <p>{book.publisher} - {book.topics.map((topic) => topic.name).slice(0, 2).join(', ')}</p>
              </div>
            </button>
            <ProgressLine label={`Ilerleme - ${book.solvedTests}/${book.totalTests} test`} value={bookProgress(book)} />
          </article>
        ))}
      </section>
    </>
  );
}

function BookForm({ onAddBook }) {
  const [form, setForm] = useState(emptyBookForm);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.topicName.trim() || !form.topicTotalTests) return;
    onAddBook(form);
    setForm(emptyBookForm);
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
            {['Matematik', 'Türkçe', 'Fen', 'Fizik', 'Kimya', 'Biyoloji', 'Sosyal'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Tür</span>
          <select value={form.examType} onChange={(event) => update('examType', event.target.value)}>
            {['TYT', 'AYT', 'TYT-AYT'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
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
      <ImagePicker value={form.coverImage} onChange={(image) => update('coverImage', image)} />
      <button className="primary-button" type="submit">Kitabı Arşive Ekle</button>
    </form>
  );
}

function ImagePicker({ value, onChange }) {
  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <label className="field">
      <span>Kapak Görseli</span>
      <input accept="image/*" capture="environment" onChange={handleFile} type="file" />
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

function BookDetail({ book, onAdd, onAddTopic, onBack, onDeleteTopic, onUpdateBook, onUpdateTopic, testResults }) {
  const [showBookEditor, setShowBookEditor] = useState(false);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const selectedTopicResults = selectedTopic
    ? testResults.filter((result) => result.bookId === book.id && result.topicId === selectedTopic.id)
    : [];

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
          <span><Icon name="library_books" /> {book.topics.length} Konu</span>
          <span><Icon name="task_alt" /> {book.solvedTests}/{book.totalTests} Test</span>
        </div>
        <button className="primary-button" onClick={onAdd} type="button">Test Sonucu Gir</button>
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
        />
      )}
      <section className="section topic-management">
        <div className="section-title">
          <h2>Konu Dagilimi</h2>
          <button className="primary-inline-button" onClick={() => setShowTopicForm((value) => !value)} type="button">
            {showTopicForm ? 'Kapat' : 'Konu Ekle'}
          </button>
        </div>
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

function BookEditForm({ book, onCancel, onSave }) {
  const [form, setForm] = useState({
    name: book.name,
    publisher: book.publisher,
    examType: book.examType,
    subject: book.subject,
    status: book.status,
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
            {['Matematik', 'Turkce', 'Fen', 'Fizik', 'Kimya', 'Biyoloji', 'Sosyal'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Tur</span>
          <select value={form.examType} onChange={(event) => update('examType', event.target.value)}>
            {['TYT', 'AYT', 'TYT-AYT'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Durum</span>
        <select value={form.status} onChange={(event) => update('status', event.target.value)}>
          <option value="aktif">Aktif</option>
          <option value="beklemede">Beklemede</option>
          <option value="baslanmadi">Baslanmadi</option>
          <option value="bitti">Bitti</option>
        </select>
      </label>
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

function CoachDay({ books, onClearProgram, onImportProgram, programItems, recommendations, testResults }) {
  const [importMessage, setImportMessage] = useState('');

  const handleProgramFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const items = parseProgramExport(parsed, books);
        const unmatchedCount = items.filter((item) => !item.matchedBookId).length;
        onImportProgram(items);
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
          <span className="chip muted">12. Hafta</span>
        </div>
        <div className="stats-grid">
          <StatCard icon="local_fire_department" value={books.filter((book) => book.status === 'aktif').length} label="Aktif Kitap" />
          <StatCard icon="trending_up" value={testResults.length} label="Kayıtlı Test" />
        </div>
        <p>{books.length === 0 ? 'Arşiv boş olduğu için taşıma önerisi üretilmiyor.' : 'Programdaki kitap adı ve koça sorulacak işaretler bu ekrandaki taşıma önerilerini belirler.'}</p>
      </section>
      <section className="section">
        <div className="section-title">
          <h2>Haftalık Programdan Gelenler</h2>
          <span className="chip primary">Bağlı</span>
        </div>
        <div className="stack">
          {programItems.length === 0 && <EmptyState text="Henüz program içe aktarılmadı." />}
          {programItems.map((item) => (
            <ProgramRow key={item.id} item={item} />
          ))}
        </div>
      </section>
      <section className="section">
        <h2>Koça Sorulacaklar</h2>
        {testResults.filter((result) => result.askCoach).length === 0 && (
          <EmptyState text="Koça sorulacak işaretli test yok." />
        )}
        {testResults.filter((result) => result.askCoach).map((result) => (
          <WarningRow key={result.id} title={result.coachNote || 'Koça sorulacak test'} meta={`${bookName(books, result.bookId)} • Test ${result.testNo}`} />
        ))}
      </section>
      <section className="section">
        <h2>Kesin Götür</h2>
        <div className="stack">
          {recommendations.filter((item) => item.level === 'kesin_gotur').length === 0 && (
            <EmptyState text="Kesin götür önerisi yok." />
          )}
          {recommendations.filter((item) => item.level === 'kesin_gotur').map((item) => (
            <BringRow key={item.book.id} item={item} />
          ))}
        </div>
      </section>
      <section className="section">
        <h2>Götürmen İyi Olur</h2>
        {recommendations.filter((item) => item.level === 'goturmen_iyi_olur').length === 0 && (
          <EmptyState text="Ek öneri yok." />
        )}
        {recommendations.filter((item) => item.level === 'goturmen_iyi_olur').map((item) => (
          <BringRow key={item.book.id} item={item} />
        ))}
      </section>
    </>
  );
}

function Profile({ books, onReset, programItems, testResults }) {
  const [resetMessage, setResetMessage] = useState('');

  const handleReset = () => {
    const fresh = onReset();
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

function SupabaseProfile({ books, onImportCloudData, onReset, programItems, testResults }) {
  const [resetMessage, setResetMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [session, setSession] = useState(null);
  const [authMessage, setAuthMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleReset = () => {
    const fresh = onReset();
    setResetMessage(`Ornek veriler silindi: ${fresh.books.length} kitap, ${fresh.testResults.length} test kaydi, ${fresh.programItems.length} program gorevi.`);
  };

  const sendMagicLink = async (event) => {
    event.preventDefault();
    if (!supabase || !email.trim()) return;

    setAuthMessage('Giris baglantisi gonderiliyor...');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });

    setAuthMessage(error ? error.message : 'E-posta kutunu kontrol et. Giris baglantisi gonderildi.');
  };

  const submitPasswordAuth = async (event) => {
    event.preventDefault();
    if (!supabase || !email.trim() || !password) return;
    if (authMode === 'signup' && password !== passwordConfirm) {
      setAuthMessage('Sifreler eslesmiyor.');
      return;
    }

    setAuthMessage(authMode === 'signup' ? 'Hesap olusturuluyor...' : 'Giris yapiliyor...');
    const { error } = authMode === 'signup'
      ? await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      : await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage(authMode === 'signup'
      ? 'Hesap olusturuldu. Supabase e-posta dogrulama istiyorsa posta kutunu kontrol et.'
      : 'Giris yapildi.');
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthMessage('Cikis yapildi.');
  };

  const saveCloudBackup = async () => {
    if (!supabase || !session?.user) return;

    setSyncMessage('Buluta kaydediliyor...');
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      books,
      testResults,
      programItems,
    };
    const { error } = await supabase
      .from('app_states')
      .upsert({ user_id: session.user.id, data: payload }, { onConflict: 'user_id' });

    setSyncMessage(error ? error.message : 'Bulut yedegi kaydedildi.');
  };

  const loadCloudBackup = async () => {
    if (!supabase || !session?.user) return;

    const confirmed = window.confirm('Buluttaki yedek bu cihazdaki verinin uzerine yazilsin mi?');
    if (!confirmed) return;

    setSyncMessage('Buluttan yukleniyor...');
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
      setSyncMessage('Bulutta kayitli yedek bulunamadi.');
      return;
    }

    const imported = onImportCloudData(data.data);
    setSyncMessage(`Buluttan yuklendi: ${imported.books.length} kitap, ${imported.testResults.length} test kaydi.`);
  };

  return (
    <section className="info-card">
      <h1>Profil</h1>
      <p>Veriler localStorage icinde calisir. Supabase baglaninca ayni veri hesabina bulut yedegi olarak kaydedilir.</p>
      <div className="profile-stats">
        <span>{books.length} kitap</span>
        <span>{testResults.length} test kaydi</span>
        <span>{programItems.length} program gorevi</span>
      </div>
      <section className="sync-panel">
        <div className="section-title">
          <h2>Supabase Hesabi</h2>
          <span className={`chip small ${isSupabaseConfigured ? 'primary' : 'muted'}`}>
            {isSupabaseConfigured ? 'Hazir' : 'Env eksik'}
          </span>
        </div>
        {!isSupabaseConfigured && (
          <p className="helper-text">Supabase icin `.env.local` dosyasinda `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` gerekli.</p>
        )}
        {isSupabaseConfigured && !session && (
          <>
            <div className="auth-tabs">
              <button className={`chip ${authMode === 'signin' ? 'primary' : ''}`} onClick={() => setAuthMode('signin')} type="button">
                Giris
              </button>
              <button className={`chip ${authMode === 'signup' ? 'primary' : ''}`} onClick={() => setAuthMode('signup')} type="button">
                Kayit Ol
              </button>
            </div>
            <form className="sync-form" onSubmit={submitPasswordAuth}>
              <label className="field">
                <span>E-posta</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@mail.com" type="email" />
              </label>
              <label className="field">
                <span>Sifre</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="En az 6 karakter" type="password" />
              </label>
              {authMode === 'signup' && (
                <label className="field">
                  <span>Sifre Tekrar</span>
                  <input value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="Sifreyi tekrar yaz" type="password" />
                </label>
              )}
              <button className="primary-button" type="submit">
                {authMode === 'signup' ? 'Hesap Olustur' : 'Giris Yap'}
              </button>
            </form>
            <button className="text-button" onClick={sendMagicLink} type="button">
              Sifresiz magic link gonder
            </button>
          </>
        )}
        {session && (
          <>
            <p className="helper-text">Giris yapildi: {session.user.email}</p>
            <div className="form-actions">
              <button className="primary-inline-button" onClick={saveCloudBackup} type="button">Buluta Kaydet</button>
              <button className="secondary-button" onClick={loadCloudBackup} type="button">Buluttan Yukle</button>
            </div>
            <button className="text-button" onClick={signOut} type="button">Cikis Yap</button>
          </>
        )}
        {authMessage && <p className="success-message">{authMessage}</p>}
        {syncMessage && <p className="success-message">{syncMessage}</p>}
      </section>
      <button className="danger-button" onClick={handleReset} type="button">Ornek Verileri Sil</button>
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

function ProgramRow({ item }) {
  return (
    <div className="program-row">
      <Icon name="event_note" />
      <div>
        {item.matchedBookId && <span className="program-match success">{item.matchedBookName} ile eslesti</span>}
        {!item.matchedBookId && <span className="program-match warning">Arsivde kitap eslesmesi yok</span>}
        <strong>{item.bookName} • {item.topicName}</strong>
        <span>{item.day} • {item.rawText}</span>
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

function parseProgramExport(exportJson, books = []) {
  const tasks = exportJson?.data?.tasks;
  if (!tasks || typeof tasks !== 'object') {
    throw new Error('tasks alanı bulunamadı');
  }

  return Object.entries(tasks)
    .filter(([, rawText]) => String(rawText).trim())
    .map(([key, rawText], index) => {
      const [subjectKey, ...dayParts] = key.split('-');
      const day = normalizeProgramDay(dayParts.join('-'));
      const text = normalizeSpaces(rawText);
      const archiveMatch = findBestBookMatch(text, books);
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
        subject: subjectLabel(subjectKey),
        topicName: inferTopicName(text, bookName),
        testRange: inferTestRange(text),
        isRequired: true,
      };
    });
}

function getBringRecommendations(books, testResults, currentProgramItems) {
  const recommendations = [];
  const askCoachBookIds = new Set(testResults.filter((result) => result.askCoach).map((result) => result.bookId));

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

function bookProgress(book) {
  if (!book.totalTests) return 0;
  return Math.round((book.solvedTests / book.totalTests) * 100);
}

function recalculateBookTotals(book) {
  const totalTests = book.topics.reduce((sum, topic) => sum + (Number(topic.totalTests) || 0), 0);
  const solvedTests = book.topics.reduce((sum, topic) => sum + (Number(topic.solvedTests) || 0), 0);

  return {
    ...book,
    totalTests,
    solvedTests: Math.min(solvedTests, totalTests),
  };
}

function getSolvedTestCountInfo(value) {
  const text = normalizeSpaces(value);
  const rangeMatch = text.match(/^(\d+)\s*[-/]\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return { count: Math.max(1, Math.abs(end - start) + 1), type: 'range' };
    }
  }

  if (/^\d+$/.test(text)) {
    return { count: 1, type: 'single' };
  }

  const testCount = text.match(/\b(\d+)\s*test\b/i);
  if (testCount) {
    return { count: Math.max(1, Number(testCount[1]) || 1), type: 'count' };
  }

  return { count: 0, type: 'flex' };
}

function getResultSolvedCount(result) {
  if (!result) return 0;
  if (Number.isFinite(Number(result.solvedTestCount))) return Number(result.solvedTestCount);
  return getSolvedTestCountInfo(result.testNo).count || 1;
}

function testEntryLabel(result) {
  const type = result.testEntryType ?? getSolvedTestCountInfo(result.testNo).type;
  return {
    single: 'Tek test',
    range: 'Test araligi',
    count: 'Toplu test',
    flex: 'Esnek kayit',
  }[type] ?? 'Test kaydi';
}

function testResultTopicDetail(result) {
  if (result.askCoach) return 'koca sorulacak isaret var';
  const count = getResultSolvedCount(result);
  if (result.testEntryType === 'range') return `${result.testNo} araligi kaydedildi`;
  if (result.testEntryType === 'count') return `${count} test toplu kaydedildi`;
  if (result.testEntryType === 'flex') return `${result.testNo} esnek kayit`;
  return `${result.correct} dogru, ${result.wrong} yanlis`;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSpaces(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return normalizeSpaces(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');
}

function inferBookName(text) {
  const normalized = normalizeText(text);
  const knownBooks = [
    ['mikro orijinal', 'Mikro Orijinal'],
    ['mikro orjinal', 'Mikro Orijinal'],
    ['mikroorjinal', 'Mikro Orijinal'],
    ['bilgi sarmal', 'Bilgi Sarmal'],
    ['kafadengi', 'Kafadengi'],
    ['apotemi', 'Apotemi'],
    ['periskop', 'Periskop'],
    ['sonuc', 'Sonuç'],
  ];

  return knownBooks.find(([needle]) => normalized.includes(needle))?.[1] || '';
}

function inferTopicName(text, bookName) {
  let cleaned = normalizeSpaces(text)
    .replace(/\b\d+\s*test\b/gi, '')
    .replace(/\btest\s*\d+([-/]\d+)?\b/gi, '')
    .replace(/\b\d+\s+\d+\b/g, '')
    .replace(/\bçöz\b/gi, '')
    .trim();

  if (bookName) {
    cleaned = cleaned.replace(new RegExp(bookName, 'i'), '').trim();
  }

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

function isProgramBookMatch(item, book) {
  if (item.matchedBookId && item.matchedBookId === book.id) return true;

  const bookName = normalizeText(book.name);
  if (!bookName) return false;

  return normalizeText(item.bookName) === bookName
    || normalizeText(item.rawText).includes(bookName)
    || compactTextForMatch(item.rawText).includes(compactTextForMatch(book.name));
}

function getTopicMatch(book, programItem) {
  const rawText = normalizeText(programItem.rawText);
  const topicName = normalizeText(programItem.topicName);

  return book.topics.find((topic) => {
    const normalizedTopic = normalizeText(topic.name);
    return normalizedTopic && (rawText.includes(normalizedTopic) || topicName.includes(normalizedTopic));
  });
}

function findBestBookMatch(text, books) {
  const normalizedText = normalizeText(text);
  const compactText = compactTextForMatch(text);
  let bestMatch = null;

  books.forEach((book) => {
    const candidates = [
      { value: book.name, type: 'archive_name', baseScore: 100 },
      { value: `${book.publisher} ${book.name}`, type: 'publisher_name', baseScore: 95 },
      { value: `${book.name} ${book.subject}`, type: 'subject_name', baseScore: 88 },
    ];

    candidates.forEach((candidate) => {
      const normalizedCandidate = normalizeText(candidate.value);
      const compactCandidate = compactTextForMatch(candidate.value);
      if (!normalizedCandidate) return;

      let score = 0;
      if (normalizedText.includes(normalizedCandidate)) {
        score = candidate.baseScore;
      } else if (compactText.includes(compactCandidate)) {
        score = candidate.baseScore - 6;
      } else {
        score = tokenMatchScore(normalizedText, normalizedCandidate);
      }

      if (score >= 58 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { book, score, type: candidate.type };
      }
    });
  });

  return bestMatch;
}

function tokenMatchScore(text, candidate) {
  const textTokens = new Set(text.split(/\s+/).filter(Boolean).map(normalizeBookToken));
  const candidateTokens = candidate
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .map(normalizeBookToken)
    .filter((token) => token && !BOOK_MATCH_STOP_WORDS.has(token));

  if (candidateTokens.length === 0) return 0;

  const matchedTokens = candidateTokens.filter((token) => textTokens.has(token));
  const ratio = matchedTokens.length / candidateTokens.length;
  const hasDistinctiveToken = matchedTokens.some((token) => token.length >= 5 || /\d/.test(token));

  if (!hasDistinctiveToken) return 0;
  return Math.round(ratio * 86);
}

function compactTextForMatch(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function normalizeBookToken(token) {
  return token
    .replace('orjinal', 'orijinal')
    .replace('paragrafin', 'paragraf');
}

const BOOK_MATCH_STOP_WORDS = new Set([
  'tyt',
  'ayt',
  'yayin',
  'yayinlari',
  'kitap',
  'test',
  'soru',
  'coz',
]);

function subjectLabel(subjectKey) {
  return {
    matematik: 'Matematik',
    geometri: 'Geometri',
    turkce: 'Türkçe',
    fizik: 'Fizik',
    kimya: 'Kimya',
    biyoloji: 'Biyoloji',
  }[normalizeText(subjectKey)] || subjectKey;
}

function topicStatusFromCounts(solved, total) {
  if (solved <= 0) return 'baslanmadi';
  if (solved >= total) return 'bitti';
  return 'devam_ediyor';
}

function statusLabel(status) {
  return {
    baslanmadi: 'Başlanmadı',
    aktif: 'Aktif',
    beklemede: 'Beklemede',
    bitti: 'Bitti',
  }[status];
}

function topicStatusLabel(status) {
  return {
    baslanmadi: 'Başlanmadı',
    devam_ediyor: 'Devam Ediyor',
    bitti: 'Bitti',
  }[status];
}

function bookName(books, bookId) {
  return books.find((book) => book.id === bookId)?.name ?? 'Kitap';
}

function createId(prefix, value) {
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

createRoot(document.getElementById('root')).render(<App />);
