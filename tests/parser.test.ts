import { describe, it, expect } from 'vitest';
import { parseIdeasFromDoc } from '../src/lib/parser';

describe('parseIdeasFromDoc', () => {
  it('parses valid markdown format into structured ideas', () => {
    const markdown = `
### ★ I-014 Interactive Webinar Companion
- Status: active
- Idea: A companion app for workshops replacing passive chat.
- Why it matters: Keeps participants engaged.
- Smallest next step: Build single-screen MVP.
    `;
    const ideas = parseIdeasFromDoc(markdown);
    expect(ideas).toHaveLength(1);
    expect(ideas[0].code).toBe('I-014');
    expect(ideas[0].title).toBe('I-014: Interactive Webinar Companion');
    expect(ideas[0].oneLiner).toContain('companion app for workshops');
    expect(ideas[0].status).toBe('pot');
  });

  it('marks dropped ideas as archived', () => {
    const markdown = `
### ★ I-005 Dropped Concept
- Status: dropped
- Idea: Old concept.
    `;
    const ideas = parseIdeasFromDoc(markdown);
    expect(ideas[0].status).toBe('archived');
  });

  it('handles empty or whitespace-only input gracefully', () => {
    expect(parseIdeasFromDoc('')).toEqual([]);
    expect(parseIdeasFromDoc('   \n\n   ')).toEqual([]);
  });

  it('handles malformed content without crashing and provides sensible defaults', () => {
    const malformed = `
Some intro text before headers.

### ★ Incomplete Idea Header
- Status: unknown_status
Just random body text without standard bullet keys.
    `;
    const ideas = parseIdeasFromDoc(malformed);
    expect(ideas).toHaveLength(1);
    expect(ideas[0].status).toBe('pot');
    expect(ideas[0].likesCount).toBe(0);
    expect(ideas[0].passesCount).toBe(0);
    expect(ideas[0].score).toBe(0);
  });

  it('parses multiple ideas and preserves order', () => {
    const markdown = `
### ★ I-001 Idea One
- Status: active
- Idea: First idea.

### ★ I-002 Idea Two
- Status: dropped
- Idea: Second idea.
    `;
    const ideas = parseIdeasFromDoc(markdown);
    expect(ideas).toHaveLength(2);
    expect(ideas[0].code).toBe('I-001');
    expect(ideas[0].status).toBe('pot');
    expect(ideas[1].code).toBe('I-002');
    expect(ideas[1].status).toBe('archived');
  });
});
