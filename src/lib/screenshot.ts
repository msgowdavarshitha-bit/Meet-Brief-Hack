import { z } from 'zod';

export const screenshotInput = z.object({
  image: z.string().max(7_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/),
  notes: z.string().max(1000),
});

export function extractHtml(text: string) {
  const html = text.trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '');
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) throw new Error('The model did not return a complete page. Your screenshot is still available.');
  return html;
}

export function isolatedPreview(html: string) {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
  return html.replace(/<head[^>]*>/i, match => `${match}${policy}`);
}