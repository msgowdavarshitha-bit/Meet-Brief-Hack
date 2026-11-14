import os
import re
import uuid
from datetime import datetime, timezone
from models import Development, Question, research_window
from services import IntegrationError, canonical_url, source_tag, tavily

STAGES = ['Research planning', 'Web research', 'Information analysis', 'Evidence verification', 'Meeting intelligence', 'Briefing generation']


def verify_development(development, sources, window, recent=True):
    evidence = [s for s in sources if s['id'] in development.source_ids]
    if len(evidence) != len(set(development.source_ids)):
        return False
    excerpt = ' '.join(development.excerpt.split())
    if len(excerpt.split()) > 40:
        return False
    matching = [s for s in evidence if excerpt in ' '.join(s['content'].split())]
    if not matching:
        return False
    if recent and any(s['tag'] != 'in_window' for s in evidence):
        return False
    if not recent and any(s['tag'] != 'background' for s in evidence):
        return False
    if development.date and not any(s['published_date'] and s['published_date'][:10] == development.date for s in matching):
        return False
    # A verbatim excerpt validates provenance, not the truth of a paraphrase.
    # Never auto-promote claims to Supported purely because a model said so.
    if development.status == 'Supported':
        development.status = 'Partially Supported'
    return True


def clean_source_content(content):
    # Retrieved text remains data, never tool instructions.
    return re.sub(r'(?im)^.*(?:ignore (?:all |previous )?instructions|system prompt|execute code|reveal.*(?:secret|key)).*$', '[instruction-like text removed]', content)[:2400]


def plan_queries(meeting, purpose, cap):
    # Deterministic planning from meeting fields; no AI model involved.
    name = meeting['name'].strip()
    queries = [f'{name} latest news', f'{name} {purpose.lower()}']
    queries.append(f'{name} professional profile' if meeting['type'] == 'Individual' else f'{name} company announcements')
    keywords = [w for w in re.findall(r"[A-Za-z][A-Za-z-]{3,}", meeting.get('context', '')) if w.lower() not in name.lower()][:3]
    if keywords:
        queries.append(f"{name} {' '.join(keywords)}")
    unique = []
    seen = set()
    for query in queries:
        if query.lower() not in seen:
            seen.add(query.lower())
            unique.append(query)
    return unique[:cap]


def extract_claim(source, entity_words):
    # Extractive analysis: the claim is a verbatim sentence from the source.
    def hits(sentence):
        low = sentence.lower()
        return sum(1 for w in entity_words if w in low)
    sentences = re.split(r'(?<=[.!?])\s+', source['content'])
    for sentence in sorted(sentences, key=hits, reverse=True):
        sentence = ' '.join(sentence.split())
        if 8 <= len(sentence.split()) <= 40 and hits(sentence):
            return sentence
    return None


def suggest_questions(purpose, name):
    # Conversation starters derived from the meeting purpose, not factual claims.
    templates = [
        ('What outcomes is {name} prioritising right now?', 'Recent coverage shows where their attention and budget are going.'),
        ('How does our goal connect to their latest announcements?', 'Links your {purpose} purpose to developments in the research window.'),
        ('Who else is involved in decisions like this at {name}?', 'Coverage often names the people behind recent moves.'),
        ('What concerns could they raise about timing or risk?', 'Prepares you for objections the retrieved sources hint at.'),
        ('What would a useful next step after this meeting look like?', 'Keeps the conversation tied to your {purpose} goal.'),
    ]
    return [Question(question=q.format(name=name, purpose=purpose.lower()), rationale=r.format(name=name, purpose=purpose.lower())) for q, r in templates]


