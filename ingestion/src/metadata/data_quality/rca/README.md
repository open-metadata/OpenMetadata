# AI-Powered Root Cause Analysis for DQ Checks (Wemakedevs x OpenMetadata Hackathon)

## Overview

When a Data Quality check fails, OpenMetadata can call an LLM to generate a plain-English
explanation of the likely root cause. The explanation is stored on `TestCaseResult.rcaExplanation`
and displayed in the **AI Analysis** tab of the Incident Manager detail page. Before this feature,
engineers had to manually inspect failing rows and pipeline logs to diagnose failures; now the
first-pass analysis is generated automatically and attached directly to the failing check.

## How It Works

```text
DQ Check Fails (status = Failed)
    → SignalBuilder extracts: failing rows, SQL, metrics, thresholds, test type
    → DQRcaAgent selects provider (OpenAI / Azure OpenAI / Anthropic)
    → Prompt built with diagnostic context + test-type-specific hint
    → LLM response parsed → RcaResult(explanation, generated_at)
    → rcaExplanation + rcaGeneratedAt stored on TestCaseResult
    → AI Analysis tab appears in IncidentManager UI
```

RCA is invoked inside `TestSuiteInterface.run_test_case()` after the failed-sample validator.
Any exception during analysis is caught and logged as a `WARNING`; the DQ pipeline continues.

## Supported LLM Providers

| Provider     | `provider` value  | Notes                                                        |
|--------------|-------------------|--------------------------------------------------------------|
| OpenAI       | `openai`          | Requires `pip install openai`                                |
| Azure OpenAI | `azure_openai`    | Requires `pip install openai` and `baseUrl` set to endpoint  |
| Anthropic    | `anthropic`       | Requires `pip install anthropic`                             |

## Enabling RCA on a Test Case

RCA runs only for test cases where `enableRcaAnalysis` is explicitly set to `true`.
Toggle it in the OpenMetadata UI on the Test Case entity detail page, or set it via the API:

```bash
PATCH /api/v1/dataQuality/testCases/{id}
Content-Type: application/json-patch+json

[{"op": "add", "path": "/enableRcaAnalysis", "value": true}]
```

## Workflow Configuration

Add `aiConfig` to the `processor.config` block of a TestSuite workflow YAML.
Remove the block entirely to disable RCA with no other impact.

```yaml
processor:
  type: orm-test-runner
  config:
    aiConfig:
      provider: "openai"
      apiKey: "${OPENAI_API_KEY}"   # always use an env var — never a literal key
      model: "gpt-4o-mini"
      maxTokens: 600                # optional, default 500
      timeoutSeconds: 30            # optional, default 30
```

**Anthropic example:**
```yaml
    aiConfig:
      provider: "anthropic"
      apiKey: "${ANTHROPIC_API_KEY}"
      model: "claude-3-haiku-20240307"
```

**Azure OpenAI example:**
```yaml
    aiConfig:
      provider: "azure_openai"
      apiKey: "${AZURE_OPENAI_API_KEY}"
      model: "gpt-4o-mini"                     # deployment name
      baseUrl: "${AZURE_OPENAI_ENDPOINT}"       # https://<resource>.openai.azure.com/
```

A complete working example is at
[`ingestion/src/metadata/examples/workflows/test_suite_with_rca.yaml`](../../examples/workflows/test_suite_with_rca.yaml).

### `aiConfig` field reference

| Field            | Type    | Required | Default | Description                                           |
|------------------|---------|----------|---------|-------------------------------------------------------|
| `provider`       | string  | Yes      | —       | `openai`, `azure_openai`, or `anthropic`              |
| `apiKey`         | string  | Yes      | —       | API authentication key. Use `${ENV_VAR}` syntax.      |
| `model`          | string  | Yes      | —       | Model or deployment name for the chosen provider.     |
| `baseUrl`        | string  | No       | `null`  | Required for `azure_openai`. The Azure endpoint URL.  |
| `maxTokens`      | integer | No       | `500`   | Maximum tokens allowed in the LLM response.           |
| `timeoutSeconds` | integer | No       | `30`    | HTTP timeout; RCA is skipped if the call exceeds this.|

## Supported Test Types

The following test types have provider-specific diagnostic hints injected into the prompt.
All other test types receive a general diagnostic hint.

- `columnValuesToBeNotNull`
- `columnValuesToBeUnique`
- `columnValuesToBeBetween`
- `columnValuesToMatchRegex`
- `columnValuesToNotMatchRegex`
- `columnValuesToBeInSet`
- `columnValuesToBeNotInSet`
- `columnValueLengthsToBeBetween`
- `tableRowCountToBeBetween`
- `tableRowCountToEqual`
- `tableColumnCountToBeBetween`
- `tableCustomSQLQuery`
- `columnReferentialIntegrity`
- `tableDiff`

## Example Output

```text
Test case : orders_amount_range_check
Column    : orders.order_amount

AI Analysis:
  108 values fall below the minimum threshold of 0, suggesting negative
  amounts are being recorded. The most likely cause is that refund
  transactions are not being filtered before the ETL load step. Inspect
  the refund_filter transformation in the orders pipeline and verify
  the WHERE clause filters out records with transaction_type = 'REFUND'.
```

## Safety and Opt-in Design

Three independent guards must all pass before an LLM call is made:

1. **`aiConfig` must be set** in the workflow's `processor.config`. If the block is absent,
   the feature is completely inactive.
2. **`enableRcaAnalysis: true`** must be set on the individual `TestCase` entity. This
   lets teams enable AI analysis selectively on high-value checks only.
3. **Test result must be `Failed`**. Success, Aborted, and Queued results are never analysed.

If any guard fails, `_run_rca_analysis()` returns immediately. If an LLM call fails for
any reason (network error, rate limit, bad API key), the exception is caught, logged at
`WARNING`, and the DQ pipeline continues without interruption.

## Running the Tests

```bash
cd ingestion
python -m pytest tests/unit/data_quality/rca/ -v
```

39 unit tests, no infrastructure required (all LLM calls are mocked with `unittest.mock`).

## Module Structure

```text
ingestion/src/metadata/data_quality/rca/
├── __init__.py          — package marker
├── models.py            — AiConfig and RcaResult Pydantic models
├── signal_builder.py    — SignalBuilder: extracts diagnostic signal from TestCaseResultResponse
├── rca_agent.py         — DQRcaAgent: builds prompt, calls LLM, returns RcaResult
├── templates.py         — SIGNAL_HINTS: per-test-type diagnostic hint strings
└── README.md            — this file
```
