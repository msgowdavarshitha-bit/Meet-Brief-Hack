<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Application architecture
- Host the React workspace with TanStack routing and the Python research service externally; this runtime cannot host Flask.
- Keep research keys and MongoDB access in the external service; the browser receives only its public API base URL.
- Keep date-window and evidence rules in pure tested modules so views cannot reinterpret research results.
- Research uses Tavily only; analysis is extractive (verbatim source sentences) with no LLM gateway, so briefings never contain ungrounded generated text.
- Treat the external Flask service as single-workspace and single-worker until authentication and durable jobs exist; browser CORS is not authorization.
- Validate external service addresses centrally before every request and save candidate settings only after a valid health response; localhost and workspace URLs are not hosted Flask services.
- Keep screenshot generation in a separate AI Gateway server function with a workspace-allowed Responses model; it must never feed generated content into research briefings.
- Render generated HTML only in an opaque sandboxed iframe with restrictive CSP; generated content must not execute scripts or access the workspace or network.
