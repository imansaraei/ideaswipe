import { describe, it, expect } from 'vitest';
import { themeColors } from '../src/styles/tokens';

describe('Abyssal Jade Theme Tokens', () => {
  it('defines correct obsidian canvas and jade/mint brand colors', () => {
    expect(themeColors.canvas).toBe('#030705');
    expect(themeColors.jadeAccent).toBe('#10b981');
    expect(themeColors.mintText).toBe('#d1fae5');
  });
});
