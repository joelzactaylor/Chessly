import { moveLabel } from './chessUtils';
import { makeRoot, parseMovetext } from './pgn';
import type { Chapter, Course, Line, ParsedChapter, ParsedCourse, RepNode } from './types';

export function parseChapter(course: Course, chapter: Chapter): ParsedChapter {
  const root = makeRoot();
  const { errors } = parseMovetext(chapter.pgn, root, course.side);
  // Single-line rule: at every position where the learner is to move there must be exactly one move.
  walk(root, (n) => {
    const userToMove = n.children.length > 0 && n.children[0].userMove;
    if (userToMove && n.children.length > 1) {
      errors.push(
        `Chapter "${chapter.title}": more than one learner move after ${pathString(n)}: ${n.children.map((c) => c.san).join(', ')}`,
      );
    }
  });
  const lines = collectLines(course, chapter, root);
  return { course, chapter, root, lines, errors };
}

export function parseCourse(course: Course): ParsedCourse {
  const chapters = course.chapters.map((ch) => parseChapter(course, ch));
  const errors = chapters.flatMap((c) => c.errors);
  // Cross-chapter consistency: the same position must always get the same learner move.
  const seen = new Map<string, { san: string; chapter: string }>();
  for (const pc of chapters) {
    walk(pc.root, (n) => {
      if (n.children.length && n.children[0].userMove) {
        const san = n.children[0].san;
        const prev = seen.get(n.key);
        if (prev && prev.san !== san) {
          errors.push(
            `Conflict at ${pathString(n)}: "${prev.chapter}" plays ${san === prev.san ? '' : prev.san} but "${pc.chapter.title}" plays ${san}`,
          );
        } else if (!prev) seen.set(n.key, { san, chapter: pc.chapter.title });
      }
    });
  }
  return { course, chapters, lines: chapters.flatMap((c) => c.lines), errors };
}

export function walk(node: RepNode, fn: (n: RepNode) => void): void {
  fn(node);
  for (const c of node.children) walk(c, fn);
}

export function pathNodes(node: RepNode): RepNode[] {
  const out: RepNode[] = [];
  let n: RepNode | null = node;
  while (n && n.parent) {
    out.unshift(n);
    n = n.parent;
  }
  return out;
}

export function pathString(node: RepNode): string {
  const nodes = pathNodes(node);
  if (!nodes.length) return 'the starting position';
  return nodes
    .map((n, i) => (n.color === 'w' || i === 0 ? `${moveLabel(n.moveNumber, n.color!)}${n.san}` : n.san))
    .join(' ');
}

/** Compact SAN string for a sequence of nodes, e.g. "1.e4 e5 2.Nc3". */
export function sanString(nodes: RepNode[], fromIndex = 0): string {
  return nodes
    .slice(fromIndex)
    .map((n, i) => (n.color === 'w' || i === 0 ? `${moveLabel(n.moveNumber, n.color!)}${n.san}` : n.san))
    .join(' ');
}

export function collectLines(course: Course, chapter: Chapter, root: RepNode): Line[] {
  const lines: Line[] = [];
  const visit = (n: RepNode) => {
    if (!n.children.length) {
      if (n === root) return;
      const nodes = pathNodes(n);
      const branchMoves = nodes.filter((x) => x.parent && x.parent.children.length > 1);
      const title = branchMoves.length
        ? branchMoves.map((x) => `${moveLabel(x.moveNumber, x.color!)}${x.san}`).join(' · ')
        : 'Main line';
      lines.push({
        id: `${course.id}/${chapter.id}/${nodes.map((x) => x.san).join(' ')}`,
        courseId: course.id,
        chapterId: chapter.id,
        nodes,
        title,
        userMoveCount: nodes.filter((x) => x.userMove).length,
      });
      return;
    }
    for (const c of n.children) visit(c);
  };
  visit(root);
  return lines;
}

/** Find the node reached by playing `sans` from root, or null. */
export function findByPath(root: RepNode, sans: string[]): RepNode | null {
  let n: RepNode = root;
  for (const s of sans) {
    const c = n.children.find((x) => x.san === s);
    if (!c) return null;
    n = c;
  }
  return n;
}

/** All leaf lines that pass through `node`. */
export function linesThrough(lines: Line[], node: RepNode): Line[] {
  return lines.filter((l) => l.nodes.includes(node));
}

export function countNodes(root: RepNode): { total: number; user: number } {
  let total = 0;
  let user = 0;
  walk(root, (n) => {
    if (n.parent) {
      total++;
      if (n.userMove) user++;
    }
  });
  return { total, user };
}
