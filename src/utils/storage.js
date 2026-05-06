export const storageKey = (userId) => `kitaparsiv.v1.${userId}`;

export const emptyState = () => ({
  books: [],
  matchRules: [],
  programItems: [],
  programArchives: [],
  testResults: [],
});

export function loadStoredState(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      books: parsed.books ?? [],
      matchRules: parsed.matchRules ?? [],
      programItems: parsed.programItems ?? [],
      programArchives: parsed.programArchives ?? [],
      testResults: parsed.testResults ?? [],
    };
  } catch {
    return emptyState();
  }
}

export function saveStoredState(
  userId,
  nextBooks,
  nextResults,
  nextProgramItems = [],
  nextProgramArchives = [],
  nextMatchRules = [],
) {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        books: nextBooks,
        matchRules: nextMatchRules,
        programItems: nextProgramItems,
        programArchives: nextProgramArchives,
        testResults: nextResults,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
