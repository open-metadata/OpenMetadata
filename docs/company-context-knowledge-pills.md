# Company Context — File-Extracted Knowledge Pills

- **Date:** 2026-06-12
- **Status:** Implemented (as-built spec for branch `pmbrull/companycontext-entity`)
- **Author:** pmbrull (with Claude)
- **Scope:** 72 files, ~+2818/−81. Backend (Java), schema (JSON), ingestion of
  file content into reusable memories, embedding/search, MCP tools, UI badge.

This document describes the feature **as shipped**, not the earlier
pre-implementation design. Where the implementation diverged from that design,
the as-built behavior is recorded here and flagged in
[§13 Known limitations](#13-known-limitations--follow-ups).

---

## 1. Summary

The Context Center ("Drive") lets users upload documents. Previously an upload
was stored, its raw text extracted into `ContextFile.extractedText`, and that was
the end. This feature turns that raw text into structured, retrievable
**knowledge pills** — short question/answer facts about the company — that are
embedded, indexed, linked back to the originating file, and reachable by any
MCP-connected agent.

Pills are **not a new entity**. They are `ContextMemory` rows tagged
`sourceType=FileExtraction` with a `sourceFile` back-reference, riding the
entity's existing embedding + search plumbing.

End-to-end:

```
upload ──▶ store blob (object storage / AssetService)
       ──▶ extract text                       (status: Analyzing)
       ──▶ LLM extracts knowledge pills        (status: ExtractingContext)
       ──▶ pills stored as ContextMemory rows, linked to the file
       ──▶ pills auto-embedded + indexed on create
       ──▶ pills retrievable via MCP + searchable by source filename
       file carries a processing status surfaced in the UI    (status: Processed)
```

## 2. Motivation

`ContextMemory` already existed — "Reusable context memory for Context Center
and AI-assisted retrieval", a question/answer pill that is already
vector-embedded (`contextMemory` is in `AvailableEntityTypes`, has
`ContextMemoryBodyTextContributor` + `ContextMemoryIndex`, and its index carries
parent aliases `["all", "dataAssetEmbeddings"]`). It needed only a new source
type and a file back-reference to become the backing store for file-extracted
knowledge, avoiding a second overlapping "knowledge" concept and a full new
entity stack.

The real new infrastructure is a **generic LLM completion layer** — there was no
chat/completion client before (only `EmbeddingClient` and a NoOp `NLQService`).
It is built decoupled from Context Center so other features (e.g. MCP Chat) can
reuse it.

## 3. Architecture & data flow

```
POST /v1/contextCenter/drive/files                         (ContextFileResource:208)
  └─ store asset (AssetServiceFactory.getService().upload), persist ContextFile + content
  └─ extractionService.submit(fileId, contentId)           (ContextFileResource:287)

ContextFileProcessingService.process(fileId, contentId)    (drive/ContextFileProcessingService.java)
  guard: contentId == file.headContentId   (else abandon — stale re-upload)
  1. markAnalyzing()                         → status Analyzing (file + content)
  2. extractText()  [DEFAULT_EXECUTOR, CPU]  → read blob via AssetService, text-extract
        ├─ failure → status Failed (+ processingError on content), extractedText cleared
        └─ success → text status (Processed / Unsupported)
  3. if text Processed AND LLMClientHolder.isEnabled():
        status ExtractingContext (file)      [content snapshot stays Processed]
        submitMemoryExtraction()  [LLM_EXECUTOR, network]
          runMemoryExtraction():
            deleteExtractedMemories(file, hardDelete=true)   ← wholesale replace
            ContextMemoryExtractor.extract(file, canonicalText)
              chunk → per-chunk LLM call → dedupe → create ContextMemory rows
                {sourceType:FileExtraction, sourceFile:<ref>, status:Active,
                 visibility:Shared}            └─ VectorEmbeddingHandler auto-embeds
            status Processed (file)
          ├─ LLM failure → status Failed (+ processingError), extractedText RETAINED
          └─ LLM queue full → status Failed ("…queue is full. Please retry later.")
     else (LLM disabled): text Processed is terminal; LLM stage never enqueued
```

Two **separate** thread pools by design (`ContextFileProcessingService`):

| Pool | Thread-name prefix | Work | Sizing |
|------|--------------------|------|--------|
| `DEFAULT_EXECUTOR` | `context-file-extraction-` | CPU-bound text extraction | `threads = max(2, cores/2)`, `ArrayBlockingQueue(max(64, threads*8))`, `AbortPolicy`, daemon |
| `LLM_EXECUTOR` | `context-memory-extraction-` | network-bound LLM calls | identical sizing |

Mixing seconds-long LLM calls into the text pool would starve text extraction;
the pools are kept separate (the class javadoc spells this out). They are
currently sized identically — the only difference is the thread-name prefix.

## 4. Key design decisions

| Decision | Choice |
|----------|--------|
| Entity | **Reuse `ContextMemory`** (new `sourceType=FileExtraction` + `sourceFile`); no new entity, no DDL migration |
| LLM layer | New **generic** `LLMCompletionClient` abstraction + per-provider concretes + factory + process-wide holder, modeled on `EmbeddingClient` |
| LLM→entity boundary | A narrow `KnowledgePill` DTO is the anti-corruption layer between untrusted model JSON and the entity (see [§9](#9-the-knowledgepill-dto-boundary)) |
| File↔pill link | `Relationship.MENTIONED_IN` edge, `ContextFile → ContextMemory`; `memoryCount` surfaced on the file |
| Reprocess | **Wholesale hard-delete + recreate** of a file's pills on every extraction run (no versioning, no checksum skip) |
| Async | Reuse + rename the live `ContextFileExtractionService` → `ContextFileProcessingService`; LLM step on its own executor |
| Status | Extend the single `ProcessingStatus` enum: insert `ExtractingContext` between `Analyzing` and `Processed` |
| Embedding | Free — `ContextMemory` already auto-embeds on create; this PR only threads `sourceFile` through the index/body-text |
| MCP | Two purpose-built tools `search_company_context` + `get_company_context` |
| Storage guardrail | New `/system/validate` "Object Storage" step + startup warn — uploads are useless if object storage is NoOp/broken |

## 5. Generic LLM completion layer

Package `org.openmetadata.service.llm` (all new).

### 5.1 Config schema

`openmetadata-spec/.../json/schema/configuration/llmConfiguration.json` →
`org.openmetadata.schema.configuration.LLMConfiguration`.

- `enabled` — boolean, default `false`.
- `provider` — enum `["bedrock", "openai", "azureOpenAI", "google", "anthropic", "noop"]`, default `noop` (Java enum `LLMProvider`).
- `maxConcurrentRequests` — integer, default `5`, minimum `1`.
- Per-provider objects (each `additionalProperties:false`):

  | Object | Java type | Auth (masked?) | Notable fields / defaults |
  |--------|-----------|----------------|---------------------------|
  | `bedrock` | `LLMBedrockConfig` | `awsConfig` → `awsBaseConfig.json` | `modelId` `anthropic.claude-3-5-sonnet-20240620-v1:0`, temp 0.0, maxTokens 4096, timeout 60s |
  | `openai` | `LLMOpenAIConfig` | `apiKey` **`mask:true`** | `modelId` `gpt-4o-mini`, `endpoint`, `deploymentName`, `apiVersion` `2024-02-01` (Azure), temp 0.0, maxTokens 4096, timeout 60s |
  | `google` | `LLMGoogleConfig` | `apiKey` **`mask:true`** | `modelId` `gemini-2.5-flash`, `endpoint`, temp 0.0, maxTokens 4096, timeout 60s |
  | `anthropic` | `LLMAnthropicConfig` | `apiKey` **`mask:true`** | `modelId` `claude-3-5-sonnet-20240620`, `baseUrl` `https://api.anthropic.com`, temp 0.0, maxTokens 4096, timeout 60s |

  Masked API keys round-trip through the Secrets Manager. Bedrock delegates
  secrecy to `awsBaseConfig.json`.

`conf/openmetadata.yaml` carries an `llmConfiguration` block, fully env-var
overridable (`LLM_ENABLED`, `LLM_PROVIDER`, `LLM_MAX_CONCURRENT_REQUESTS`, and
per-provider `LLM_<PROVIDER>_*` keys — see [§12](#12-configuration-reference)).
Its header comment states plainly that **uploaded document content is sent to the
configured provider when enabled**.

### 5.2 Client hierarchy

- **`LLMCompletionClient`** (abstract, `@Slf4j`): owns a `Semaphore`
  (`maxConcurrentRequests` permits; ctor rejects `< 1`), the `complete()` /
  `completeStructured()` template methods, JSON-array parsing, and code-fence
  stripping. Abstract surface: `doComplete(systemPrompt, userPrompt)` and
  `getModelId()`. `DEFAULT_MAX_CONCURRENT_REQUESTS = 5`.
- **Concretes** — `OpenAICompletionClient` (OpenAI + Azure OpenAI),
  `AnthropicCompletionClient`, `BedrockCompletionClient` (AWS SDK v2,
  `AutoCloseable`), `GoogleCompletionClient`, and `NoopCompletionClient`
  (returns `"[]"`, model id `"noop"`).
- **`LLMCompletionClientFactory.create(LLMConfiguration)`** — switch on
  `provider` → concrete; null config/provider → Noop. Note: the factory keys off
  `provider` only; it does **not** check `enabled` (the holder does).
- **`LLMClientHolder`** — process-wide holder of the single shared client.
  `initialize(config)`: `enabled = config != null && Boolean.TRUE.equals(getEnabled())`;
  `instance = enabled ? factory.create(config) : new NoopCompletionClient()`. So
  a real client is built **only** when `enabled == true`. `get()` never returns
  null; `isEnabled()` gates the pipeline; `setForTesting()` is the test seam.
  `volatile` fields + `synchronized` mutators.

### 5.3 `completeStructured` contract

```java
<T> List<T> completeStructured(String systemPrompt, String userPrompt, Class<T> elementType)
```

- Acquires a permit, calls `doComplete`, releases in `finally`.
- Strips a leading/trailing ` ``` ` code fence (drops the language tag line).
- Parses with a default `new ObjectMapper()` (so `FAIL_ON_UNKNOWN_PROPERTIES`
  is **on**) into `List<elementType>`. Parse failure → `LLMCompletionException`.
- **One retry** on `LLMCompletionException` (logged `warn`), then propagates. The
  retry catches `LLMCompletionException` broadly, so transport errors that surface
  as `LLMCompletionException` also get one retry.

### 5.4 Providers

All providers use plain chat/messages JSON mode (**no tool/function calling**);
non-200 → `LLMCompletionException("<provider> API returned status …")`.

- **OpenAI / Azure**: JDK `HttpClient`. Azure detected when `endpoint` **and**
  `deploymentName` are set → `.../openai/deployments/<dep>/chat/completions?api-version=<v>`
  with `api-key` header; else `Authorization: Bearer`. Reads `choices[0].message.content`.
- **Anthropic**: JDK `HttpClient`, `<baseUrl>/v1/messages`, headers `x-api-key` +
  `anthropic-version: 2023-06-01`. Reads `content[0].text`.
- **Bedrock**: AWS SDK v2 `BedrockRuntimeClient` (credentials via
  `AwsCredentialsUtil.buildCredentialsProvider`, region required). Body uses
  `anthropic_version: bedrock-2023-05-31`. Reads `content[0].text`. `close()`
  exists but the holder never calls it.
- **Google Gemini**: JDK `HttpClient`,
  `.../models/<modelId>:generateContent?key=<apiKey>` (**API key in the URL
  query string**). Reads `candidates[0].content.parts[0].text`.

### 5.5 Startup wiring

`OpenMetadataApplicationConfig` gains
`@JsonProperty("llmConfiguration") private LLMConfiguration llmConfiguration`.
`OpenMetadataApplication` startup calls
`LLMClientHolder.initialize(catalogConfig.getLlmConfiguration())` (new), then the
pre-existing `LlmConfigHolder.initialize(...)` (publishes raw config for MCP
Chat). Two holders, same config source.

## 6. Schema & persistence changes

No DDL / Flyway migration — `ContextMemory` and `ContextFile` use the generic
JSON-column entity tables, and the file↔pill link lives in the generic
`entity_relationship` table.

### 6.1 Schemas

- **`contextMemory.json`** — `sourceType` enum gains `FileExtraction`
  (`FILE_EXTRACTION`); new property `sourceFile` (`entityReference`, not required).
- **`createContextMemory.json`** — new create-time `sourceFile` (`entityReference`).
- **`contextFile.json`** — `ProcessingStatus` enum gains `ExtractingContext` (3rd,
  between `Analyzing` and `Processed`); new derived property `memoryCount`
  (integer, default 0).

### 6.2 Repositories

- **`ContextMemoryRepository`** — `FIELD_SOURCE_FILE = "sourceFile"` added to
  `PATCH_FIELDS`/`UPDATE_FIELDS`. `storeRelationships` adds an
  `addRelationship(sourceFile.id /*from*/, memory.id /*to*/, CONTEXT_FILE,
  CONTEXT_MEMORY, Relationship.MENTIONED_IN)` edge. `setFields` resolves it with
  `findFrom(memory.id, CONTEXT_MEMORY, MENTIONED_IN, CONTEXT_FILE)` (bulk path via
  `findFromBatch`). Patch handled via `updateFromRelationship(...)`.
  - **Collision-free by construction:** each relationship hierarchy uses a
    distinct `Relationship` — `rootMemory`→`CONTAINS`, `parentMemory`→`PARENT_OF`,
    `domains`→`HAS`, `sourceFile`→**`MENTIONED_IN`** — so the four resolvers query
    disjoint `(relation, fromType)` tuples.
- **`ContextFileRepository`** — `memoryCount` computed in `setFields` as
  `findTo(file.id, CONTEXT_FILE, MENTIONED_IN, CONTEXT_MEMORY).size()`. New
  `postDelete` cascades: `deleteExtractedMemories(file, hardDelete)` deletes each
  linked pill, propagating the file delete's `hardDelete` flag (soft→soft,
  hard→hard). The same method is reused by the reprocess path with `hardDelete=true`.
- **`ContextMemoryMapper`** — passthrough of `create.getSourceFile()`.

## 7. Processing pipeline & status

### 7.1 Status state machine (`ProcessingStatus`)

```
Uploaded ─▶ Analyzing ─▶ (text result) ─▶ Processed ─▶ ExtractingContext ─▶ Processed
                          │                  ▲ (LLM enabled)                    (final)
                          ├─▶ Failed         └─ if LLM disabled: terminal here
                          └─▶ Unsupported (passthrough from text extractor)
                       any stage failure ─▶ Failed
```

- The file and its content snapshot carry status independently. When the file
  advances to `ExtractingContext`, the **content snapshot keeps `Processed`** (it
  received the raw text status).
- `Unsupported` exists in the enum but the service never writes it — it is passed
  through verbatim from `ContextFileTextExtractor`.

### 7.2 Service (`ContextFileProcessingService`, was `ContextFileExtractionService`)

- Only call site: `ContextFileResource` upload path →
  `extractionService.submit(fileId, contentId)`.
- `submit` wraps `executor.execute(() -> process(...))` and catches
  `RejectedExecutionException` (queue full → `Failed`, "Processing queue is full").
- Every stage re-reads from the repo and re-checks `headContentId`; a newer
  upload silently abandons the stale content's writes (concurrent re-upload guard).
- `canonicalText` feeds the LLM the **content snapshot's** extracted text
  (capped ~1M chars) in preference to the file's indexed text (capped ~200K).

### 7.3 Error handling

- `applyFailure` sets both file and content to `Failed`; `processingError` is
  written to the **content snapshot only**, not the file entity.
- **Text-stage** failures clear `extractedText` (+ `pageCount`). **LLM-stage**
  failures **retain** `extractedText` (so the file stays indexed and is retriable
  by re-upload).
- `extractText` catches `Throwable` but re-throws `VirtualMachineError`.
- No automatic retry anywhere; "retry later" means re-POST the file.

## 8. Knowledge-pill extraction (`ContextMemoryExtractor`)

- `extract(file, text)`: `chunkText` → per-chunk `completeStructured(SYSTEM_PROMPT,
  chunk, KnowledgePill.class)` → `dedupe` → `memoryRepository.create(toMemory(pill, fileRef))`.
- **Chunking:** `MAX_PROMPT_CHARS = 60_000`, `MAX_CHUNKS = 8`. Chunk ends snap
  back to the last `\n\n` / `\n` / ` ` boundary in the second half of the budget,
  else hard-cut at the char cap. **Text past 8 chunks (~480K chars) is dropped
  with a warning** — even though `canonicalText` may supply up to ~1M chars.
- **Dedupe:** `LinkedHashMap` keyed by `question.trim().toLowerCase(ROOT)`,
  first-wins, insertion order preserved.
- **`isValid`:** `question` and `answer` both non-blank (title/summary/memoryType
  optional).
- **`toMemory`** sets the full server-owned envelope: `id` (random UUID), `name`
  (`<fileName>-<uuid>`), `fullyQualifiedName`, `title`, `question`, `answer`,
  `summary`, `memoryType` (via `parseType`), `status=ACTIVE`,
  `sourceType=FILE_EXTRACTION`, `sourceFile=<fileRef>`,
  `shareConfig.visibility=SHARED`, `updatedBy=admin`, `updatedAt=now`.
- **`parseType`:** case-insensitive match against `ContextMemoryType`
  (`Preference | UseCase | Note | Runbook | Faq`); default `NOTE`.
- **`SYSTEM_PROMPT`:** *"You extract reusable company knowledge from a document as
  a JSON array. Each element is an object with keys: title, question, answer,
  summary, memoryType (one of Faq, Note, Runbook, UseCase, Preference). Capture
  durable facts, definitions, policies, and how-to guidance. Return ONLY the JSON
  array, no prose."*

### Reprocess / idempotency

Every LLM run first calls `deleteExtractedMemories(file, hardDelete=true)`,
**hard-deleting all of the file's existing pills**, then recreates from scratch
with fresh random IDs/FQNs. There is **no supersede/versioning** and **no
checksum short-circuit** — re-uploading identical bytes re-runs text extraction
and the LLM and regenerates pills. (Rationale in code: machine-generated pills
are replaced wholesale, so soft-deleted rows would only accumulate with no
restore path.)

## 9. The `KnowledgePill` DTO boundary

`KnowledgePill` (`service/llm/KnowledgePill.java`) is a 5-field record
(`title, question, answer, summary, memoryType`) used **only** as the LLM
deserialization target — deliberately not the `ContextMemory` entity. It is the
anti-corruption boundary between untrusted model JSON and the trusted entity
model. Parsing model output straight into `ContextMemory` is avoided because:

1. **Strict unknown fields.** `completeStructured` uses a default `ObjectMapper`
   (`FAIL_ON_UNKNOWN_PROPERTIES` on) and `contextMemory.json` is
   `additionalProperties:false` — one stray model key would fail the whole array
   parse. `KnowledgePill` carries `@JsonIgnoreProperties(ignoreUnknown = true)`.
2. **Enum leniency.** `ContextMemory.memoryType` is the `ContextMemoryType` enum
   (Jackson throws on a non-exact value); `KnowledgePill.memoryType` is a raw
   String, so casing/variant forms degrade to `NOTE` in `parseType`.
3. **Server-owned identity.** `contextMemory.json` requires `id`/`name`, and the
   whole envelope (FQN, status, sourceType, sourceFile, shareConfig,
   updatedBy/At) is set server-side in `toMemory` — the model neither produces
   nor should influence these.
4. **Minimal prompt contract.** The DTO is exactly the five fields the prompt
   asks for; targeting the entity would expose its nested schema to the model.

`toMemory` + `parseType` is the single mapping layer; validation and dedupe
operate on the DTO before any entity is built.

## 10. Embedding & search

`contextMemory` was already vector-indexable and auto-embedded on create
(`AvailableEntityTypes`, `VectorEmbeddingHandler`, parent aliases
`["all", "dataAssetEmbeddings"]`) — **unchanged here**. This PR threads the new
`sourceFile` reference through three layers so file-derived pills are searchable
by their origin filename:

- `ContextMemoryIndex` — `doc.put("sourceFile", getEntityWithDisplayName(...))`.
- ES/OS mapping — a new `sourceFile` object (id/type/name/displayName/fqn/deleted
  as keywords) added identically to all four
  `elasticsearch/{en,jp,ru,zh}/context_memory_search_index.json` files (the
  per-language copies are byte-identical; no language-specific analyzers).
- `ContextMemoryBodyTextContributor` — appends `source file: <name>` to the
  embedding body text.

## 11. Object-storage validation (guardrail)

Uploaded file content lives in object storage (S3 / Azure / in-memory) via
`AssetService`. If that backend is disabled or NoOp, uploads silently "succeed"
but their bytes are discarded and extraction fails with **"Unable to read file
content from object storage"** — producing zero pills. To surface this *before*
users hit it:

- **`SystemRepository.getObjectStorageValidation(config)`** adds an **"Object
  Storage"** step to the existing `GET /api/v1/system/status` validation. It fails
  fast when object storage is disabled/missing or the factory holds a
  `NoOpAssetService`; otherwise it runs a **live write→read→delete round-trip
  probe** (tiny `text/plain` asset, 10s per-op timeout, asserts the bytes match,
  cleans up in `finally`).
- **`AssetServiceFactory.init`** logs a `warn` when storage is disabled,
  naming Context Center Drive and the exact failure string.
- Test (`SystemRepositoryObjectStorageValidationTest`) exercises the real
  `AssetServiceFactory` + `InMemoryAssetService`: disabled, missing config,
  NoOp-after-config-drift, and a passing live in-memory round-trip.

This reuses the existing `/system/status` framework (no new endpoint) but exists
solely for the Drive → object-storage → extraction pipeline.

## 12. MCP tools

Two tools in `openmetadata-mcp/.../tools/`, registered in `tools.json` and
dispatched by new `DefaultToolContext` switch cases (via the 3-arg, no-limits
`execute` — neither tool records usage or enforces limits).

### `search_company_context`
- **Input:** `query` (string, required); `size` (integer, default 10, clamped 1..50).
- **Query:** `OpenSearchVectorService.search(query, filters, size, from=0, k=100,
  threshold=0.0)` with filters pinned to `entityType=contextMemory`,
  `sourceType=FileExtraction`, **and `visibility=Shared`**.
- **Output:** `{query, results:[{fullyQualifiedName, name, title, question,
  answer, summary, sourceFile, similarityScore}], returnedCount}`.
- **Auth:** global `authorize(CONTEXT_MEMORY, VIEW_ALL)`. Requires vector
  embedding enabled, else returns an error payload.

### `get_company_context`
- **Input:** `fqn` (string, required — the `fullyQualifiedName` from a search hit).
- **Lookup:** `Entity.getEntityByName(CONTEXT_MEMORY, fqn,
  "sourceFile,owners,tags,domains", null)`.
- **Exposability gate:** returns the pill only if `sourceType=FILE_EXTRACTION`
  **and** `shareConfig.visibility=SHARED`, else an error.
- **Output:** `{fullyQualifiedName, name, title, question, answer, summary,
  memoryType, sourceFile (as FQN)}`.
- **Auth:** same global `VIEW_ALL`.

Both gate on a single global `VIEW_ALL` plus the `Shared`-visibility scope; there
is no per-pill owner re-check beyond that.

## 13. UI

- **`DocumentStatusBadge`** (new) renders a `ui-core-components` `Badge` (size
  `sm`, no icon) from a `ProcessingStatus`, returning `null` when status is
  absent. Mapping:

  | Status | Color | Label key |
  |--------|-------|-----------|
  | `Uploaded` | gray | `label.uploaded` |
  | `Analyzing` | blue | `label.analyzing` |
  | `ExtractingContext` | indigo | `label.extracting-context` |
  | `Processed` | success | `label.processed` |
  | `Failed` | error | `label.failed` |
  | `Unsupported` | warning | `label.unsupported` |

- **`DocumentsView`** renders the badge inline next to each document's filename,
  driven by `file.processingStatus`.
- **i18n:** 4 new `en-us` keys (`label.analyzing`, `label.extracting-context`,
  `label.unsupported`, `label.uploaded`); `label.processed`/`label.failed`
  pre-existed. Synced across all locales.

## 14. Security & privacy

- LLM provider API keys are `mask:true` config through the Secrets Manager —
  never logged, never returned in API responses.
- **File content is sent to the configured LLM provider** during extraction. This
  is an explicit, admin-enabled action (`llmConfiguration.enabled`), and the
  provider is the admin's configured choice — documented in the yaml header.
- Generated pills default to `visibility=Shared` (org-readable). MCP retrieval
  enforces the `Shared` scope and a `VIEW_ALL` authorize on every call.
- No new unauthenticated surface; MCP tools ride existing OAuth/JWT auth.

## 15. Testing

**Java unit (`openmetadata-service`)**
- `drive/ContextFileProcessingServiceTest` — status machine: analyzing→processed,
  LLM-enabled extraction, LLM-rejection/failure keeps text, storage-unavailable &
  null-stream failures, executor rejection, head-content skip, VME rethrow.
- `drive/ContextMemoryExtractorTest` — one-memory-per-pill, dedupe + skip-invalid,
  skip-when-no-text, multi-chunk dedupe, chunk cap.
- `jdbi3/SystemRepositoryObjectStorageValidationTest` — the four storage-validation
  scenarios.
- `llm/LLMClientHolderTest`, `llm/LLMCompletionClientFactoryTest`,
  `llm/LLMCompletionClientTest` — holder stability + disabled-builds-no-client,
  factory dispatch, structured parsing / code-fence / concurrency guard.

**MCP (`openmetadata-mcp`)**
- `tools/GetCompanyContextToolTest` — missing/blank fqn, auth-denied, shared-pill
  projection, non-file & private rejection.
- `tools/SearchCompanyContextToolTest` — missing/blank query, auth-denied (input
  guards; does not exercise the vector path).

**Integration (`openmetadata-integration-tests`)**
- `it/drive/CompanyContextPipelineIT` — end-to-end: upload `.txt`, poll
  (Awaitility, ≤45s) to `Processed`, `assumeTrue(memoryCount > 0)` to skip
  gracefully when no LLM provider is configured; otherwise asserts
  `memoryCount == pills.size()` and per-pill `sourceType=FILE_EXTRACTION`, non-null
  `sourceFile` matching the file id, non-blank question/answer.

**UI** — `DocumentStatusBadge.test.tsx` (renders nothing without status; `it.each`
over the six status→label→color rows). No new Playwright spec.

## 16. Configuration reference

```yaml
llmConfiguration:
  enabled: ${LLM_ENABLED:-false}
  provider: ${LLM_PROVIDER:-noop}          # noop | openai | azureOpenAI | bedrock | google | anthropic
  maxConcurrentRequests: ${LLM_MAX_CONCURRENT_REQUESTS:-5}
  openai:
    apiKey:        ${LLM_OPENAI_API_KEY:-""}
    modelId:       ${LLM_OPENAI_MODEL_ID:-"gpt-4o-mini"}
    endpoint:      ${LLM_OPENAI_ENDPOINT:-""}
    deploymentName:${LLM_OPENAI_DEPLOYMENT:-""}
    apiVersion:    ${LLM_OPENAI_API_VERSION:-"2024-02-01"}
    maxTokens:     ${LLM_OPENAI_MAX_TOKENS:-4096}
  bedrock:
    awsConfig:
      awsRegion:       ${AWS_BEDROCK_REGION:-""}
      # IAM or static keys via AWS_BEDROCK_ACCESS_KEY / _SECRET_KEY / _SESSION_TOKEN
    modelId:   ${LLM_BEDROCK_MODEL_ID:-"eu.anthropic.claude-haiku-4-5-20251001-v1:0"}
    maxTokens: ${LLM_BEDROCK_MAX_TOKENS:-4096}
  google:
    apiKey:    ${LLM_GOOGLE_API_KEY:-""}
    modelId:   ${LLM_GOOGLE_MODEL_ID:-"gemini-2.5-flash"}
    maxTokens: ${LLM_GOOGLE_MAX_TOKENS:-4096}
  anthropic:
    apiKey:    ${LLM_ANTHROPIC_API_KEY:-""}
    modelId:   ${LLM_ANTHROPIC_MODEL_ID:-"claude-3-5-sonnet-20240620"}
    baseUrl:   ${LLM_ANTHROPIC_BASE_URL:-"https://api.anthropic.com"}
    maxTokens: ${LLM_ANTHROPIC_MAX_TOKENS:-4096}
```

## 17. Known limitations & follow-ups

1. **Chunk tail dropped.** Documents over ~480K chars (8 × 60K) lose their tail to
   the LLM, even though `canonicalText` supplies up to ~1M chars. Consider raising
   `MAX_CHUNKS` or summarizing the remainder.
2. **`memoryCount` not in bulk path.** It is populated only in single-entity
   `setFields`, not `setFieldsInBulk` — list endpoints requesting `memoryCount`
   may return it unset.
3. **`processingError` is content-only.** The file entity flips to `Failed` with
   no error string; clients must read the content snapshot for the reason.
4. **No checksum short-circuit.** Identical re-uploads pay the full text + LLM
   cost; the captured checksum is stored but never compared.
5. **Wholesale reprocess.** Pills are hard-deleted and regenerated with new
   UUIDs/FQNs each run — no continuity/versioning for an unchanged pill.
6. **Bedrock client never closed.** `BedrockCompletionClient` is `AutoCloseable`
   but `LLMClientHolder` never calls `close()`; a re-`initialize` would leak the
   prior SDK client. Low impact (single startup init).
7. **Factory ignores `enabled`.** Only the holder gates on it; calling the factory
   directly with `enabled=false` + a real provider would still build a live client.
8. **MCP authorization is coarse.** A single global `VIEW_ALL` + ES
   `visibility=Shared` filter, with no per-pill owner re-check.
9. **`Unsupported` status** is in the enum but never written by the service
   (passthrough from the text extractor only).
10. **Per-language ES index files are byte-identical** — the jp/ru/zh
    `sourceFile` mappings carry no CJK/Russian-specific analyzers.

## 18. File touch-list

**New — backend**
- `openmetadata-spec/.../json/schema/configuration/llmConfiguration.json`
- `openmetadata-service/.../service/llm/` — `LLMCompletionClient`,
  `LLMCompletionClientFactory`, `LLMClientHolder`, `LLMCompletionException`,
  `KnowledgePill`, `NoopCompletionClient`, `OpenAICompletionClient`,
  `AnthropicCompletionClient`, `BedrockCompletionClient`, `GoogleCompletionClient`
- `openmetadata-service/.../service/drive/ContextMemoryExtractor.java`
- `openmetadata-mcp/.../tools/SearchCompanyContextTool.java`, `GetCompanyContextTool.java`

**New — frontend**
- `.../components/.../ContextCenter/DocumentStatusBadge/` (component, interface, test)

**Modified — schema**
- `entity/context/contextMemory.json`, `api/context/createContextMemory.json`,
  `entity/data/contextFile.json` (+ generated TS mirrors)

**Modified — backend**
- `OpenMetadataApplication.java`, `OpenMetadataApplicationConfig.java`,
  `conf/openmetadata.yaml`
- `service/drive/ContextFileExtractionService.java` → **renamed**
  `ContextFileProcessingService.java`
- `resources/drive/ContextFileResource.java`
- `jdbi3/ContextMemoryRepository.java`, `jdbi3/ContextFileRepository.java`,
  `jdbi3/SystemRepository.java`, `attachments/AssetServiceFactory.java`
- `resources/context/ContextMemoryMapper.java`
- `search/indexes/ContextMemoryIndex.java`,
  `search/vector/ContextMemoryBodyTextContributor.java`,
  `elasticsearch/{en,jp,ru,zh}/context_memory_search_index.json`
- `openmetadata-mcp/.../tools/DefaultToolContext.java`,
  `openmetadata-mcp/.../resources/json/data/mcp/tools.json`

**Modified — frontend**
- `.../DocumentsView/DocumentsView.component.tsx`, locale files (17), generated TS

**Tests** — across `openmetadata-service`, `openmetadata-mcp`,
`openmetadata-integration-tests`, and UI (see [§15](#15-testing)).

**Codegen after schema edits:** `make generate`, `mvn spotless:apply`, UI
checkstyle for generated TS, `npx tsc --noEmit`.
