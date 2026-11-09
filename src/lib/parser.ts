import { Idea, IdeaStatus } from '../types';

/**
 * Parses markdown content exported from Google Docs into structured Idea objects.
 * Expects the standard `### ★ I-xxx Title` schema with bulleted metadata.
 * Missing or malformed fields fall back to safe defaults without throwing.
 */
export function parseIdeasFromDoc(content: string): Idea[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/(?=^\s*###\s*)/m);
  const ideas: Idea[] = [];
  let fallbackCounter = 1;

  for (const block of blocks) {
    const lines = block.split('\n');
    const headerIndex = lines.findIndex(line => /^\s*###/.test(line));
    if (headerIndex === -1) {
      continue;
    }

    const headerLine = lines[headerIndex];
    const bodyLines = lines.slice(headerIndex + 1);

    // Clean header markdown and decorative star symbol
    const headerClean = headerLine
      .replace(/^\s*###\s*/, '')
      .replace(/^[★*]\s*/, '')
      .trim();

    if (!headerClean) {
      continue;
    }

    // Extract code (e.g. I-014) and raw title
    let code = '';
    let rawTitle = '';

    const codeMatch = headerClean.match(/^([A-Za-z0-9]+-\d+)(?:\s*:\s*|\s+)(.*)$/);
    if (codeMatch) {
      code = codeMatch[1].trim();
      rawTitle = codeMatch[2].trim();
    } else {
      const codeOnlyMatch = headerClean.match(/^([A-Za-z0-9]+-\d+)$/);
      if (codeOnlyMatch) {
        code = codeOnlyMatch[1].trim();
        rawTitle = '';
      } else {
        code = `I-${String(fallbackCounter).padStart(3, '0')}`;
        rawTitle = headerClean;
      }
    }

    fallbackCounter++;

    let title: string;
    if (rawTitle) {
      title = rawTitle.startsWith(`${code}:`) ? rawTitle : `${code}: ${rawTitle}`;
    } else {
      title = code;
    }

    let rawStatus = 'active';
    let oneLiner = '';
    let problemStatement = '';
    let targetAudience = '';
    let category = 'general';
    const extraText: string[] = [];
    let currentKey: string | null = null;

    for (const line of bodyLines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const bulletMatch = trimmed.match(/^[-*•]\s*([^:]+):\s*(.*)$/);
      if (bulletMatch) {
        const key = bulletMatch[1].trim().toLowerCase();
        const val = bulletMatch[2].trim();
        currentKey = key;

        if (key === 'status') {
          rawStatus = val.toLowerCase();
        } else if (
          key === 'idea' ||
          key === 'one-liner' ||
          key === 'one liner' ||
          key === 'summary' ||
          key === 'description'
        ) {
          oneLiner = val;
        } else if (
          key === 'why it matters' ||
          key === 'problem' ||
          key === 'problem statement'
        ) {
          problemStatement = val;
        } else if (
          key === 'smallest next step' ||
          key === 'next step' ||
          key === 'target audience' ||
          key === 'audience'
        ) {
          targetAudience = val;
        } else if (key === 'category') {
          category = val || 'general';
        }
      } else if (currentKey) {
        if (
          currentKey === 'idea' ||
          currentKey === 'one-liner' ||
          currentKey === 'one liner' ||
          currentKey === 'summary' ||
          currentKey === 'description'
        ) {
          oneLiner = oneLiner ? `${oneLiner} ${trimmed}` : trimmed;
        } else if (
          currentKey === 'why it matters' ||
          currentKey === 'problem' ||
          currentKey === 'problem statement'
        ) {
          problemStatement = problemStatement
            ? `${problemStatement} ${trimmed}`
            : trimmed;
        } else if (
          currentKey === 'smallest next step' ||
          currentKey === 'next step' ||
          currentKey === 'target audience' ||
          currentKey === 'audience'
        ) {
          targetAudience = targetAudience
            ? `${targetAudience} ${trimmed}`
            : trimmed;
        }
      } else {
        extraText.push(trimmed.replace(/^[-*•]\s*/, ''));
      }
    }

    if (!oneLiner && extraText.length > 0) {
      oneLiner = extraText.join(' ');
    }
    if (!oneLiner) {
      oneLiner = title;
    }

    const status: IdeaStatus =
      rawStatus === 'dropped' || rawStatus === 'archived' ? 'archived' : 'pot';

    const id = code ? code.toLowerCase() : `idea_${ideas.length + 1}`;

    ideas.push({
      id,
      code,
      title,
      oneLiner,
      problemStatement: problemStatement || undefined,
      targetAudience: targetAudience || undefined,
      category,
      status,
      likesCount: 0,
      passesCount: 0,
      score: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return ideas;
}
