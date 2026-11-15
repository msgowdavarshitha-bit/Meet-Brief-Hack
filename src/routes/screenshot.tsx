import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useRef, useState } from 'react';
import { Code2, Copy, Download, ImagePlus, LoaderCircle, Monitor, Smartphone, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Workspace, PageHeading, pageHead } from '@/components/workspace';
import { generatePage } from '@/lib/screenshot.functions';
import { isolatedPreview } from '@/lib/screenshot';

export const Route = createFileRoute('/screenshot')({ head: () => pageHead('Screenshot studio', 'Turn a website screenshot into a matching page and downloadable HTML with AI.'), component: ScreenshotStudio });

function ScreenshotStudio() {
  const generate = useServerFn(generatePage);
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [html, setHtml] = useState('');
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function upload(file?: File) {
    if (!file || busy) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Choose a PNG, JPEG or WebP screenshot.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Choose a screenshot smaller than 5 MB.'); return; }
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(); reader.onerror = reject; reader.readAsDataURL(file); });
      setImage(data); setName(file.name); setHtml(''); setCopied(false);
    } catch { setError('This image could not be opened. Choose another screenshot.'); }
  }

  async function submit() {
    setBusy(true); setError('');
    try {
      const result = await generate({ data: { image, notes } });
      if (result.error) setError(result.error);
      if (result.html) { setHtml(result.html); setView('preview'); setCopied(false); }
    } catch { setError('Generation could not finish. Your screenshot and notes are preserved.'); }
    finally { setBusy(false); }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a'); a.href = url; a.download = 'generated-page.html'; a.click(); URL.revokeObjectURL(url);
  }

  return <Workspace title="Screenshot studio">
    <PageHeading title="Screenshot studio" subtitle="Your reference. A new page." />
    <div className="grid xl:grid-cols-[320px_minmax(0,1fr)] gap-8">
      <section className="min-w-0 space-y-5">
        <div className="flex items-center justify-between"><h2 className="section-title">Reference</h2><span className="eyebrow text-primary">AI Gateway</span></div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload website screenshot" className="hidden" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="studio-upload" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0]); }}>
          {image ? <><img src={image} alt="Uploaded website reference" className="w-full max-h-80 object-contain" /><div className="flex items-center gap-2 mt-3"><p className="text-xs truncate flex-1">{name}</p><Button title="Remove screenshot" aria-label="Remove screenshot" size="icon" variant="ghost" disabled={busy} onClick={() => { setImage(''); setHtml(''); }}><X /></Button></div></> : <div className="min-h-48 flex flex-col items-center justify-center gap-4"><ImagePlus className="text-primary" size={32} /><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>Choose screenshot</Button><span className="text-xs text-muted-foreground">PNG, JPEG, WebP · Up to 5 MB</span></div>}
        </div>
        {image && <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><ImagePlus />Replace screenshot</Button>}
        <div className="field"><label htmlFor="design-notes">Design notes <span className="text-muted-foreground font-normal">(optional)</span></label><textarea id="design-notes" rows={3} maxLength={1000} disabled={busy} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Keep the layout, use our brand name…" /></div>
        <p className="text-xs text-muted-foreground leading-6">Your image is sent to AI Gateway. AI usage consumes workspace credits. Original photos may be approximated.</p>
        <Button className="w-full h-11" disabled={!image || busy} onClick={() => void submit()}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{busy ? 'Generating page…' : 'Generate page'}</Button>
        {error && <p role="alert" className="error-notice">{error}</p>}
      </section>
      <section className="min-w-0">
        <div className="flex flex-wrap justify-between gap-3 mb-4">
          <div className="flex gap-1"><Button variant={view === 'preview' ? 'secondary' : 'ghost'} onClick={() => setView('preview')}><Monitor />Preview</Button><Button variant={view === 'code' ? 'secondary' : 'ghost'} onClick={() => setView('code')}><Code2 />Code</Button></div>
          <div className="flex gap-1">{view === 'preview' && <><Button variant={!mobile ? 'secondary' : 'ghost'} size="icon" title="Desktop preview" aria-label="Desktop preview" onClick={() => setMobile(false)}><Monitor /></Button><Button variant={mobile ? 'secondary' : 'ghost'} size="icon" title="Mobile preview" aria-label="Mobile preview" onClick={() => setMobile(true)}><Smartphone /></Button></>}<Button variant="outline" size="icon" title={copied ? 'Copied' : 'Copy code'} aria-label={copied ? 'Copied' : 'Copy code'} disabled={!html} onClick={async () => { try { await navigator.clipboard.writeText(html); setCopied(true); } catch { setError('Copy was unavailable. Download the HTML instead.'); } }}><Copy /></Button><Button variant="outline" size="icon" title="Download HTML" aria-label="Download HTML" disabled={!html} onClick={download}><Download /></Button></div>
        </div>
        <div className="studio-output">
          {html ? view === 'code' ? <pre className="p-5 text-xs overflow-auto h-[620px] whitespace-pre"><code>{html}</code></pre> : <iframe title="Generated page preview" sandbox="" referrerPolicy="no-referrer" srcDoc={isolatedPreview(html)} className={`studio-frame ${mobile ? 'studio-frame-mobile' : ''}`} /> : <div className="min-h-[460px] flex flex-col items-center justify-center gap-4 text-muted-foreground" aria-live="polite">{busy ? <LoaderCircle className="animate-spin text-primary" size={32} /> : <Code2 size={36} />}<p>{busy ? 'Creating your matching page…' : 'No generated page yet'}</p></div>}
        </div>
      </section>
    </div>
  </Workspace>;
}