import json
import os
import re
import time
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from datetime import datetime, timezone
import requests
from models import Analysis, Plan
from pydantic import ValidationError


class IntegrationError(Exception):
    pass


def canonical_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Unsafe source URL')
    host = parsed.netloc.lower()
    if host.startswith('www.'):
        host = host[4:]
    query = [(k, v) for k, v in parse_qsl(parsed.query) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunparse((parsed.scheme, host, parsed.path.rstrip('/'), '', urlencode(sorted(query)), ''))


def source_tag(publication_date, window):
    if not publication_date:
        return 'date_unknown'
    try:
        from email.utils import parsedate_to_datetime
        try:
            date = datetime.fromisoformat(publication_date.replace('Z', '+00:00')).date().isoformat()
        except ValueError:
            date = parsedate_to_datetime(publication_date).date().isoformat()
    except (ValueError, TypeError, OverflowError):
        return 'date_unknown'
    if date > window['end']:
        return 'future'
    return 'in_window' if date >= window['start'] else 'background'


def request_json(url, headers, body, service, on_attempt=None):
    for attempt in range(3):
        try:
            if on_attempt:
                on_attempt()
            response = requests.post(url, headers=headers, json=body, timeout=(10, 90))
            if response.status_code in (429, 502, 503, 504) and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            if not response.ok:
                # Provider bodies can echo private inputs/keys. Keep only the service/status.
                raise IntegrationError(f'{service} request failed (HTTP {response.status_code}). Check the external service configuration.')
            return response.json()
        except (requests.Timeout, requests.ConnectionError):
            if attempt == 2:
                raise IntegrationError(f'{service} could not be reached after bounded retries.')
            time.sleep(2 ** attempt)
        except requests.exceptions.JSONDecodeError:
            raise IntegrationError(f'{service} returned an invalid response.')


def tavily(query, window, on_attempt=None):
    key = os.getenv('TAVILY_API_KEY')
    if not key:
        raise IntegrationError('Tavily is not configured. Set TAVILY_API_KEY on the external service.')
    return request_json('https://api.tavily.com/search', {'Authorization': f'Bearer {key}'}, {'query': query, 'topic': 'news', 'search_depth': 'advanced', 'start_date': window['start'], 'end_date': window['end'], 'max_results': min(10, max(1, int(os.getenv('MAX_RESULTS_PER_QUERY', '5')))), 'include_answer': False, 'include_published_date': True}, 'Tavily', on_attempt)


def bifrost(messages, schema, on_attempt=None):
    base = os.getenv('BIFROST_BASE_URL', '').rstrip('/')
    model = os.getenv('BIFROST_MODEL')
    if not base or not model:
        raise IntegrationError('Bifrost is not configured. Set BIFROST_BASE_URL and BIFROST_MODEL on the external service.')
    headers = {'Content-Type': 'application/json'}
    if os.getenv('BIFROST_API_KEY'):
        headers['Authorization'] = f"Bearer {os.environ['BIFROST_API_KEY']}"
    endpoint = base + ('/chat/completions' if base.endswith('/v1') else '/v1/chat/completions')
    prompt = list(messages) + [{'role': 'system', 'content': 'Return only JSON matching this schema: ' + json.dumps(schema.model_json_schema())}]
    for repair in range(2):
        response = request_json(endpoint, headers, {'model': model, 'messages': prompt, 'temperature': 0.1, 'max_tokens': 4000, 'response_format': {'type': 'json_object'}}, 'Bifrost', on_attempt)
        try:
            return schema.model_validate_json(response['choices'][0]['message']['content'])
        except (ValidationError, KeyError, IndexError, TypeError):
            if repair:
                raise IntegrationError('Bifrost output did not pass the briefing schema after one repair attempt.')
            prompt.append({'role': 'user', 'content': 'The previous output did not match the schema. Generate a corrected JSON object using only the original evidence.'})


def check_integrations():
    statuses = {}
    # These are actual inference/search probes, not configuration-only success labels.
    if not os.getenv('TAVILY_API_KEY'):
        statuses['tavily'] = {'status': 'not configured'}
    else:
        try:
            today = datetime.now(timezone.utc).date().isoformat()
            tavily('Tavily documentation', {'start': today, 'end': today})
            statuses['tavily'] = {'status': 'connected'}
        except IntegrationError:
            statuses['tavily'] = {'status': 'connection failed'}
    if not os.getenv('BIFROST_BASE_URL') or not os.getenv('BIFROST_MODEL'):
        statuses['bifrost'] = {'status': 'not configured'}
    else:
        try:
            bifrost([{'role': 'user', 'content': 'Return a JSON queries array containing the string connectivity check.'}], Plan)
            statuses['bifrost'] = {'status': 'connected'}
        except IntegrationError:
            statuses['bifrost'] = {'status': 'connection failed'}
    return statuses