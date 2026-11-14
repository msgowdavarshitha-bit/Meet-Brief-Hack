"""External Flask service. Deploy independently, never inside the Lovable runtime."""
import os
import uuid
from datetime import datetime, timezone
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pydantic import ValidationError
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from models import MeetingInput, ResearchInput, research_window

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 20000
origins = [s.strip() for s in os.getenv('CORS_ORIGINS', '').split(',') if s.strip()]
CORS(app, origins=origins)
limiter = Limiter(key_func=get_remote_address, app=app, default_limits=['60 per minute'], storage_uri='memory://')
executor = ThreadPoolExecutor(max_workers=2)
client = None


def db():
    global client
    uri = os.getenv('MONGODB_URI')
    if not uri:
        raise RuntimeError('MongoDB is not configured on the research service.')
    if client is None:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    return client[os.getenv('MONGODB_DB', 'meetbrief')]


def ok(data, status=200):
    return jsonify(success=True, data=data, error=None), status


def fail(code, message, status):
    return jsonify(success=False, data=None, error={'code': code, 'message': message}), status


@app.before_request
def request_id():
    request.request_id = str(uuid.uuid4())


@app.after_request
def response_headers(response):
    response.headers['X-Request-ID'] = request.request_id
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.errorhandler(ValidationError)
def invalid(error):
    # Do not echo request inputs or validation contexts.
    return fail('VALIDATION_ERROR', 'Meeting details are invalid. Check the name, date, timezone, purpose and context length.', 422)


@app.errorhandler(PyMongoError)
def database_error(error):
    return fail('DATABASE_UNAVAILABLE', 'Meeting storage could not be reached.', 503)


@app.errorhandler(429)
def limited(error):
    return fail('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429)


@app.errorhandler(413)
def too_large(error):
    return fail('INPUT_TOO_LARGE', 'Request is too large.', 413)


@app.errorhandler(Exception)
def unexpected(error):
    from werkzeug.exceptions import HTTPException
    if isinstance(error, HTTPException):
        return fail('HTTP_ERROR', error.description, error.code)
    return fail('SERVICE_ERROR', 'The research service is unavailable or not configured.', 503)


@app.get('/api/health')
def health():
    from services import check_integrations
    statuses = check_integrations()
    try:
        db().command('ping')
        statuses['mongodb'] = {'status': 'connected'}
    except (RuntimeError, PyMongoError):
        statuses['mongodb'] = {'status': 'unavailable' if os.getenv('MONGODB_URI') else 'not configured'}
    return ok(statuses)


@app.route('/api/meetings', methods=['GET', 'POST'])
def meetings():
    store = db()
    if request.method == 'GET':
        return ok(list(store.meetings.find({}, {'_id': 0}).sort('created_at', -1).limit(100)))
    model = MeetingInput.model_validate(request.get_json())
    window = research_window(model.meeting_datetime, model.timezone, datetime.now(timezone.utc))
    if window['empty']:
        return fail('FUTURE_WINDOW', 'This meeting research window has not started yet.', 422)
    meeting = model.model_dump(mode='json')
    meeting.update(meeting_id=str(uuid.uuid4()), research_window=window, created_at=datetime.now(timezone.utc).isoformat())
    store.meetings.create_index('meeting_id', unique=True)
    store.meetings.create_index('created_at')
    store.meetings.insert_one(meeting.copy())
    return ok(meeting, 201)


@app.get('/api/meetings/<meeting_id>')
def get_meeting(meeting_id):
    data = db().meetings.find_one({'meeting_id': meeting_id}, {'_id': 0})
    return ok(data) if data else fail('NOT_FOUND', 'Meeting not found.', 404)


@app.post('/api/research')
@limiter.limit('5 per minute')
def research():
    from pipeline import run_research, STAGES
    model = ResearchInput.model_validate(request.get_json())
    store = db()
    meeting = store.meetings.find_one({'meeting_id': model.meeting_id}, {'_id': 0})
    if not meeting:
        return fail('NOT_FOUND', 'Meeting not found.', 404)
    active = store.research_runs.find_one({'meeting_id': model.meeting_id, 'status': {'$in': ['pending', 'running']}})
    if active:
        return ok({'run_id': active['run_id']}, 202)
    run_id = str(uuid.uuid4())
    store.research_runs.create_index('run_id', unique=True)
    store.research_runs.create_index('meeting_id')
    store.briefings.create_index('briefing_id', unique=True)
    store.research_results.create_index('run_id', unique=True)
    run = {'run_id': run_id, 'meeting_id': model.meeting_id, 'status': 'pending', 'stages': [{'name': name, 'status': 'pending'} for name in STAGES], 'counters': {'tavily_queries': 0, 'sources_retrieved': 0, 'sources_deduped': 0}, 'started_at': datetime.now(timezone.utc).isoformat()}
    store.research_runs.insert_one(run)
    executor.submit(run_research, store, meeting, run_id)
    return ok({'run_id': run_id}, 202)


@app.get('/api/research/status/<run_id>')
def status(run_id):
    data = db().research_runs.find_one({'run_id': run_id}, {'_id': 0})
    return ok(data) if data else fail('NOT_FOUND', 'Research run not found.', 404)


@app.get('/api/research/results/<run_id>')
def research_results(run_id):
    data = db().research_results.find_one({'run_id': run_id}, {'_id': 0})
    return ok(data) if data else fail('NOT_FOUND', 'Research results are not available.', 404)


@app.get('/api/briefings/<briefing_id>')
def briefing(briefing_id):
    data = db().briefings.find_one({'briefing_id': briefing_id}, {'_id': 0})
    return ok(data) if data else fail('NOT_FOUND', 'Briefing not found.', 404)


@app.get('/api/briefings/<briefing_id>/pdf')
def pdf(briefing_id):
    from pdf_service import create_pdf
    data = db().briefings.find_one({'briefing_id': briefing_id}, {'_id': 0})
    if not data:
        return fail('NOT_FOUND', 'Briefing not found.', 404)
    return send_file(BytesIO(create_pdf(data)), mimetype='application/pdf', as_attachment=True, download_name='meetbrief.pdf')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=False)