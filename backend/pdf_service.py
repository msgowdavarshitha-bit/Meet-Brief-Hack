from io import BytesIO
from html import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfgen import canvas
from services import canonical_url


def create_pdf(brief):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 38
    body = ParagraphStyle('body', fontName='Helvetica', fontSize=9, leading=12)
    heading = ParagraphStyle('heading', fontName='Helvetica-Bold', fontSize=11, leading=15)
    title = ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=19, leading=24)
    truncated = False

    def write(text, style=body, trusted_markup=False):
        nonlocal y, truncated
        p = Paragraph(text if trusted_markup else escape(str(text)), style)
        _, h = p.wrap(width - 76, height)
        if y - h < 55:
            truncated = True
            return False
        p.drawOn(pdf, 38, y - h)
        y -= h + 5
        return True

    write('MeetBrief AI · ' + brief['name'], title)
    write(brief['purpose'] + ' · ' + brief['meeting_datetime'])
    window = brief['research_metadata']['window']
    write(f"Research window: {window['start']} – {window['end']}")
    for name, items in [('Executive summary', [brief['executive_summary']]), ('Background', brief['background']), ('Recent developments', [f"{d['date'] or 'Publication date unavailable'} · {d['status']} · {d['claim']} [{', '.join(map(str, d['source_ids']))}]" for d in brief['recent_developments']]), ('Opportunities · AI-generated recommendations', brief['opportunities']), ('Risks & considerations', brief['risks']), ('Questions', [q['question'] + ' — ' + q['rationale'] for q in brief['questions']])]:
        if not write(name, heading):
            break
        for item in items:
            if not write(item):
                break
    if write('Important sources', heading):
        for source in brief['sources']:
            try:
                url = canonical_url(source['url'])
            except ValueError:
                continue
            text = f"[{source['id']}] {source['publisher']} · {source['published_date'] or 'Publication date unavailable'}"
            if not write(f'<link href="{escape(url, quote=True)}">{escape(text)}</link>', trusted_markup=True):
                break
    pdf.setFont('Helvetica', 8)
    footer = 'Full details in app. Content prioritized to fit one page.' if truncated else 'Source-backed research · Bifrost analysis · Automated findings require judgment.'
    pdf.drawString(38, 30, footer)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()