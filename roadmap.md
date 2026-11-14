# MeetBrief AI

- [x] Reject localhost/workspace research addresses and save settings only after a valid health response.
- [ ] Connect the user's deployed Flask address — not supplied; localhost was configured instead.

- [x] Meeting workspace, meeting form, settings and external Flask structure.
- [x] Tavily adapter with bounded retries; deterministic planning and extractive, tested analysis rules (no AI model dependency).
- [x] Initial meeting-relative pipeline, provenance checks and source-backed briefing assembly.
- [x] Progress, results, history, MongoDB persistence adapters and one-page PDF implementation.
- [x] Automated rules tests and desktop/mobile workspace checks (18 tests passed).
- [ ] Live health, provider calls, persisted research flow and real PDF verification — blocked by external deployment URL and backend credentials.

## Acceptance status
Initial implementation only, not production/acceptance complete. Advanced independent verification, credibility tiers, identity disambiguation, durable jobs, authentication and metrics are documented as unimplemented in README; they are not represented as working features.