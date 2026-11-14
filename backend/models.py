from datetime import datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, Field, field_validator, model_validator


class MeetingInput(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    type: Literal['Company', 'Individual']
    purpose: Literal['Business Development', 'Sales Discussion', 'Partnership', 'Job Interview', 'Investor Meeting', 'Client Meeting', 'Consulting', 'General Business Meeting', 'Custom']
    custom_purpose: str = Field(default='', max_length=300)
    context: str = Field(default='', max_length=3000)
    meeting_datetime: datetime
    timezone: str

    @field_validator('name')
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if len(value) < 2 or any(ord(c) < 32 for c in value):
            raise ValueError('Enter a valid professional or company name.')
        return value

    @model_validator(mode='after')
    def validate_meeting(self):
        if self.meeting_datetime.tzinfo is None:
            raise ValueError('Meeting time must include a timezone offset.')
        try:
            zone = ZoneInfo(self.timezone)
        except ZoneInfoNotFoundError:
            raise ValueError('Unknown timezone.')
        if self.meeting_datetime.utcoffset() != self.meeting_datetime.astimezone(zone).utcoffset():
            raise ValueError('Meeting offset does not match the named timezone.')
        if self.purpose == 'Custom' and not self.custom_purpose.strip():
            raise ValueError('Custom meetings require a purpose.')
        return self


class ResearchInput(BaseModel):
    meeting_id: str = Field(pattern=r'^[a-f0-9-]{36}$')


def research_window(meeting_datetime, timezone, now):
    zone = ZoneInfo(timezone)
    meeting = meeting_datetime.astimezone(zone).date()
    today = now.astimezone(zone).date()
    start = meeting - timedelta(days=30)
    return {'start': start.isoformat(), 'end': min(meeting, today).isoformat(), 'future': meeting > today, 'past': meeting < today, 'empty': start > today}


class Development(BaseModel):
    claim: str = Field(min_length=1, max_length=500)
    status: Literal['Supported', 'Partially Supported', 'Conflicting Evidence', 'Insufficient Evidence']
    date: str | None = None
    source_ids: list[int] = Field(min_length=1, max_length=5)
    excerpt: str = Field(min_length=1, max_length=500)


class Question(BaseModel):
    question: str = Field(min_length=10, max_length=300)
    rationale: str = Field(min_length=1, max_length=300)


class Recommendation(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    source_ids: list[int] = Field(min_length=1, max_length=5)


class Analysis(BaseModel):
    executive_summary: str = Field(max_length=1300)
    background: list[Development] = Field(max_length=4)
    recent_developments: list[Development] = Field(max_length=6)
    opportunities: list[Recommendation] = Field(max_length=3)
    risks: list[Recommendation] = Field(max_length=3)
    questions: list[Question] = Field(min_length=5, max_length=10)


class Plan(BaseModel):
    queries: list[str] = Field(min_length=1, max_length=6)