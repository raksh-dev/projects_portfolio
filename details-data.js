export const steps = {
  bank: [
    {
      emoji:'📄', title:'Document Received',
      tech:'A loan application triggers ingestion of bank statements in any format — PDF (text or scanned), CSV exports, or images. The system auto-detects document type using mime-type headers and content heuristics.',
      nontech:'A customer uploads their bank statements when applying for a loan. The system accepts any format — it can read PDF files, spreadsheets, or even photos of paper statements.'
    },
    {
      emoji:'🔍', title:'Multi-format Parsing',
      tech:'pdfplumber extracts text-based PDFs with table detection. Tesseract OCR + preprocessing handles scanned documents. Custom regex patterns + learned templates extract transaction rows, dates, amounts, and descriptions across 50+ bank formats.',
      nontech:'Like a very fast reader, the system reads through every page, finding all the transactions — dates, amounts, and descriptions — no matter how the bank formatted the document.'
    },
    {
      emoji:'🧠', title:'AI Transaction Classification',
      tech:'Each transaction is sent to GPT-4 with a structured prompt requesting JSON output: category (income, housing, food, etc.), subcategory, risk signals (overdraft, irregular pattern), and confidence score. Batch calls optimize cost and latency.',
      nontech:'The AI reads each transaction and understands what it is — salary income, rent payment, grocery shopping — and flags anything unusual, like overdrafts or irregular deposits.'
    },
    {
      emoji:'🔎', title:'Semantic Indexing',
      tech:'Structured transaction records are embedded using OpenAI text-embedding-3-small and stored in a vector index (Pinecone or pgvector). This enables semantic retrieval: "high-value irregular deposits" retrieves relevant transactions even with no keyword match.',
      nontech:'The system creates an intelligent index of all the financial data, so it can answer questions about it instantly — even if the question is phrased differently from how the data is stored.'
    },
    {
      emoji:'🎙️', title:'Voice & Text Q&A',
      tech:'Voice queries processed via Whisper API → text → embedded → top-k retrieved from vector store → GPT-4 generates grounded answer with citations. Text queries skip transcription. Full RAG (Retrieval-Augmented Generation) pipeline ensures answers are factually grounded in the actual data.',
      nontech:'Loan officers can ask questions out loud or type them — "Is the income consistent?" or "Any large unusual payments?" — and get instant, accurate answers based on the real bank data.'
    },
    {
      emoji:'✅', title:'Underwriting Decision Output',
      tech:'Structured JSON report generated: income summary, expense breakdown, risk signals, debt-to-income ratio, cashflow consistency score. Output standardized to integrate directly with underwriting platforms via REST API. Decision latency: under 90 seconds for a complete 3-month statement analysis.',
      nontech:'The system produces a clean, standardized summary for the loan officer — income, spending patterns, risk factors — everything they need to make a decision, in under 2 minutes instead of days.'
    }
  ],
  pulse: [
    {
      emoji:'📡', title:'Multi-source Ingestion',
      tech:'producer.py generates realistic mock reviews (Faker-based, sentiment-aligned phrase banks, skewed 4–5 star distribution). Reddit/PRAW and Twitter/Tweepy connectors normalize social data into the same record schema. Publisher abstracts destination: local JSONL file in LOCAL_MODE, else boto3 put_record to Kinesis partitioned by product_id.',
      nontech:'The system accepts reviews and comments from multiple sources at once — a mock data generator for testing, real Reddit comments, and live tweets — all converted into the same standard format before processing.'
    },
    {
      emoji:'⚡', title:'Real-time VADER Scoring',
      tech:'consumer.py polls Kinesis shards (or tails local JSONL) and applies VADER to each record in-process. Compound score thresholds: ≥0.05 = positive, ≤−0.05 = negative, else neutral. Zero API cost, zero network latency. Scores attached as sentiment_label and sentiment_score before any further processing.',
      nontech:'Every review gets a sentiment score instantly — positive, neutral, or negative — using a rule-based algorithm that runs right inside the app. No external AI call needed, so it\'s fast and free.'
    },
    {
      emoji:'🔍', title:'v2 Enrichment Pipeline',
      tech:'enrichment.py loaded lazily (v1 skips it entirely). Enricher: (1) normalize_text → text_hash for dedup — if hash seen, returns None and record is dropped; (2) langdetect with seeded random for determinism → language field; (3) KeyBERT top-N extraction → keywords ARRAY. Degrades gracefully if KeyBERT model unavailable.',
      nontech:'In version 2, each review is also checked for duplicates (so the same text doesn\'t count twice), tagged with its language, and analyzed for the most important keywords — giving much richer data for the dashboard without slowing down the pipeline.'
    },
    {
      emoji:'📦', title:'Micro-batch → Snowpipe Auto-ingest',
      tech:'MicroBatchSink buffers records and flushes to S3 (or local disk) when MICRO_BATCH_SECONDS elapses or MICRO_BATCH_MAX_RECORDS accumulates. Output: NDJSON on Hive-style date path (reviews/raw/YYYY/MM/DD/HH/batch-…json). S3 object-created event → SQS → Snowpipe COPY INTO REVIEWS_RAW. If Snowflake is unavailable, records queue in S3 and self-heal on resume — no custom retry logic.',
      nontech:'Instead of sending reviews to Snowflake one by one, the system bundles them into files every few seconds and drops them in S3. Snowflake automatically picks them up and loads them — and if Snowflake goes down briefly, nothing is lost; the files just wait in S3.'
    },
    {
      emoji:'📊', title:'Snowpark Aggregations',
      tech:'snowpark_jobs.py: hourly_rollup() groups REVIEWS_RAW by product and hour, computing volume + avg_score + pct_positive/neutral/negative → SENTIMENT_AGG (idempotent upsert). keyword_frequency() FLATTENs KEYWORDS arrays and counts by day + label → KEYWORD_FREQ. Runnable via cron or registered as Snowflake Task (DDL in schema_v2.sql).',
      nontech:'Snowflake automatically crunches the raw data every hour into clean summaries — total reviews, average sentiment, percentage positive/negative per product — and separately counts which keywords come up most often. These are what power the live charts on the dashboard.'
    },
    {
      emoji:'🤖', title:'Groq LLM Batch Summarization',
      tech:'llm_summarizer.py: _fetch_recent() pulls last LLM_LOOKBACK_MINUTES from REVIEWS_RAW; _group() buckets by (product_id, source); _call_groq() sends ≤LLM_BATCH_SIZE reviews per call with JSON response mode → {summary, positive_themes, negative_themes, recommended_action}; _write_insight() inserts one row to INSIGHTS_SUMMARY. Model: llama-3.1-8b-instant. Batching ~50–100 reviews/call cuts API invocations ~98% vs per-event. Runs on cadence via --loop flag.',
      nontech:'Every 10 minutes, the system bundles the latest reviews and sends them to Groq\'s AI (Llama 3.1) as one batch. The AI produces a short summary — what people are saying, what\'s going well, what\'s going badly, and what to do about it. Batching keeps costs at near-zero.'
    },
    {
      emoji:'🚨', title:'Anomaly Detection & Live Dashboard',
      tech:'anomaly_detection.py: per product, reads last ANOMALY_WINDOW_HOURS of SENTIMENT_AGG hourly buckets (min ANOMALY_MIN_VOLUME filter). Computes baseline mean + std of pct_negative over preceding buckets; flags if latest bucket > mean + k·std (default k=2). Requires ≥4 buckets before firing. Breach written to SENTIMENT_ALERTS with z-score. Streamlit dashboard queries all four tables via safe_query() (60s TTL cache) — renders positivity gauge, 24h trend, LLM insight cards, keyword cloud, and alert panel. Missing tables show setup hints instead of errors.',
      nontech:'The system watches each product\'s normal rate of negative reviews. If a recent hour is way above its own baseline — statistically unusual — it raises an alert. The Streamlit dashboard shows everything live: a sentiment gauge, trend charts, the AI\'s insight cards, and any active alerts — updating every minute.'
    }
  ],
  resolvemesh: [
    {
      emoji:'📬', title:'Support Ticket Received',
      tech:'A support ticket (JSON payload) arrives via webhook or queue message. The system validates the payload schema, publishes it to GCP Pub/Sub via a Cloud Run forwarder that bridges Azure Event Grid — simpler than VPN peering for cross-cloud events and near-zero cost at low volume. Vertex AI Pipelines picks up the event and initiates the DAG run.',
      nontech:'A support ticket comes in from wherever it was submitted — email, chat, or a support tool — and the system immediately starts working on it, routing it through the pipeline automatically.'
    },
    {
      emoji:'🔍', title:'Azure NLP Enrichment',
      tech:'Azure Cognitive Services Language API extracts entities (product names, error codes, user IDs), classifies intent category (billing, technical, account), produces sentiment score, and assigns priority P1–P4 based on urgency keywords and sentiment thresholds. Output is a structured JSON payload forwarded to the next pipeline step. Enrichment adds context the LLM uses for grounding.',
      nontech:'Azure reads the ticket and understands it deeply — which product is involved, whether the customer is angry or calm, what they actually want, and how urgently they need help. All this understanding gets packaged up and passed to the next step.'
    },
    {
      emoji:'📚', title:'Azure Cognitive Search — KB Retrieval',
      tech:'Azure Cognitive Search index is pre-populated from the knowledge base (PDFs, Confluence pages, Markdown docs) with vector embeddings. The NLP payload (entities + intent) constructs a semantic search query. Top-3 KB articles ranked by similarity score are retrieved and included in the prompt context for the LLM. This grounds the reply in actual KB content rather than model hallucinations.',
      nontech:'Azure searches through the entire knowledge base using AI-powered similarity — not just keyword matching — to find the 3 most relevant help articles. These articles are then handed to the LLM so it writes a reply that\'s actually accurate, not made up.'
    },
    {
      emoji:'🤖', title:'AWS Bedrock LLM Draft',
      tech:'AWS Lambda receives the structured NLP payload + retrieved KB article snippets. A chain-of-thought prompt instructs Bedrock (Claude or Titan) to: read the enriched ticket context, ground the reply in the provided KB articles, stay under 300 words, and cite which specific KB articles were used. DynamoDB persists every inference request + response for audit. S3 archives raw payloads.',
      nontech:'AWS generates the actual reply draft — grounded in the knowledge base articles that were retrieved, under 300 words, with references to the articles used. Every draft is saved for auditing so support managers can review what the AI has been writing.'
    },
    {
      emoji:'👤', title:'Human Review Gate',
      tech:'Configurable flag (enabled/disabled per ticket type or SLA tier). When enabled, a Cloud Run webhook serves the draft to a reviewer UI. Reviewer can approve, edit, or reject. Approved → delivery step. Rejected → re-runs LLM with reviewer feedback. Gate adds latency but is excluded from the p95 SLA measurement per NFR-1. Dead-letter queue catches unreviewed drafts after timeout.',
      nontech:'For important tickets, a human can review the AI\'s draft before it\'s sent — approve it as-is, make edits, or reject it and ask the AI to try again with feedback. This step is optional and can be turned on or off per ticket type.'
    },
    {
      emoji:'📤', title:'Reply Delivery + Audit',
      tech:'Approved draft posted back to origin system via Zendesk REST API or Jira Service Management API. A structured audit event is emitted: {ticket_id, latency_ms, model_version, kb_articles_used, reviewer_id, status}. OpenTelemetry spans from all three clouds are correlated in GCP Cloud Trace so a single trace shows Azure NLP latency, KB retrieval time, AWS Bedrock inference time, and delivery time together.',
      nontech:'The approved reply is automatically posted back to wherever the ticket came from. A full audit record is created for every ticket — who approved it, how long each step took, which articles were cited. Cross-cloud monitoring shows the entire journey in one dashboard.'
    },
    {
      emoji:'🔭', title:'Observability + Cost Guardrails',
      tech:'OpenTelemetry collectors deployed on each cloud ship correlated trace spans to GCP Cloud Trace. Cloud Monitoring creates latency distribution dashboards. Budget alerts configured at $50/day per cloud account (GCP + Azure + AWS) via each cloud\'s native billing API, wired to PagerDuty. Terraform destroy + re-apply drill validated: full teardown and reprovision in &lt;20 minutes.',
      nontech:'The system monitors itself across all three clouds from one dashboard — showing total latency, cost per ticket, and firing alerts if daily spend exceeds the budget on any cloud. The entire infrastructure can be torn down and rebuilt from scratch in under 20 minutes.'
    }
  ],
  opsforge: [
    {
      emoji:'🔐', title:'Authentication &amp; Role Management',
      tech:'JWT access tokens (HS256, 30-min expiry) + refresh tokens (7-day). Rotation on every use — a new refresh token issued on each /refresh call, old one revoked. Reuse detection: if a revoked token is presented, the entire family is revoked, forcing re-login. RBAC: admin/manager/employee. /register hardcodes role = employee (prevents privilege escalation). Rate limiting: 5/min register, 10/min login via slowapi.',
      nontech:'Login is secure against token theft — if a stolen refresh token is used, the system detects it and logs out all devices immediately. Role controls ensure employees can\'t accidentally access manager features. Login attempts are rate-limited to block brute-force attacks.'
    },
    {
      emoji:'🤖', title:'AI Agent Processing',
      tech:'Three LangChain agents (abstract base + specialized subclasses) each with domain-specific tools and system prompts. /execute returns complete response; /execute/stream returns SSE token-by-token. Frontend reads SSE via fetch + ReadableStream (not EventSource, which can\'t do POST with auth headers). Every agent action written to agent_actions audit log with before/after state. Managers can override AI actions via /actions/{id}/override.',
      nontech:'Three AI assistants — one for attendance, one for tasks, one for reports — each trained on their specific domain. They stream responses word-by-word in real time, and every AI action is logged so managers can review or reverse what the AI did.'
    },
    {
      emoji:'📖', title:'RAG Knowledge Retrieval',
      tech:'Company documents ingested into document_chunks table. fastembed (BAAI/bge-small-en-v1.5, 384-dim) runs locally via ONNX — no embedding API key or cost. pgvector HNSW index enables cosine similarity search. Agents prepend retrieved policy context to their system prompt before answering. Graceful degradation: RAG disabled on SQLite (detected automatically), app continues without it.',
      nontech:'The AI can answer questions about company policies and procedures by searching through actual uploaded documents — not making things up. It all runs locally for free using a small AI model that runs without any API calls. Even without a database, the app works — just without document search.'
    },
    {
      emoji:'⚡', title:'Real-time WebSocket Delivery',
      tech:'ConnectionManager maps ws connections to user_id for targeted per-user delivery. broadcast_event() sends to all connections (task/shift/attendance events). send_user_event() sends to a specific user (notification created). useRealtime hook auto-reconnects with 3s backoff and invalidates React Query caches on incoming events. Layout header shows a green "Live" dot when WebSocket is connected.',
      nontech:'Task updates, shift changes, and notifications appear on screen instantly without the user refreshing. If the connection drops, it automatically reconnects in 3 seconds. A green dot in the corner shows whether the live connection is active.'
    },
    {
      emoji:'📊', title:'Dashboard, Kanban &amp; Reports',
      tech:'Dashboard: React Query KPI cards + Recharts charts (attendance rate, task velocity, leave balance). Kanban: @dnd-kit drag-and-drop with 4 columns (todo, in_progress, review, completed), broadcasts WebSocket events on drop. Reports: managers trigger AI generation via /reports/generate (Groq synthesizes from live DB data). Weekly briefing endpoint aggregates data → formats HTML email → sends via Resend/SMTP/SendGrid (all optional, no-ops if unset).',
      nontech:'The dashboard shows key team metrics in real time. Tasks can be dragged between status columns on a Kanban board, with updates appearing on teammates\' screens instantly. Managers can generate AI-written reports from live data, or send automated weekly email briefings to the team.'
    },
    {
      emoji:'🐳', title:'Deployment, PWA &amp; Logging',
      tech:'Docker Compose: pgvector/pg15 + FastAPI app + nginx reverse proxy. Dockerfile.backend (Python 3.11-slim), Dockerfile.frontend (Vite build). Alembic migrations with alembic stamp head for dev. structlog provides JSON logging in production (coloured in dev). PWA: service worker caches app-shell, never caches /api or /ws, branded teal-hexagon icons. SENTRY_DSN, SLACK_WEBHOOK_URL, email providers all optional (no-ops if unset).',
      nontech:'The whole platform runs with one command: docker compose up. It installs as a mobile app from the browser with offline support. All monitoring, Slack notifications, and email are optional extras — the core app runs completely without them.'
    }
  ],
  visionlog: [
    {
      emoji:'📤', title:'Image Upload &amp; Validation',
      tech:'React drag-and-drop or file picker → POST /v1/images/upload with X-API-Key header. API Gateway validates the key and proxies to Cloud Run Upload Service. Upload Service validates: file present, MIME type (jpeg/png/webp), magic bytes match declared MIME (blocks renamed PDFs), file size &lt;10MB, Pillow openability (catches corrupt images), minimum 32x32px dimensions. All validation before any GCS write.',
      nontech:'When a user uploads an image, the system checks it\'s actually a valid image file — not a renamed document or corrupted file — before doing anything with it. The checks run in order: wrong type rejected, too large rejected, corrupt file rejected. Only valid images proceed.'
    },
    {
      emoji:'🗄️', title:'Async Job Registration',
      tech:'requestId generated (UUID v4). Image stored to GCS at uploads/{requestId}/original.{ext}. PENDING document written to Firestore with metadata: fileName, gcsPath, uploadedAt, fileSizeBytes, mimeType, clientIp, predictions:[], status:"PENDING". 202 Accepted returned immediately with {requestId, statusUrl}. Total time from upload receipt to 202 response: &lt;500ms regardless of image size.',
      nontech:'The system immediately returns a tracking ID to the user — usually in under half a second. The image is saved and a record created saying "we\'re working on it." The user doesn\'t wait for the AI; they get a tracking number and the AI works in the background.'
    },
    {
      emoji:'⚡', title:'Eventarc Trigger',
      tech:'GCS object-created event fires automatically when the upload lands in the bucket. Eventarc delivers a CloudEvent to the Inference Worker (Cloud Run Function, 2nd gen). Event payload includes bucket name and object path. Worker extracts requestId by parsing path: name.split("/")[1]. Updates Firestore to PROCESSING before starting inference. Event filter restricts to uploads/** prefix to ignore unrelated objects.',
      nontech:'Google Cloud\'s event system detects the new image file the moment it arrives in storage and automatically wakes up the classification worker. No polling, no manual trigger — the pipeline starts itself. The worker immediately marks the job as "in progress" so users can see it\'s being processed.'
    },
    {
      emoji:'🧠', title:'Vertex AI Inference',
      tech:'Worker downloads image bytes from GCS → PIL.Image decode → RGB convert (handles RGBA, grayscale edge cases) → resize 224x224 LANCZOS → numpy float32 → MobileNetV2 preprocess_input (scales to [-1,1]) → (1,224,224,3) batch → JSON serialize → endpoint.predict(). Vertex AI Prediction endpoint (n1-standard-2, min_replica_count:1) is persistent and warm — no cold start. Response: 1000-class softmax probabilities.',
      nontech:'The image gets resized and transformed into the exact format MobileNetV2 expects, then sent to a dedicated AI endpoint that stays warm and ready at all times. The AI returns probability scores for 1,000 different object categories — from "golden retriever" to "racing bicycle."'
    },
    {
      emoji:'✅', title:'Result Storage &amp; Logging',
      tech:'Top-3 indices extracted by sorting 1000 probabilities descending, decoded via imagenet_labels.json. Firestore updated PENDING → COMPLETED with: predictions [{rank, label, confidence}], modelVersion:"mobilenetv2-v1", processedAt, processingDurationMs. On failure → FAILED with errorMessage. Both services emit structured JSON logs to Cloud Logging with severity, requestId, service, version, durationMs, topPrediction fields. Log-based metrics: upload_count, inference_success_count, inference_failure_count, latency distribution.',
      nontech:'The top 3 predictions (with confidence percentages) are saved to the database. Firestore flips from "pending" to "complete." If something went wrong, it\'s marked as "failed" with an error message — so the status is always current and accurate. All events are logged for monitoring.'
    },
    {
      emoji:'📊', title:'Frontend Status Polling &amp; Dashboard',
      tech:'React: usePredictionStatus custom hook sets setInterval at 2000ms, calls GET /v1/images/{requestId}/status, stops on COMPLETED or FAILED, cleans up on unmount. PredictionResult shows: top-3 predictions as a horizontal bar chart of confidence scores, local image preview (no public bucket URL needed), processingDurationMs, modelVersion. Dashboard GET /v1/images?limit=20 shows paginated history table with status badges, inline expand for all 3 predictions.',
      nontech:'The page polls for results every 2 seconds, then shows the top 3 predictions with a confidence bar chart once done. The original image is shown for reference. The dashboard keeps a full history of every classification, with status badges showing whether each job is done or still running.'
    }
  ],
  guardrails: [
    {
      emoji:'📥', title:'Request Received',
      tech:'User message arrives at /chat/, /conversations/{id}/messages, or /rag/query. Router is thin — it contains no guardrail logic. Request is forwarded to the relevant service (ChatService, ToolCallingService, or RAGService). The service layer owns all guard invocations. GuardrailBlockedException is registered as an exception handler in main.py, producing a uniform JSON response: {success:false, blocked:true, guardrail, reason, message}.',
      nontech:'A user sends a message through any of the AI endpoints. The router immediately passes it to the service layer where the guard checkpoints are. If any guard fires, it returns a consistent error response — so attackers can\'t tell which specific guard caught them.'
    },
    {
      emoji:'🛡️', title:'Input Guard &amp; Conversation History Guard',
      tech:'InputGuard.check_messages() processes the full message list. The last user message is checked as INPUT_GUARD; any earlier user message matching injection patterns triggers CONVERSATION_HISTORY_GUARD. Pattern groups checked: INSTRUCTION_OVERRIDE ("ignore previous instructions"), ROLE_MANIPULATION ("you are now"), SYSTEM_PROMPT_LEAK ("reveal your system prompt"), SECRET_LEAK_INTENT ("show environment variables"), CONTEXT_POISONING ("for the rest of this conversation"). Matched → enforce() raises GuardrailBlockedException, LLM never called.',
      nontech:'Before the AI sees anything, the guard reads both the current message and the entire conversation history — looking for manipulation attempts hidden in earlier messages. If turn 1 tried to brainwash the AI, turn 5 gets blocked too. Zero API cost for blocked requests.'
    },
    {
      emoji:'📄', title:'Document / PDF Injection Guard',
      tech:'Runs in RAGService.query after RAG retrieves chunks and builds the context string — but before injecting that context into the LLM prompt. DocumentGuard uses DOCUMENT_GROUPS, a stricter subset of patterns that excludes soft phrases ("from now on") that appear legitimately in books, retaining only strong injection signals ("Ignore all previous instructions", "Reveal the system prompt", "You are now in developer mode"). Blocks DOCUMENT_GUARD, LLM never sees the poisoned PDF content.',
      nontech:'After searching the knowledge base for relevant book content, the system reads that content carefully before showing it to the AI. If someone uploaded a PDF containing hidden instructions, those instructions are detected and the whole request is blocked — the AI never sees the malicious content.'
    },
    {
      emoji:'🤖', title:'LLM Processing (clean path)',
      tech:'Only requests that passed all pre-LLM guards reach here. LangChain LLMProvider (build_llm_provider factory) selects the appropriate client: ChatOpenAI with custom base_url for openrouter/groq/openai/deepseek, native ChatOllama for local models, ChatGoogleGenerativeAI for Gemini, ChatAnthropic for Claude. Per-request overrides of provider/model/temperature accepted in request body — changing LLM requires no code change, only .env or request params.',
      nontech:'Clean requests reach the AI provider. Switching between free (Groq, Gemini, Ollama) and paid (OpenAI, Anthropic) LLMs requires no code change — just an environment variable update or a parameter in the request. The system supports 7+ providers interchangeably.'
    },
    {
      emoji:'🔧', title:'Tool Call Guard (defense-in-depth)',
      tech:'For conversations with enable_tools=true, ToolCallingService calls ToolGuard.check_tool_calls() before executing any tool the LLM requested. Tools split: read-only (search_books, check_availability, get_member_loans, get_book_pdf_url, calculate_late_fees) vs mutating (create_loan, extend_loan). Mutating calls blocked (TOOL_CALL_GUARD) when conversation context shows injection indicators. This is the backstop — InputGuard normally blocks injected requests before the model runs, so the ToolGuard is defense-in-depth.',
      nontech:'Even if a malicious message somehow made it past the input guard, this second checkpoint stops the AI from taking damaging actions — like creating loans for unauthorized users. Read-only searches are always allowed; database-changing actions are blocked whenever the conversation looks suspicious.'
    },
    {
      emoji:'🚫', title:'Output Guard &amp; Safe Response',
      tech:'OutputGuard.check_output() scans the LLM response before returning: SYSTEM_PROMPT_LEAK patterns ("Here is my system prompt", "My instructions are"), literal API key shapes (sk-..., sk-or-v1-..., eyJ... JWTs, postgresql:// DSNs, KEY= env assignments). SummaryQualityGuard blocks answers shorter than GUARDRAILS_MIN_SUMMARY_LENGTH (default 20 chars). On block → raw LLM output discarded, safe fallback JSON returned. GUARDRAILS_DEBUG=true adds {stage, matched_category} — never full prompts or secrets.',
      nontech:'The last checkpoint reads the AI\'s response before it reaches the user — blocking any response that accidentally contains API keys, database passwords, system instructions, or is too short to be a real answer. If something is blocked here, the user gets a safe error response, never the raw output.'
    }
  ],
  inventory: [
    {
      emoji:'📦', title:'Supplier Data Ingestion',
      tech:'Pipeline ingests CSV, Excel (xlsx/xls), XML, and JSON supplier feeds via SFTP, REST API, or manual upload. Apache Spark handles large files (100k+ rows). Schema inference maps supplier columns to normalized field types (name, unit, price, HS code, etc.) using ML column classifier.',
      nontech:'The system accepts product lists from suppliers in any format they send — spreadsheets, files, or data feeds — and starts processing them automatically, no matter how messy.'
    },
    {
      emoji:'🧹', title:'Cleansing & Normalization',
      tech:'Multi-stage cleansing: unicode normalization, unit standardization (ml/L/oz), price currency normalization, duplicate row detection via hash comparison, brand name entity resolution, measurement normalization (1 kg = 1000g). ~40 custom cleaning rules handle domain-specific patterns.',
      nontech:'The system cleans up all the inconsistencies — standardizing units, fixing typos, removing duplicates, and making sure all products are described the same way regardless of which supplier they came from.'
    },
    {
      emoji:'🔗', title:'ML-Powered Clustering',
      tech:'sentence-transformers (all-MiniLM-L6-v2) generates 384-dim embeddings per product. DBSCAN clustering groups items with cosine similarity > 0.78. HNSW index (FAISS) for efficient nearest-neighbor search at scale. Cluster candidates then passed to fine-grained matching stage.',
      nontech:'The AI groups together products that are probably the same item — even if they\'re described completely differently by different suppliers — by understanding the meaning of the descriptions, not just the words.'
    },
    {
      emoji:'🏷️', title:'Classification & Mapping',
      tech:'Multi-signal classifier assigns SKU from master catalog, GTIN from GS1 database (with fuzzy match fallback), and HSN code from 8-digit tariff schedule. Rule-based guardrails validate format patterns (GTIN check digit, HSN numeric structure). Ensemble: ML model + rules prevents hallucinations.',
      nontech:'The system assigns each product its official product codes — the unique numbers that identify exactly what the product is for inventory, customs, and tax purposes — automatically looking them up and matching them.'
    },
    {
      emoji:'📊', title:'Confidence Scoring & Routing',
      tech:'Composite confidence score: semantic similarity (40%), attribute match rate (30%), historical mapping agreement (20%), rule validation (10%). Per-category calibrated thresholds. Items scoring ≥85% auto-approved. Items 60–84% go to assisted review. Items <60% flagged for expert review with full evidence bundle.',
      nontech:'The system gives each match a confidence score — how sure it is. High confidence (85%+) items are approved instantly. Lower confidence items go to a person to check, with the AI\'s best guesses already shown to speed up review.'
    },
    {
      emoji:'👤', title:'Human-in-the-Loop Review',
      tech:'React UI shows reviewer: AI-suggested match + confidence, top-3 alternatives with attribute diffs, similar confirmed mappings as precedent, and full raw data. Keyboard shortcuts for fast bulk review. Decisions stored and fed back into model training pipeline. Reviewers average 120 items/hour vs 25 manually.',
      nontech:'For items the AI isn\'t sure about, a person reviews them in an easy-to-use screen that shows the AI\'s suggestions and why it thinks they match. Most reviews take just a few seconds to confirm or correct.'
    },
    {
      emoji:'📚', title:'Master Catalog & Audit Trail',
      tech:'Approved mappings written to master catalog with provenance: source supplier, match method (auto/human), reviewer ID, timestamp, confidence score, version. Full lineage for any catalog record. Downstream teams query via REST API. Catalog versioned with Git-style branching for rollback.',
      nontech:'Every approved product goes into the master catalog with a complete record of how it was matched and who approved it — a full audit trail so the company can always see why any decision was made.'
    }
  ]
};
