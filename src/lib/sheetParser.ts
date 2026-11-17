import { Idea } from '../types';

export const BLANK_SHEET_TEMPLATE_CSV = [
  'no,One-liner Description,Full Description,Further Read/Listen,Pot',
  '1,"Why I ditched 5 productivity apps for a plain-text file","A 10-minute video breakdown of my zero-notification workflow and how it doubled shipping speed.","https://youtube.com",yes',
  '2,"AI Voice Memo to Structured GitHub Issues","Speak a 30-second bug report while walking; auto-formats repro steps and opens a clean issue.","https://github.com",yes',
  '3,"Draft idea not ready yet","Keep this in the backlog until next sprint.","",no',
].join('\n');

export function downloadBlankSheetTemplate(): void {
  const blob = new Blob([BLANK_SHEET_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ideaswipe-sheet-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function extractSheetIdFromUrl(urlOrId: string): string {
  const trimmed = (urlOrId || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{10,}$/.test(trimmed)) return trimmed;
  return trimmed;
}

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((c) => c.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function isPotTruthy(val: string | undefined): boolean {
  if (!val) return true;
  const norm = val.trim().toLowerCase();
  return !['no', 'false', '0', 'archived', 'drop', 'dropped', 'out'].includes(norm);
}

/**
 * Parses a 5-column Google Sheet CSV:
 * 1. no
 * 2. One-liner Description
 * 3. Full Description
 * 4. Further Read/Listen
 * 5. Pot
 */
export function parseIdeasFromSheetCsv(csvText: string): Idea[] {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];

  const firstRowLower = rows[0].map((c) => c.toLowerCase());
  const hasHeader = firstRowLower.some(
    (c) => c.includes('one-liner') || c.includes('description') || c === 'no' || c === 'pot'
  );

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const parsed: Idea[] = [];
  const now = Date.now();

  dataRows.forEach((cols, idx) => {
    const no = (cols[0] || String(idx + 1)).trim();
    const oneLiner = (cols[1] || '').trim();
    const fullDesc = (cols[2] || '').trim();
    const furtherRead = (cols[3] || '').trim();
    const potRaw = cols[4];

    if (!oneLiner && !fullDesc) return;

    const code = no.toUpperCase().startsWith('I-') ? no.toUpperCase() : `I-${no.padStart(3, '0')}`;
    parsed.push({
      id: code.toLowerCase(),
      code,
      title: oneLiner || fullDesc,
      oneLiner: fullDesc || oneLiner,
      furtherRead: furtherRead || undefined,
      category: 'Sheet',
      status: isPotTruthy(potRaw) ? 'pot' : 'archived',
      likesCount: 0,
      passesCount: 0,
      score: 0,
      createdAt: now - idx * 1000,
      updatedAt: now,
    });
  });

  return parsed;
}
