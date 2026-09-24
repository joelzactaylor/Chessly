export type Color = 'w' | 'b';

/** A node in a repertoire tree. The root has san === '' and ply 0. */
export interface RepNode {
  /** Position key after this move: board + turn + castling + ep (no clocks). */
  key: string;
  /** Full FEN after this move. */
  fen: string;
  san: string;
  uci: string;
  from?: string;
  to?: string;
  promotion?: string;
  /** 0 at root; otherwise the ply number of the move that created this node. */
  ply: number;
  /** Full-move number of the move that created this node (1 for both 1.e4 and 1...e5). */
  moveNumber: number;
  /** Side that played `san`. Undefined at the root. */
  color?: Color;
  /** Move quality suffix as written in the source: "!", "?", "!?", "?!", "!!", "??". */
  nag?: string;
  /** Annotation shown when this move is played or arrived at. */
  comment?: string;
  children: RepNode[];
  parent: RepNode | null;
  /** True when `san` was played by the repertoire owner (the learner). */
  userMove: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  /** One or two sentences shown on the chapter card. */
  summary: string;
  /** PGN movetext with {comments} and (variations). Variations are only allowed on opponent moves. */
  pgn: string;
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  /** Colour the learner plays in this course. */
  side: Color;
  /** Short paragraph(s) shown on the course page. Blank line separates paragraphs. */
  description: string;
  /** Key ideas shown as a bulleted list. */
  ideas: string[];
  chapters: Chapter[];
  /** Position FEN for the course card thumbnail. */
  thumbnailFen?: string;
}

export interface Line {
  /** Stable id: `${courseId}/${chapterId}/${sans joined by space}` */
  id: string;
  courseId: string;
  chapterId: string;
  /** Nodes excluding the root; nodes[0] is the first move. */
  nodes: RepNode[];
  /** Short label built from the moves at branch points, e.g. "2...Nf6 · 3...d5 · 5...Nc6". */
  title: string;
  userMoveCount: number;
}

export interface ParsedChapter {
  course: Course;
  chapter: Chapter;
  root: RepNode;
  lines: Line[];
  errors: string[];
}

export interface ParsedCourse {
  course: Course;
  chapters: ParsedChapter[];
  /** Every line in course order. */
  lines: Line[];
  errors: string[];
}