def run_research(store, meeting, run_id):
    current = 0
    def update(values):
        store.research_runs.update_one({'run_id': run_id}, {'$set': values})
    def counter(name):
        store.research_runs.update_one({'run_id': run_id}, {'$inc': {f'counters.{name}': 1}})
    def stage(index, status):
        update({f'stages.{index}.status': status})
    try:
        update({'status': 'running'})
        stage(0, 'running')
        window = research_window(datetime.fromisoformat(meeting['meeting_datetime']), meeting['timezone'], datetime.now(timezone.utc))
        if window['empty']:
            raise IntegrationError('The meeting research window has not started yet.')
        purpose = meeting['custom_purpose'] if meeting['purpose'] == 'Custom' else meeting['purpose']
        cap = min(6, max(1, int(os.getenv('MAX_QUERIES_PER_RUN', '6'))))
        queries = plan_queries(meeting, purpose, cap)
        stage(0, 'completed'); current = 1; stage(1, 'running')
        sources = []; seen = set(); errors = []
        for query in queries:
            try:
                result = tavily(query[:1500], window, lambda: counter('tavily_queries'))
                store.research_runs.update_one({'run_id': run_id}, {'$inc': {'counters.sources_retrieved': len(result.get('results', []))}})
                for s in result.get('results', []):
                    try:
                        url = canonical_url(s['url'])
                    except (ValueError, KeyError):
                        continue
                    if url in seen or s.get('score', 0) < 0.3:
                        continue
                    content = clean_source_content(s.get('content', ''))
                    entity_words = [w.lower() for w in meeting['name'].split() if len(w) > 2]
                    if entity_words and not all(w in (s.get('title', '') + ' ' + content).lower() for w in entity_words):
                        continue
                    tag = source_tag(s.get('published_date'), window)
                    if tag == 'future':
                        continue
                    seen.add(url)
                    from urllib.parse import urlparse
                    sources.append({'id': len(sources) + 1, 'title': s.get('title', ''), 'url': url, 'publisher': urlparse(url).hostname, 'published_date': s.get('published_date'), 'content': content, 'tag': tag, 'score': s.get('score'), 'retrieved_at': datetime.now(timezone.utc).isoformat()})
            except IntegrationError as e:
                errors.append(str(e))
        if errors and not sources:
            raise IntegrationError(errors[0])
        update({'counters.sources_deduped': len(sources), 'query_errors': errors})
        stage(1, 'completed'); current = 2; stage(2, 'running')
        source_cap = int(os.getenv('MAX_SOURCES_USED') or os.getenv('MAX_SOURCES_TO_LLM', '20'))
        trimmed = sources[:min(30, max(1, source_cap))]
        if not trimmed:
            raise IntegrationError('No relevant sources found. No evidence-backed briefing can be generated. Try additional company or professional context.')
        entity_words = [w.lower() for w in meeting['name'].split() if len(w) > 2]
        def to_development(source):
            claim = extract_claim(source, entity_words)
            if not claim:
                return None
            date = source['published_date'][:10] if source['published_date'] else None
            return Development(claim=claim, status='Partially Supported', date=date, source_ids=[source['id']], excerpt=claim)
        ranked = sorted(trimmed, key=lambda s: s.get('score') or 0, reverse=True)
        developments = [d for d in (to_development(s) for s in ranked if s['tag'] == 'in_window') if d][:6]
        background = [d for d in (to_development(s) for s in ranked if s['tag'] == 'background') if d][:4]
        stage(2, 'completed'); current = 3; stage(3, 'running')
        developments = [d for d in developments if verify_development(d, trimmed, window)]
        background = [d for d in background if verify_development(d, trimmed, window, False)]
        store.research_results.insert_one({'research_id': str(uuid.uuid4()), 'run_id': run_id, 'meeting_id': meeting['meeting_id'], 'queries': queries, 'sources': sources, 'claims': [d.model_dump() for d in developments + background], 'retrieved_at': datetime.now(timezone.utc).isoformat()})
        stage(3, 'completed'); current = 4; stage(4, 'running')
        questions = suggest_questions(purpose, meeting['name'])
        stage(4, 'completed'); current = 5; stage(5, 'running')
        briefing_id = str(uuid.uuid4())
        # Summary is built only from provenance-checked verbatim claims.
        summary = ' '.join(d.claim for d in developments[:3]) or 'No significant developments found in the research window.'
        briefing = {'briefing_id': briefing_id, 'meeting_id': meeting['meeting_id'], 'run_id': run_id, 'name': meeting['name'], 'meeting_datetime': meeting['meeting_datetime'], 'purpose': purpose, 'executive_summary': summary, 'background': [f"{d.claim} [{', '.join(map(str, d.source_ids))}]" for d in background], 'recent_developments': [d.model_dump() for d in developments], 'opportunities': [], 'risks': [], 'questions': [q.model_dump() for q in questions], 'sources': trimmed, 'research_metadata': {'window': window, 'queries': queries, 'source_count': len(trimmed), 'limitations': ['Briefings are extractive: every development is a verbatim sentence from a cited source, never an AI interpretation.', 'Sources with unknown publication dates are excluded from recent developments.', 'Opportunity and risk suggestions require an analysis model and are not generated.']}, 'generated_at': datetime.now(timezone.utc).isoformat()}
        store.briefings.insert_one(briefing)
        store.meetings.update_one({'meeting_id': meeting['meeting_id']}, {'$set': {'briefing_id': briefing_id}})
        stage(5, 'completed')
        update({'status': 'completed', 'briefing_id': briefing_id, 'completed_at': datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        stage(current, 'failed')
        message = str(e) if isinstance(e, IntegrationError) else 'Research failed because the external service or storage is unavailable.'
        update({'status': 'failed', 'error': message, 'completed_at': datetime.now(timezone.utc).isoformat()})
