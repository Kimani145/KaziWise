export interface QuestionOption {
  id: string;
  isCorrect: boolean;
}

export interface QuestionItem {
  id: string;
  options: QuestionOption[];
}

export interface ScoringResult {
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
}

/**
 * Pure, deterministic scoring function.
 * 
 * Rules:
 * 1. Unanswered questions are counted as wrong.
 * 2. Questions without an answer or with incorrect option id are counted as wrong.
 * 3. Empty question set is guarded to prevent division by zero (NaN) -> returns score 0, passed false.
 * 4. Pass condition is: score >= passMark.
 */
export function calculateScore(
  answers: Record<string, string> | undefined | null,
  questions: QuestionItem[],
  passMark: number
): ScoringResult {
  const totalQuestions = questions.length;

  if (totalQuestions === 0) {
    return {
      score: 0,
      passed: false,
      totalQuestions: 0,
      correctCount: 0,
    };
  }

  const safeAnswers = answers || {};
  let correctCount = 0;

  for (const question of questions) {
    const selectedOptionId = safeAnswers[question.id];
    if (!selectedOptionId) {
      // Unanswered question counts as wrong
      continue;
    }

    const correctOption = question.options.find((opt) => opt.isCorrect);
    if (correctOption && correctOption.id === selectedOptionId) {
      correctCount++;
    }
  }

  const score = Math.round((correctCount / totalQuestions) * 100);
  const passed = score >= passMark;

  return {
    score,
    passed,
    totalQuestions,
    correctCount,
  };
}
