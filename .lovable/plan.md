# MeetBrief AI architecture

Keep Flask and MongoDB on external hosting as requested. This project hosts the React meeting workspace with its supported TanStack routing. Private research credentials stay on the external service.

## Phases
1. Dashboard, meeting form, settings and accurate empty/connection states; external Flask service with validated inputs and real health checks.
2. Documented Tavily and mandatory Bifrost adapters; live checks when credentials are available.
3. Meeting-relative date windows, source deduplication, evidence verification and persisted research stages.
4. Progress and sourced briefing views, history and one-page PDF.
5. Automated tests and live end-to-end scenarios after external deployment.

## Technical details
React/TypeScript, TanStack routing and Tailwind here; Flask/Pydantic, PyMongo, requests and ReportLab externally. The browser calls a public Flask URL, never research providers directly. No fabricated findings or progress. Future research windows cap at the user's current date; unsupported claims never become verified findings.

## Blocker
The configuration upload contains no recognized assignments. External hosting URL and backend credentials are required for live integration tests.