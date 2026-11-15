import { describe, expect, it } from 'vitest';
import { extractHtml, isolatedPreview, screenshotInput } from '@/lib/screenshot';

describe('Screenshot generation safety', () => {
  it('accepts image data but rejects remote image URLs', () => {
    expect(screenshotInput.safeParse({ image: 'data:image/png;base64,YQ==', notes: '' }).success).toBe(true);
    expect(screenshotInput.safeParse({ image: 'https://example.com/private.png', notes: '' }).success).toBe(false);
  });
  it('requires a complete page rather than partial code', () => {
    expect(() => extractHtml('<div>Partial</div>')).toThrow();
    expect(extractHtml('```html\n<html><head></head><body>Page</body></html>\n```')).toBe('<html><head></head><body>Page</body></html>');
  });
  it('blocks scripts, network access and form submissions inside the preview', () => {
    const output = isolatedPreview('<html><head></head><body></body></html>');
    expect(output).toContain("script-src 'none'");
    expect(output).toContain("connect-src 'none'");
    expect(output).toContain("form-action 'none'");
  });
});