import { describe, it, expect } from 'vitest';
import { calculateScore, QuestionItem } from './scoring.js';

describe('calculateScore pure scoring function', () => {
  const sampleQuestions: QuestionItem[] = [
    {
      id: 'q1',
      options: [
        { id: 'opt1-a', isCorrect: true },
        { id: 'opt1-b', isCorrect: false },
      ],
    },
    {
      id: 'q2',
      options: [
        { id: 'opt2-a', isCorrect: false },
        { id: 'opt2-b', isCorrect: true },
      ],
    },
    {
      id: 'q3',
      options: [
        { id: 'opt3-a', isCorrect: true },
        { id: 'opt3-b', isCorrect: false },
      ],
    },
    {
      id: 'q4',
      options: [
        { id: 'opt4-a', isCorrect: false },
        { id: 'opt4-b', isCorrect: true },
      ],
    },
  ];

  it('should give 100% and pass when all answers are correct', () => {
    const answers = {
      q1: 'opt1-a',
      q2: 'opt2-b',
      q3: 'opt3-a',
      q4: 'opt4-b',
    };

    const result = calculateScore(answers, sampleQuestions, 80);
    expect(result).toEqual({
      score: 100,
      passed: true,
      totalQuestions: 4,
      correctCount: 4,
    });
  });

  it('should give 0% and fail when all answers are wrong', () => {
    const answers = {
      q1: 'opt1-b',
      q2: 'opt2-a',
      q3: 'opt3-b',
      q4: 'opt4-a',
    };

    const result = calculateScore(answers, sampleQuestions, 50);
    expect(result).toEqual({
      score: 0,
      passed: false,
      totalQuestions: 4,
      correctCount: 0,
    });
  });

  it('should score partial correctly and evaluate against passMark', () => {
    // 2 out of 4 correct = 50%
    const answers = {
      q1: 'opt1-a', // correct
      q2: 'opt2-b', // correct
      q3: 'opt3-b', // wrong
      q4: 'opt4-a', // wrong
    };

    const passResult = calculateScore(answers, sampleQuestions, 50);
    expect(passResult.score).toBe(50);
    expect(passResult.passed).toBe(true);

    const failResult = calculateScore(answers, sampleQuestions, 70);
    expect(failResult.score).toBe(50);
    expect(failResult.passed).toBe(false);
  });

  it('should count unanswered questions as wrong', () => {
    // Learner only answered q1 correctly, left q2, q3, q4 blank
    const answers = {
      q1: 'opt1-a',
    };

    const result = calculateScore(answers, sampleQuestions, 50);
    expect(result.score).toBe(25);
    expect(result.correctCount).toBe(1);
    expect(result.passed).toBe(false);
  });

  it('should guard against empty question sets without returning NaN', () => {
    const result = calculateScore({}, [], 80);
    expect(result).toEqual({
      score: 0,
      passed: false,
      totalQuestions: 0,
      correctCount: 0,
    });
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('should handle null or undefined answers gracefully', () => {
    const resultNull = calculateScore(null, sampleQuestions, 50);
    expect(resultNull.score).toBe(0);
    expect(resultNull.passed).toBe(false);

    const resultUndef = calculateScore(undefined, sampleQuestions, 50);
    expect(resultUndef.score).toBe(0);
    expect(resultUndef.passed).toBe(false);
  });
});
