import type { Color, Course } from '../lib/types';

export const COURSE_RULES_VERSION = 8;
export const OPPONENT_REPLY_THRESHOLD = 1;
/** A guard against endless analysis, never a claim that a branch is learned. */
export const GENERATED_MAX_PLY = 30;
export const STOP_RULES = {
  advantageCp: 200,
  stableAssessments: 3,
  settledMinPly: 24,
  minimumGames: 200,
};

export interface CourseRule {
  id: string;
  title: string;
  subtitle: string;
  side: Color;
  description: string;
  ideas: string[];
  thumbnailFen?: string;
  /** Entry paths establish the chosen opening; generation begins after each path. */
  entries: string[];
  /** Opening-identity moves tried in order before Stockfish is consulted. */
  recipe?: string[];
}

export const courseRules: CourseRule[] = [
  {
    id: 'vienna',
    title: 'The Vienna Game',
    subtitle: 'White vs 1...e5 — 1.e4 e5 2.Nc3',
    side: 'w',
    description: 'Built from what 1600–2000 players actually play. Every opponent reply used in at least 1% of games is included; your side always gets one Stockfish-approved move.',
    ideas: ['Keep the f-pawn free for f4.', 'Develop quickly and pressure e5.', 'The generated tree follows practical frequency, not a hand-picked theory syllabus.'],
    thumbnailFen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2',
    entries: ['1.e4 e5 2.Nc3', '1.e4 e5 2.Nc3 Nf6 3.f4'],
    recipe: ['f4'],
  },
  {
    id: 'grand-prix',
    title: 'The Grand Prix Attack',
    subtitle: 'White vs the Sicilian — 1.e4 c5 2.Nc3',
    side: 'w',
    description: 'A frequency-built Grand Prix repertoire. Common club replies branch; your move never does.',
    ideas: ['Build with f4 and Nf3.', 'Use Bb5 when it creates useful pressure.', 'Stockfish takes over whenever the opening recipe no longer applies.'],
    entries: ['1.e4 c5 2.Nc3'],
    recipe: ['f4', 'Nf3', 'Bb5'],
  },
  {
    id: 'white-vs-rest',
    title: 'White vs Everything Else',
    subtitle: 'French, Caro-Kann, Scandinavian, Pirc, Modern and Alekhine',
    side: 'w',
    description: 'The site discovers the common continuations after each major alternative to 1...e5 and 1...c5, then gives White one engine move in every position.',
    ideas: ['Take the centre when it is offered.', 'The engine chooses one continuation; only the opponent branches.', 'Replies below 1% are deliberately omitted.'],
    entries: ['1.e4 e6', '1.e4 c6', '1.e4 d5', '1.e4 d6', '1.e4 g6', '1.e4 Nf6'],
  },
  {
    id: 'scandinavian',
    title: 'The Scandinavian',
    subtitle: 'Black vs 1.e4 — 1...d5 and the 3...Qd8 system',
    side: 'b',
    description: 'A practical Scandinavian generated from White’s real choices. The recipe preserves your Qd8 system; Stockfish chooses one move once the position leaves it.',
    ideas: ['Challenge 1.e4 immediately with ...d5.', 'After exd5 and Nc3, use the low-theory ...Qd8 retreat.', 'Develop with ...Nf6, ...Bf5 and ...e6 when the position permits.'],
    entries: ['1.e4 d5'],
    recipe: ['Qxd5', 'Qd8', 'Nf6', 'Bf5', 'e6', 'c6', 'Be7', 'O-O'],
  },
  {
    id: 'kings-indian',
    title: "The King's Indian Defence",
    subtitle: 'Black vs 1.d4, 1.c4 and 1.Nf3 — ...Nf6, ...g6, ...Bg7',
    side: 'b',
    description: 'A generated King’s Indian shell against the three common closed-game move orders. The KID setup is preserved before Stockfish takes over.',
    ideas: ['Build the kingside fianchetto with ...g6 and ...Bg7.', 'Use ...d6 and castle before striking with ...e5 or ...c5.', 'Every White reply at or above 1% receives exactly one answer.'],
    entries: ['1.d4 Nf6', '1.c4 Nf6', '1.Nf3 Nf6'],
    recipe: ['g6', 'Bg7', 'd6', 'O-O'],
  },
];

export function seedCourses(): Course[] {
  return courseRules.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    side: r.side,
    description: r.description,
    ideas: r.ideas,
    thumbnailFen: r.thumbnailFen,
    // The shell intentionally has no trainable lines. Only the boot-time compiler
    // creates chapters, so a seed can never be mistaken for course content.
    chapters: [],
  }));
}
