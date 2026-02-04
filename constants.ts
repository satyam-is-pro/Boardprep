import { Subject, ExamDate } from './types';

export const MOTIVATIONAL_QUOTES = [
  "Success is the sum of small efforts, repeated day in and day out.",
  "Don't stop until you're proud.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Your board results will stay with you forever. Make them count.",
  "Discipline is doing what needs to be done, even if you don't want to do it.",
  "Dream big. Work hard. Stay focused.",
  "Eighty percent of success is showing up.",
  "It always seems impossible until it's done.",
  "You are capable of more than you know.",
  "Study hard, for the well is deep, and our brains are shallow."
];

// Based on the provided PDF/OCR content
export const EXAM_SCHEDULE: ExamDate[] = [
  { date: '17/02/2026', subject: 'Maths', daysLeft: 0 },
  { date: '21/02/2026', subject: 'English', daysLeft: 0 },
  { date: '25/02/2026', subject: 'Science', daysLeft: 0 },
  { date: '27/02/2026', subject: 'IT', daysLeft: 0 },
  { date: '02/03/2026', subject: 'Hindi', daysLeft: 0 },
  { date: '07/03/2026', subject: 'Social Science', daysLeft: 0 },
];

export const SUBJECTS_LIST = [
  Subject.Maths,
  Subject.Science,
  Subject.SST,
  Subject.English,
  Subject.Hindi,
  Subject.IT
];