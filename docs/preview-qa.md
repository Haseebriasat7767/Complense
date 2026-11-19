# Preview QA environment

The `fix/multi-format-evidence-extraction` Vercel Preview deployment is intentionally isolated from Production.

- `NODE_ENV=development` keeps the preview on the in-memory QA store.
- `DEMO_MODE=true` enables the seeded demo workspace for extraction and report-flow checks.
- `AUTH_REQUIRED=false` is limited to this branch's Preview environment.
- Production Supabase credentials, session secrets, and billing credentials are not copied into this preview.

Do not promote this preview to Production. Production release requires successful upload tests for PDF, DOCX, TXT, and CSV; OCR decision and tests; original-file storage/retention; report/mapping verification; billing/trial configuration; and security review.
