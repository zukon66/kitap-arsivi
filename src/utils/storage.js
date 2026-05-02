export const storageKey = (userId) => `kitaparsiv.v1.${userId}`;

export const emptyState = () => ({ books: [], programItems: [], testResults: [] });

export function loadStoredState(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      books: parsed.books ?? [],
      programItems: parsed.programItems ?? [],
      testResults: parsed.testResults ?? [],
    };
  } catch {
    return emptyState();
  }
}

export function saveStoredState(userId, nextBooks, nextResults, nextProgramItems = []) {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ books: nextBooks, programItems: nextProgramItems, testResults: nextResults }),
    );
    return true;
  } catch {
    return false;
  }
}
