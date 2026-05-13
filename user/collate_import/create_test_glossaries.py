#!/usr/bin/env python3
"""
Create [TEST] Core / Attribution / LevelPlay / EngineData glossaries in Collate
with the new architecture: description (consumer-facing) + custom properties
(dataType, complianceRules) for schema/compliance specs.

Usage:
    source ~/.zshrc
    .venv/bin/python user/collate_import/create_test_glossaries.py
"""
from __future__ import annotations
import json, ssl, urllib.request, urllib.parse, os, time
import certifi

COLLATE_BASE = "https://localhost:8585/api/v1"
token = os.environ.get("COLLATE_ACCESS_TOKEN", "")
ctx = ssl.create_default_context(cafile=certifi.where())
HEADERS = {"Authorization": f"Bearer {token}", "Accept": "application/json", "User-Agent": "Mozilla/5.0"}

# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _get(path: str):
    r = urllib.request.Request(f"{COLLATE_BASE}{path}", headers=HEADERS)
    try:
        with urllib.request.urlopen(r, timeout=30, context=ctx) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def _post(path: str, data: dict):
    body = json.dumps(data).encode()
    r = urllib.request.Request(f"{COLLATE_BASE}{path}", data=body, method="POST",
        headers={**HEADERS, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=30, context=ctx) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def _encode_fqn(fqn: str) -> str:
    # Keep dots unencoded — OpenMetadata's FQN path parser uses them as
    # component separators and does not treat %2E as equivalent to '.'.
    return urllib.parse.quote(fqn, safe=".")

def _patch_extension(fqn: str, ext: dict, max_retries: int = 6) -> bool:
    """Patch extension with retry and sleep between attempts for fresh server routing.
    dataType is always sent as a list (enum type requires array format)."""
    encoded = _encode_fqn(fqn)
    payload = dict(ext)
    # Ensure dataType is always an array (enum custom property requires list)
    if "dataType" in payload and not isinstance(payload["dataType"], list):
        payload["dataType"] = [payload["dataType"]]

    ops = [{"op": "add", "path": "/extension", "value": payload}]
    body = json.dumps(ops).encode()
    for attempt in range(1, max_retries + 1):
        r = urllib.request.Request(f"{COLLATE_BASE}/glossaryTerms/name/{encoded}",
            data=body, method="PATCH",
            headers={**HEADERS, "Content-Type": "application/json-patch+json"})
        try:
            with urllib.request.urlopen(r, timeout=30, context=ctx) as resp:
                json.loads(resp.read().decode())
                return True
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            if attempt < max_retries:
                time.sleep(1.5)
                continue
            print(f"    WARN ext patch failed for {fqn} (attempt {attempt}): {err[:120]}")
    return False

# ── Glossary create / get ─────────────────────────────────────────────────────

def ensure_glossary(name: str, description: str) -> str | None:
    """Return glossary ID, creating it if needed."""
    s, d = _get("/glossaries?limit=50")
    if isinstance(d, dict):
        for g in d.get("data", []):
            if g.get("name") == name:
                print(f"  Glossary '{name}' already exists (id={g['id']})")
                return g["id"]
    s, d = _post("/glossaries", {"name": name, "description": description})
    if isinstance(d, dict) and d.get("id"):
        print(f"  Created glossary '{name}' (id={d['id']})")
        return d["id"]
    print(f"  ERROR creating glossary '{name}': {d}")
    return None

# ── Term create ───────────────────────────────────────────────────────────────

def create_term(glossary_name: str, t: dict) -> bool:
    name = t["name"]
    fqn  = f"{glossary_name}.{name}"

    # Check if already exists
    enc = _encode_fqn(fqn)
    s, d = _get(f"/glossaryTerms/name/{enc}")
    term_exists = isinstance(d, dict) and bool(d.get("id"))

    if not term_exists:
        payload: dict = {
            "name": name,
            "displayName": t.get("displayName", name.replace("_", " ").title()),
            "description": t["description"],
            "glossary": glossary_name,
        }
        if t.get("synonyms"):
            payload["synonyms"] = t["synonyms"]

        s, d = _post("/glossaryTerms", payload)
        if not (isinstance(d, dict) and d.get("id")):
            print(f"    ERROR creating {fqn}: {d}")
            return False
        print(f"    Created: {fqn}")
    else:
        print(f"    SKIP (exists): {fqn}")

    # Always set/update custom properties
    ext: dict = {}
    if t.get("dataType"):
        ext["dataType"] = t["dataType"]  # kept as list; _patch_extension normalises to array
    if t.get("complianceRules"):
        ext["complianceRules"] = t["complianceRules"]
    if t.get("allowedValues"):
        ext["allowedValues"] = t["allowedValues"]
    if ext:
        ok = _patch_extension(fqn, ext)
        if not ok:
            print(f"    WARN: custom props not set for {fqn}")
    return True

# ══════════════════════════════════════════════════════════════════════════════
# DATA
# ══════════════════════════════════════════════════════════════════════════════

GLOSSARY_DEFS = [
    ("[TEST] Core",        "Canonical cross-table schema and glossary for Core Unity data concepts. Includes consumer-facing definitions and producer-facing compliance specs."),
    ("[TEST] Attribution", "Canonical schema and glossary for attribution and MMP-related fields."),
    ("[TEST] LevelPlay",   "Glossary for LevelPlay mediation-specific concepts and fields."),
    ("[TEST] EngineData",  "Glossary for Unity Engine telemetry-specific concepts (EngineData pipeline)."),
]

# ─── [TEST] Core terms ────────────────────────────────────────────────────────

CORE_TERMS = [
    # ── Core Both: Glossary + Schema ─────────────────────────────────────────
    {
        "name": "event_id",
        "displayName": "Event ID",
        "description": "A stable unique identifier assigned to each event. Use for deduplication and precise joins across pipelines.",
        "dataType": ["STRING"],
        "complianceRules": "NOT NULL. Globally unique per event within the producer's pipeline. Required field.",
    },
    {
        "name": "event_name",
        "displayName": "Event Name",
        "description": "The canonical name describing the type of event — e.g. crash, install, impression. Must be a value from the approved event taxonomy defined by the product team.",
        "dataType": ["STRING"],
        "complianceRules": "NOT NULL. Must be a value from the approved event taxonomy. Free-form values are not permitted.",
    },
    {
        "name": "event_time",
        "displayName": "Event Time",
        "description": "The timestamp in UTC when the event occurred, as recorded by the producer system. The primary timestamp for ordering and analysis.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "NOT NULL. UTC. Primary timestamp for partitioning, ordering, and analysis.",
        "synonyms": ["client_time"],
    },
    {
        "name": "ingestion_time",
        "displayName": "Ingestion Time",
        "description": "The timestamp when Unity's systems received and ingested the event. Used to measure pipeline latency relative to event_time.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "NOT NULL. UTC timestamp when Unity's ingestion tier received the event.",
    },
    {
        "name": "install_time",
        "displayName": "Install Time",
        "description": "The timestamp when the producer SDK first identifies a user as new to the application. Reflects first detected session — not necessarily the literal installation moment. Used for new-user analysis and cohort segmentation.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "Nullable. UTC. Null if unavailable. Not guaranteed to reflect literal app install time.",
        "synonyms": ["first_session_time"],
    },
    {
        "name": "session_id",
        "displayName": "Session ID",
        "description": "A unique identifier for a discrete user session. Scope and lifetime are defined by the producing domain.",
        "dataType": ["STRING"],
        "complianceRules": "Nullable. Scope, lifetime, and reset conditions are domain-specific and must be documented in the table's column description.",
    },
    {
        "name": "auction_id",
        "displayName": "Auction ID",
        "description": "A unique identifier for a discrete ad auction.",
        "dataType": ["STRING"],
        "complianceRules": "Nullable. Unique identifier for a single ad auction event.",
    },
    {
        "name": "campaign_id",
        "displayName": "Campaign ID",
        "description": "A unique identifier for an advertising campaign.",
        "dataType": ["STRING"],
        "complianceRules": "Nullable.",
    },
    {
        "name": "creative_id",
        "displayName": "Creative ID",
        "description": "A unique identifier for a specific ad creative — image, video, or other asset.",
        "dataType": ["STRING"],
        "complianceRules": "Nullable.",
    },
    {
        "name": "fill_id",
        "displayName": "Fill ID",
        "description": "A unique identifier for a specific ad fill instance.",
        "dataType": ["STRING"],
        "complianceRules": "Nullable.",
    },
    {
        "name": "placement_id",
        "displayName": "Placement ID",
        "description": "A unique identifier for an ad placement as recognized by the ad network.",
        "dataType": ["STRING"],
        "complianceRules": "Nullable.",
    },
    {
        "name": "platform",
        "displayName": "Platform",
        "description": "The operating system platform of the device. Possible values: ios, android.",
        "dataType": ["STRING"],
        "complianceRules": "Null when platform cannot be determined.",
        "allowedValues": "android, ios",
    },
    {
        "name": "country",
        "displayName": "Country",
        "description": "The country associated with the device. Expressed as a two-letter uppercase ISO 3166-1 alpha-2 code — e.g. US (United States), GB (United Kingdom), DE (Germany).",
        "dataType": ["STRING"],
        "complianceRules": "ISO 3166-1 alpha-2. Must be uppercase (e.g. US, GB, DE). Null when geolocation is unavailable.",
    },
    {
        "name": "connection_type",
        "displayName": "Connection Type",
        "description": "The type of network connection the device is using at the time of the event. Examples: wifi, cellular, ethernet.",
        "dataType": ["STRING"],
        "complianceRules": "Null when unavailable.\n\n**Note:** `unknown` appears in production LevelPlay data but is not in the compliance allowlist — producers emitting this value are currently failing the column-value pair check.",
        "allowedValues": "wifi, cellular, satellite, ethernet, bluetooth_tethering, not_connected",
    },
    {
        "name": "currency",
        "displayName": "Currency",
        "description": "The currency associated with a monetary value. Expressed as a three-letter ISO 4217 code — e.g. USD, EUR, GBP.",
        "dataType": ["STRING"],
        "complianceRules": "ISO 4217 three-letter currency code. Uppercase (e.g. USD, EUR, GBP).",
    },
    {
        "name": "revenue",
        "displayName": "Revenue",
        "description": "The monetary value generated from a purchase or monetization event.",
        "dataType": ["FLOAT64"],
        "complianceRules": "Value in USD. Null for non-purchase events.",
    },
    {
        "name": "revenue_original_currency",
        "displayName": "Revenue Original Currency",
        "description": "The monetary value of a purchase event before currency conversion.",
        "dataType": ["FLOAT64"],
        "complianceRules": "Value in the original transaction currency. Use alongside the currency field. Null for non-purchase events.",
    },
    {
        "name": "advertiser_bundle_id",
        "displayName": "Advertiser Bundle ID",
        "description": "The unique identifier for an advertiser's app, in reverse domain format — e.g. com.example.game (Android) or com.example.app (iOS).",
        "dataType": ["STRING"],
        "complianceRules": "Reverse domain format (e.g. `com.example.game` on Android; bundle ID format on iOS).",
    },
    {
        "name": "advertiser_store_id",
        "displayName": "Advertiser Store ID",
        "description": "The store-specific identifier for an advertiser's app — a numeric ID on iOS (e.g. 123456789) or a package name on Android (e.g. com.example.game).",
        "dataType": ["STRING"],
        "complianceRules": "Numeric iTunes ID on iOS; package name on Android.",
    },
    {
        "name": "advertiser_store",
        "displayName": "Advertiser Store",
        "description": "The app store platform targeted by the advertiser's campaign. Possible values: apple, google.",
        "dataType": ["STRING"],
        "complianceRules": "",
        "allowedValues": "apple, google",
    },
    {
        "name": "advertiser_store_category",
        "displayName": "Advertiser Store Category",
        "description": "The primary category of the advertiser's app as listed in the app store.",
        "dataType": ["STRING"],
        "complianceRules": "Primary store category as returned by the app store (e.g. Games, Productivity).",
    },
    {
        "name": "advertiser_store_subcategory",
        "displayName": "Advertiser Store Subcategory",
        "description": "The sub-classification of the advertiser's app within its primary store category.",
        "dataType": ["STRING"],
        "complianceRules": "Sub-category as returned by the app store (e.g. Puzzle under Games).",
    },
    {
        "name": "advertiser_domain",
        "displayName": "Advertiser Domain",
        "description": "The registered domain of the advertiser.",
        "dataType": ["STRING"],
        "complianceRules": "Registered domain name (e.g. `unity.com`).",
    },
    {
        "name": "publisher_bundle_id",
        "displayName": "Publisher Bundle ID",
        "description": "The unique identifier for the publisher's app, in reverse domain format — e.g. com.example.game (Android) or com.example.app (iOS).",
        "dataType": ["STRING"],
        "complianceRules": "Reverse domain format (e.g. `com.example.game`).",
    },
    {
        "name": "publisher_store_id",
        "displayName": "Publisher Store ID",
        "description": "The store-specific identifier for the publisher's app — a numeric ID on iOS or a package name on Android.",
        "dataType": ["STRING"],
        "complianceRules": "Numeric iTunes ID on iOS; package name on Android.",
    },
    {
        "name": "publisher_store_category",
        "displayName": "Publisher Store Category",
        "description": "The primary category of the publisher's app as listed in the app store.",
        "dataType": ["STRING"],
        "complianceRules": "Primary store category as returned by the app store.",
    },
    {
        "name": "publisher_store_subcategory",
        "displayName": "Publisher Store Subcategory",
        "description": "The sub-classification of the publisher's app within its primary store category.",
        "dataType": ["STRING"],
        "complianceRules": "Sub-category as returned by the app store.",
    },
    {
        "name": "publisher_user_id",
        "displayName": "Publisher User ID",
        "description": "An identifier for the user as set by the publisher, used to link with the publisher's own records.",
        "dataType": ["STRING"],
        "complianceRules": "Publisher-defined user identifier.\n- **PII-adjacent** — handle per data access policy",
    },
    {
        "name": "idfa",
        "displayName": "IDFA",
        "description": "A device-level advertising identifier assigned by Apple (IDFA) or Google (GAID). Used for cross-app user tracking for advertising. Contains PII.",
        "dataType": ["STRING"],
        "complianceRules": "UUID v4 format, e.g. `550e8400-e29b-41d4-a716-446655440000`\n- IDFA on iOS; GAID on Android\n- Empty strings and all-zero UUIDs (`00000000-0000-0000-0000-000000000000`) must be normalized to `NULL`\n- **PII** — restricted access per data access policy",
    },
    {
        "name": "idfv",
        "displayName": "IDFV",
        "description": "A vendor-scoped device identifier (IDFV on iOS, App Set ID on Android). Stable across apps from the same vendor; resets when all apps from the vendor are uninstalled. Contains PII.",
        "dataType": ["STRING"],
        "complianceRules": "UUID (any version)\n- IDFV on iOS; App Set ID on Android\n- Empty strings and all-zero UUIDs must be normalized to `NULL`\n- **PII** — restricted access per data access policy",
    },
    {
        "name": "unity_gamer_id",
        "displayName": "Unity Gamer ID",
        "description": "Unity's universal identifier for a player across all Unity data products. Also known as ugid. Contains PII.",
        "dataType": ["STRING"],
        "complianceRules": "UUID v4 format, e.g. `550e8400-e29b-41d4-a716-446655440000`\n- Null when identity resolution is unavailable\n- **PII** — restricted access per data access policy",
        "synonyms": ["ugid"],
    },
    {
        "name": "idfa_gamer_id",
        "displayName": "IDFA Gamer ID",
        "description": "Unity's gamer identifier derived from the device advertising ID (IDFA/GAID). Contains PII.",
        "dataType": ["STRING"],
        "complianceRules": "MongoDB ObjectId — 24-character lowercase hex, e.g. `507f1f77bcf86cd799439011`\n- Null when restricted or unmatched\n- **PII** — restricted access per data access policy",
    },
    {
        "name": "idfi_gamer_id",
        "displayName": "IDFI Gamer ID",
        "description": "Unity's gamer identifier derived from the vendor-scoped device identifier (IDFV/ASID). Contains PII.",
        "dataType": ["STRING"],
        "complianceRules": "MongoDB ObjectId — 24-character lowercase hex, e.g. `507f1f77bcf86cd799439011`\n- Null when restricted or unmatched\n- **PII** — restricted access per data access policy",
    },
    {
        "name": "sdk_version",
        "displayName": "SDK Version",
        "description": "The version of the relevant SDK that generated or processed this event. Must be in semantic version format — e.g. 4.3.0. Integer encodings (e.g. 43000) are not permitted.",
        "dataType": ["STRING"],
        "complianceRules": "Semantic version in `MAJOR.MINOR.PATCH` format, e.g. `4.3.0`\n- Integer encodings (e.g. `43000`) are not permitted",
    },
    {
        "name": "application_version",
        "displayName": "Application Version",
        "description": "The version of the application where the event occurred.",
        "dataType": ["STRING"],
        "complianceRules": "Version string as reported by the application (e.g. 1.32, 2.6.35).",
    },
    {
        "name": "is_test",
        "displayName": "Is Test",
        "description": "Whether the event was generated as test traffic rather than real user activity.",
        "dataType": ["BOOL"],
        "complianceRules": "NOT NULL. true for test traffic; false for real traffic.",
    },
    {
        "name": "privacy_legal_framework",
        "displayName": "Privacy Legal Framework",
        "description": "The applicable privacy legal regime governing this event based on the user's geolocation. Examples: gdpr (EU), lgpd (Brazil), pipl (China), ccpa (California), none (no specific regime applies).",
        "dataType": ["STRING"],
        "complianceRules": "",
        "allowedValues": "ccpa, cpa, ctdpa, dpdpa, fdbr, gdpr, icdpa, incdpa, kcdpa, lgpd, mcdpa, mncdpa, modpa, ndpa, nhdpa, njdpa, none, ocpa, pipl, qclaw25, ridtppa, tdpsa, tipa, ucpa, vcdpa",
    },
    {
        "name": "privacy_restricted_user",
        "displayName": "Privacy Restricted User",
        "description": "Whether the user is subject to stricter data handling requirements, as determined by the producer in consultation with legal.",
        "dataType": ["BOOL"],
        "complianceRules": "- `true` — stricter handling applies (e.g. child-directed, regional restriction)\n- `null` — restriction status unknown",
    },
    {
        "name": "privacy_purposes_ads_aggregate_reporting",
        "displayName": "Privacy Purposes Ads Aggregate Reporting",
        "description": "Whether aggregated, non-personally identifiable data may be shared with third-party partners for reporting.",
        "dataType": ["BOOL"],
        "complianceRules": "- `true` — permitted\n- `false` — not permitted\n- `null` — unknown or not evaluated",
    },
    {
        "name": "privacy_purposes_ads_contextual",
        "displayName": "Privacy Purposes Ads Contextual",
        "description": "Whether data from the current session may be used to serve ads or make in-session decisions.",
        "dataType": ["BOOL"],
        "complianceRules": "- `true` — permitted\n- `false` — not permitted\n- `null` — unknown or not evaluated",
    },
    {
        "name": "privacy_purposes_ads_contextual_profiling",
        "displayName": "Privacy Purposes Ads Contextual Profiling",
        "description": "Whether data may be used to build a contextual, cross-session profile for ad targeting.",
        "dataType": ["BOOL"],
        "complianceRules": "- `true` — permitted\n- `false` — not permitted\n- `null` — unknown or not evaluated",
    },
    {
        "name": "privacy_purposes_ads_measure_performance",
        "displayName": "Privacy Purposes Ads Measure Performance",
        "description": "Whether data may be used to measure advertising campaign effectiveness.",
        "dataType": ["BOOL"],
        "complianceRules": "- `true` — permitted\n- `false` — not permitted\n- `null` — unknown or not evaluated",
    },
    {
        "name": "privacy_purposes_ads_personalized",
        "displayName": "Privacy Purposes Ads Personalized",
        "description": "Whether personalized ads may be served based on the user's profile.",
        "dataType": ["BOOL"],
        "complianceRules": "- `true` — permitted\n- `false` — not permitted\n- `null` — unknown or not evaluated",
    },
    {
        "name": "privacy_purposes_ads_personalized_profiling",
        "displayName": "Privacy Purposes Ads Personalized Profiling",
        "description": "Whether data may be used to build a detailed behavioral profile for personalized advertising.",
        "dataType": ["BOOL"],
        "complianceRules": "- `true` — permitted\n- `false` — not permitted\n- `null` — unknown or not evaluated",
    },
    {
        "name": "privacy_purposes_ads_product_improvement",
        "displayName": "Privacy Purposes Ads Product Improvement",
        "description": "Whether data may be used to improve Unity's advertising and monetization products.",
        "dataType": ["BOOL"],
        "complianceRules": "- `true` — permitted\n- `false` — not permitted\n- `null` — unknown or not evaluated",
    },
    {
        "name": "privacy_purposes_ads_transfer_data_outside_territory",
        "displayName": "Privacy Purposes Ads Transfer Data Outside Territory",
        "description": "Whether consent has been obtained to transfer the user's personal data outside their legal framework territory.",
        "dataType": ["BOOL"],
        "complianceRules": "- `true` — permitted\n- `false` — not permitted\n- `null` — unknown or not evaluated",
    },
    {
        "name": "device_language",
        "displayName": "Device Language",
        "description": "The primary language configured on the device. Expressed as an ISO 639-1 two-letter code — e.g. en (English), es (Spanish), zh (Chinese).",
        "dataType": ["STRING"],
        "complianceRules": "ISO 639-1 two-letter language code (e.g. `en`, `es`, `zh`). Null when unavailable.",
    },
    {
        "name": "device_manufacturer",
        "displayName": "Device Manufacturer",
        "description": "The manufacturer or brand of the device — e.g. apple, samsung, xiaomi.",
        "dataType": ["STRING"],
        "complianceRules": "Manufacturer name as reported by the device (e.g. `apple`, `samsung`, `xiaomi`).",
    },
    {
        "name": "device_model",
        "displayName": "Device Model",
        "description": "The commercial model name or identifier of the device — e.g. iPhone15,4 (iOS) or SM-A546E (Samsung Android).",
        "dataType": ["STRING"],
        "complianceRules": "Commercial model name as reported by the device (e.g. iPhone15,4, SM-A546E).",
    },
    {
        "name": "device_type",
        "displayName": "Device Type",
        "description": "The general category of the device. Possible values: phone, tablet, tv, console, computer.",
        "dataType": ["STRING"],
        "complianceRules": "",
        "allowedValues": "phone, tablet, tv, console, computer",
    },
    {
        "name": "device_os_version",
        "displayName": "Device OS Version",
        "description": "The version of the device's operating system. Format varies by platform: iOS uses dotted notation (e.g. 15.4); Android uses an integer (e.g. 13) or dotted version string.",
        "dataType": ["STRING"],
        "complianceRules": "**iOS:** dotted notation `x.x` or `x.x.x`\n- Examples: `15.4`, `15.4.1`\n- Trailing `.0` is invalid — use `15.4` not `15.4.0`\n\n**Android:** integer ≥ 9 (e.g. `13`) or a whitelisted Android version string",
    },
    {
        "name": "ad_format",
        "displayName": "Ad Format",
        "description": "The type of advertising unit shown to the user. Values: banner (static or animated image at screen edge), interstitial (full-screen ad between content), rewarded (user opts in to watch in exchange for an in-app reward), native (ad integrated into the app content flow).",
        "dataType": ["STRING"],
        "complianceRules": "- **Legacy:** `rewarded_video` → normalize to `rewarded` going forward\n- **Open question:** `mrec`, `app_open`, and `other` appear in some producer schemas but are not in the current compliance allowlist — requires governance resolution before use in L1",
        "allowedValues": "rewarded, interstitial, banner, native",
    },
    {
        "name": "dsp",
        "displayName": "DSP",
        "description": "A Demand-Side Platform — a system that allows advertisers to buy ad impressions programmatically across multiple exchanges and networks.",
        "dataType": ["STRING"],
        "complianceRules": "Lowercase DSP name. Null when no DSP is involved.\n\n- Open vocabulary — 66+ distinct values observed in production\n- Names may contain spaces (e.g. `outbrain dsp`, `inmobi dsp`)\n- Examples: `liftoff`, `molocoads`, `ttd`, `yandex`, `kayzen`, `mintegral`\n- Do not maintain a fixed enum; new DSP names are added as they onboard",
    },
    {
        "name": "campaign_payment_model",
        "displayName": "Campaign Payment Model",
        "description": "The billing model for an advertising campaign. CPI (cost per install): charged when a user installs the app. CPM (cost per mille): charged per 1,000 impressions. CPE (cost per event): charged when a user completes a specified in-app action.",
        "dataType": ["STRING"],
        "complianceRules": "Null for organic or unattributed events. Predominantly null in conversion events — payment model lives on the campaign, not the event.",
        "allowedValues": "cpi, cpm, cpe",
    },
    {
        "name": "ios_att_status",
        "displayName": "iOS ATT Status",
        "description": "The App Tracking Transparency (ATT) consent status on iOS, indicating whether the user has authorized cross-app tracking. ATT was introduced in iOS 14.5.",
        "dataType": ["STRING"],
        "complianceRules": "Cross-field conditional enforcement:\n- `platform != ios` → must be `NULL`\n- `platform = ios` and `device_os_version_major < 14` → must be `not_applicable`\n- `platform = ios` and `device_os_version_major >= 14` → one of:\n  - `authorized` — user granted permission\n  - `denied` — user explicitly denied\n  - `restricted` — device policy (e.g. MDM)\n  - `not_determined` — ATT prompt not yet shown",
        "allowedValues": "authorized, denied, not_determined, restricted, not_applicable",
    },
    # Moved from Attribution
    {
        "name": "is_reinstall",
        "displayName": "Is Reinstall",
        "description": "Whether the event represents a user reinstalling a previously installed app.",
        "dataType": ["BOOL"],
        "complianceRules": "true = reinstall event. Null when not applicable.",
    },
    {
        "name": "reinstall_time",
        "displayName": "Reinstall Time",
        "description": "The timestamp of the reinstall event received from the attribution partner.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "UTC timestamp. Null for non-reinstall events.",
    },
    # New additions
    {
        "name": "auction_start_time",
        "displayName": "Auction Start Time",
        "description": "The timestamp when the ad auction began.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "UTC timestamp. Null when not captured by the producer.",
    },
    {
        "name": "auction_end_time",
        "displayName": "Auction End Time",
        "description": "The timestamp when the ad auction completed.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "UTC timestamp. Null when not captured by the producer. Must be >= auction_start_time when both are present.",
    },
    {
        "name": "campaign_optimization_type",
        "displayName": "Campaign Optimization Type",
        "description": "The optimization goal for the advertising campaign — what outcome the campaign is configured to maximize (e.g. installs, in-app events, ROAS).",
        "dataType": ["STRING"],
        "complianceRules": "Lowercase where applicable. Open vocabulary — values vary by demand-side platform and campaign configuration.",
    },
    {
        "name": "device",
        "displayName": "Device",
        "description": "The device on which the event occurred. Encompasses hardware specifications, operating system, and configuration signals. Not a column — use specific device_* fields for individual signals.",
    },
    {
        "name": "device_ip",
        "displayName": "Device IP",
        "description": "The IP address of the device recorded at ingestion. Contains PII — access governed by data policy.",
        "dataType": ["STRING"],
        "complianceRules": "- **PII** — access restricted per data access policy\n- Null when not captured or redacted by the ingestion layer",
    },
    {
        "name": "device_orientation",
        "displayName": "Device Orientation",
        "description": "The physical orientation of the device display when the event was recorded.",
        "dataType": ["STRING"],
        "complianceRules": "",
        "allowedValues": "landscape, portrait",
    },
    {
        "name": "is_anonymous_ip",
        "displayName": "Is Anonymous IP",
        "description": "Whether the device IP is identified as anonymous — e.g. VPN, Tor exit node, or open proxy.",
        "dataType": ["BOOL"],
        "complianceRules": "true = IP identified as anonymous. Null when IP anonymity cannot be determined (e.g. IP not captured).",
    },
    {
        "name": "is_bidding",
        "displayName": "Is Bidding",
        "description": "Whether the ad impression was served via real-time bidding as opposed to waterfall or direct demand.",
        "dataType": ["BOOL"],
        "complianceRules": "true = served via real-time bidding. false = waterfall or direct demand. Null when demand type is unknown.",
    },
    {
        "name": "is_first_session",
        "displayName": "Is First Session",
        "description": "Whether this event occurred during the user's first session since install.",
        "dataType": ["BOOL"],
        "complianceRules": "true = event occurred in first session since install. Null when session history is unavailable.",
    },
    {
        "name": "list_of_idfi_gamer_ids",
        "displayName": "List Of IDFI Gamer IDs",
        "description": "A list of Unity gamer IDs derived from the vendor-scoped device identifier (IDFV/ASID), representing multiple identity candidates for this event. Used in identity mesh resolution. Contains PII.",
        "dataType": ["ARRAY"],
        "complianceRules": "Each element is a MongoDB ObjectId — 24-character lowercase hex, e.g. `507f1f77bcf86cd799439011`\n- Empty array must be normalized to `NULL`\n- **PII** — access restricted per data access policy",
    },
    {
        "name": "screen_height",
        "displayName": "Screen Height",
        "description": "The display height of the device screen in pixels.",
        "dataType": ["INT64"],
        "complianceRules": "Pixels as reported by the device. Null when unavailable.",
    },
    {
        "name": "screen_width",
        "displayName": "Screen Width",
        "description": "The display width of the device screen in pixels.",
        "dataType": ["INT64"],
        "complianceRules": "Pixels as reported by the device. Null when unavailable.",
    },
    # Promoted from EngineData Drop
    {
        "name": "android_api_level",
        "displayName": "Android API Level",
        "description": "The Android API level of the device's operating system. Null when the platform is not Android.",
        "dataType": ["INT64"],
        "complianceRules": "Integer ≥ 1. Null when platform is not Android.\n\n**Cross-field rule:** must be `NULL` for iOS and all non-Android platforms.",
    },
    {
        "name": "device_locale",
        "displayName": "Device Locale",
        "description": "The full locale string including region and optional script — e.g. en_US, zh_Hans_CN. Finer-grained than device_language.",
        "dataType": ["STRING"],
        "complianceRules": "BCP 47 / IETF locale format (e.g. en_US, zh_Hans_CN). Null when unavailable.",
    },
    {
        "name": "city",
        "displayName": "City",
        "description": "City-level geolocation associated with the device at ingestion. Semantics and precision depend on gateway and geolocation configuration.",
        "dataType": ["STRING"],
        "complianceRules": "City name or opaque token depending on gateway configuration. Null when geolocation is unavailable or city-level precision is not captured.",
    },
    {
        "name": "region",
        "displayName": "Region",
        "description": "The first-level administrative subdivision (state or province) associated with the device at ingestion — e.g. CA (California), BY (Bavaria).",
        "dataType": ["STRING"],
        "complianceRules": "ISO 3166-2 subdivision code where available (e.g. US-CA, DE-BY). Null when unavailable.",
        "synonyms": ["subdivision"],
    },
    {
        "name": "unity_editor_version",
        "displayName": "Unity Editor Version",
        "description": "The version of the Unity Editor used to produce the player build — e.g. 2022.3.45f1.",
        "dataType": ["STRING"],
        "complianceRules": "Version string in Unity format (e.g. 2022.3.45f1). Null when not available.",
    },
    # ── Core Schema Only ──────────────────────────────────────────────────────
    {
        "name": "partition_date",
        "displayName": "Partition Date",
        "description": "Calendar date of the event used for table partitioning. Always include in WHERE filters to limit scan range and control query cost.",
        "dataType": ["DATE"],
        "complianceRules": "NOT NULL. Derived from `event_time` in `YYYY-MM-DD` format.\n\n**Important:** Always include in `WHERE` clause filters to limit partition scan and control query cost.",
    },
    {
        "name": "partition_hour",
        "displayName": "Partition Hour",
        "description": "Hour of day (0–23) of the event, used alongside partition_date for sub-daily partitioning and time-based filtering.",
        "dataType": ["INT64"],
        "complianceRules": "NOT NULL. Integer in range `0`–`23`. Derived from `event_time`.\nUse with `partition_date` for sub-daily time-slice filtering.",
    },
    {
        "name": "sdk_version_major",
        "displayName": "SDK Version Major",
        "description": "The major version component extracted from sdk_version — e.g. 4 from 4.3.43.",
        "dataType": ["STRING"],
        "complianceRules": "Derived from sdk_version. String representation of major integer (e.g. '4'). Null when sdk_version is null.",
    },
    {
        "name": "device_os_version_major",
        "displayName": "Device OS Version Major",
        "description": "The major version component extracted from device_os_version. Used for platform-level compatibility filtering.",
        "dataType": ["STRING"],
        "complianceRules": "Derived from device_os_version. String representation of major integer (e.g. '15' for iOS 15.4). Null when device_os_version is null.",
    },
    {
        "name": "advertiser_game_id",
        "displayName": "Advertiser Game ID",
        "description": "Legacy Unity Ads advertiser game identifier. Retained for backwards compatibility with older pipeline integrations.",
        "dataType": ["STRING"],
        "complianceRules": "Legacy field — retained for backwards compatibility only. Prefer campaign_id or advertiser_store_id for new integrations.",
    },
    {
        "name": "advertiser_organization_id",
        "displayName": "Advertiser Organization ID",
        "description": "The advertiser's Genesis organization identifier.",
        "dataType": ["STRING"],
        "complianceRules": "Nullable. Genesis organization ID.",
    },
    {
        "name": "experiment_tracking_token",
        "displayName": "Experiment Tracking Token",
        "description": "An opaque token encoding the experimental treatment assignments applied to this event.",
        "dataType": ["STRING"],
        "complianceRules": "Opaque token. Null when no experiment assignment applies to this event.",
    },
    {
        "name": "valuation_id",
        "displayName": "Valuation ID",
        "description": "Unique identifier for the direct demand valuation. Multiple auctions may share a valuation ID when valuation is cached.",
        "dataType": ["STRING"],
        "complianceRules": "Nullable. Multiple auctions may share a valuation ID when valuation is cached.",
    },
    {
        "name": "creative_orientation",
        "displayName": "Creative Orientation",
        "description": "The orientation of the ad creative asset — landscape or portrait.",
        "dataType": ["STRING"],
        "complianceRules": "",
        "allowedValues": "landscape, portrait",
    },
    {
        "name": "screen_density_category",
        "displayName": "Screen Density Category",
        "description": "Bucketed display density category derived from the device's reported DPI.",
        "dataType": ["STRING"],
        "complianceRules": "",
        "allowedValues": "ldpi, mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi",
    },
    {
        "name": "privacy_method",
        "displayName": "Privacy Method",
        "description": "The mechanism by which privacy consent was determined for this event.",
        "dataType": ["STRING"],
        "complianceRules": "",
        "allowedValues": "developer_consent, default, unity_consent, legitimate_interest",
    },
    {
        "name": "ios_att_status_code",
        "displayName": "iOS ATT Status Code",
        "description": "Numeric code paired with ios_att_status. Must co-exist with the ios_att_status string column in the same table.",
        "dataType": ["INT64"],
        "complianceRules": "Must co-exist with `ios_att_status` string column (L1 Schema Validation).\n\nCompliance-standardized mapping:\n- `0` — `not_determined`\n- `1` — `restricted`\n- `2` — `denied`\n- `3` — `authorized`\n\nWhen `ios_att_status = not_applicable`, this field must be `NULL`.",
        "allowedValues": "0 (not_determined), 1 (restricted), 2 (denied), 3 (authorized)",
    },
    # ── Core Glossary Only ────────────────────────────────────────────────────
    {
        "name": "ad_network",
        "displayName": "Ad Network",
        "description": "The ad network or demand source that provided the advertisement. Open vocabulary — implementation and naming vary across producers and integrations.",
    },
    {
        "name": "user_ad_ltv",
        "displayName": "User Ad LTV",
        "description": "The cumulative ad revenue attributed to a specific device since its first session, reflecting the long-term monetization value of that user through advertising. Calculation methodology varies by domain.",
    },
]

# ─── [TEST] Attribution terms ─────────────────────────────────────────────────

ATTRIBUTION_TERMS = [
    {
        "name": "attribution_partner",
        "displayName": "Attribution Partner",
        "description": "The Mobile Measurement Partner (MMP) configured to handle attribution for an advertiser's campaigns — e.g. AppsFlyer, Adjust, Singular.",
        "dataType": ["STRING"],
        "complianceRules": "Open vocabulary — new MMPs may be added as integrations are built.",
        "synonyms": ["MMP", "Mobile Measurement Partner"],
    },
    {
        "name": "attribution_match_type",
        "displayName": "Attribution Match Type",
        "description": "The method used to match a conversion to an ad exposure — e.g. deterministic, probabilistic.",
        "dataType": ["STRING"],
        "complianceRules": "Open vocabulary — new MMP-specific values may appear. Null for organic or unattributed events.",
    },
    {
        "name": "attribution_touch_type",
        "displayName": "Attribution Touch Type",
        "description": "The type of ad interaction — impression or click — that served as the basis for attribution.",
        "dataType": ["STRING"],
        "complianceRules": "",
        "allowedValues": "click, impression",
    },
    {
        "name": "attribution_type",
        "displayName": "Attribution Type",
        "description": "The scope of attribution — whether it is user-level or non-user-level.",
        "dataType": ["STRING"],
        "complianceRules": "Null when unset. High null rate is expected.",
        "allowedValues": "ATTRIBUTION_TYPE_USER_LEVEL, ATTRIBUTION_TYPE_NON_USER_LEVEL, ATTRIBUTION_TYPE_UNSPECIFIED",
    },
    {
        "name": "attribution_id",
        "displayName": "Attribution ID",
        "description": "A unique identifier created for each attribution event, used as a lookup key in attribution processing services. Generated by mz-attribution-id-store.",
        "dataType": ["STRING"],
        "complianceRules": "Generated by mz-attribution-id-store. Stored inside the gamer ID token.",
    },
    {
        "name": "attribution_click_time",
        "displayName": "Attribution Click Time",
        "description": "The timestamp of the click received from the attribution partner that was used to attribute the event.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "UTC timestamp. Null for view-through attribution events.",
    },
    {
        "name": "attribution_impression_time",
        "displayName": "Attribution Impression Time",
        "description": "The timestamp of the impression received from the attribution partner that was used to attribute the event.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "UTC timestamp. Null for click-through attribution events.",
    },
    {
        "name": "is_attributed",
        "displayName": "Is Attributed",
        "description": "Whether the event was attributed to Unity by the attribution partner.",
        "dataType": ["BOOL"],
        "complianceRules": "true = attributed to Unity; false = not attributed.",
    },
    {
        "name": "is_organic",
        "displayName": "Is Organic",
        "description": "Whether the user was not attributed to any paid advertisement — came through organic discovery.",
        "dataType": ["BOOL"],
        "complianceRules": "true = organic (no paid attribution).",
    },
    {
        "name": "is_reattributed",
        "displayName": "Is Reattributed",
        "description": "Whether the event was reattributed to a new source by the attribution partner.",
        "dataType": ["BOOL"],
        "complianceRules": "true = reattributed. Null when not applicable.",
    },
    {
        "name": "is_reengagement",
        "displayName": "Is Reengagement",
        "description": "Whether the event follows from a re-engagement campaign after a period of user inactivity.",
        "dataType": ["BOOL"],
        "complianceRules": "true = re-engagement event.",
    },
    {
        "name": "is_suppressed",
        "displayName": "Is Suppressed",
        "description": "Whether the event is flagged as suppressed by Unity's internal team for negative ad targeting purposes.",
        "dataType": ["BOOL"],
        "complianceRules": "true = suppressed. Used for preventing showing ads of a game to specific users via negative targeting.",
    },
    {
        "name": "is_blocklisted",
        "displayName": "Is Blocklisted",
        "description": "Whether the advertiser's store ID is on Unity's internal blocklist.",
        "dataType": ["BOOL"],
        "complianceRules": "true = blocklisted store ID.",
    },
    {
        "name": "reattribution_time",
        "displayName": "Reattribution Time",
        "description": "The timestamp of the reattribution event received from the attribution partner.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "UTC timestamp. Null for non-reattribution events.",
    },
    {
        "name": "reengagement_time",
        "displayName": "Reengagement Time",
        "description": "The timestamp of the re-engagement event.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "UTC timestamp. Null for non-re-engagement events.",
    },
]

# ─── [TEST] LevelPlay terms ───────────────────────────────────────────────────

LEVELPLAY_TERMS = [
    {
        "name": "bid_price",
        "displayName": "Bid Price",
        "description": "The monetary value of a bid in USD, calculated as bid eCPM divided by 1000.",
        "dataType": ["FLOAT64"],
        "complianceRules": "Value in USD. Derived as bid_price_ecpm / 1000.",
    },
    {
        "name": "bid_price_ecpm",
        "displayName": "Bid Price eCPM",
        "description": "The eCPM (effective cost per thousand impressions) offered by an ad network in an auction. For bidding auctions, this is the live bid value; for non-bidding or direct deals, it is the fixed rate.",
        "dataType": ["FLOAT64"],
        "complianceRules": "Value in USD per 1000 impressions. Null when no bid was returned.",
    },
    {
        "name": "floor_price",
        "displayName": "Floor Price",
        "description": "The minimum bid price a publisher requires for an ad impression to be eligible to serve.",
        "dataType": ["FLOAT64"],
        "complianceRules": "Value in USD. Null when no floor is configured.",
    },
    {
        "name": "bid_requests_count",
        "displayName": "Bid Requests Count",
        "description": "The total number of bid requests sent to ad networks during a single ad auction.",
        "dataType": ["INT64"],
        "complianceRules": "Non-negative integer. Null when auction data is unavailable.",
    },
    {
        "name": "bid_responses_count",
        "displayName": "Bid Responses Count",
        "description": "The total number of valid bid responses returned to the SDK as part of the auction waterfall.",
        "dataType": ["INT64"],
        "complianceRules": "Non-negative integer. Must be <= bid_requests_count. Null when auction data is unavailable.",
    },
    {
        "name": "lp_ad_unit_name",
        "displayName": "LevelPlay Ad Unit Name",
        "description": "A named waterfall configuration within the LevelPlay mediation platform. An ad unit groups a set of ad network instances and their priority order for a specific ad format in a publisher's app.",
        "dataType": ["STRING"],
        "complianceRules": "Publisher-defined name. Null when not applicable.",
    },
    {
        "name": "lp_group_name",
        "displayName": "LevelPlay Group Name",
        "description": "A publisher-defined mediation group within LevelPlay that applies a specific waterfall to a subset of users or countries. Null means the default 'all countries' group applies.",
        "dataType": ["STRING"],
        "complianceRules": "Publisher-defined name. Null = default all-countries group applies.",
    },
    {
        "name": "ironsource_demand_source",
        "displayName": "ironSource Demand Source",
        "description": "Which ironSource internal demand type served the ad. Null when the winning bid came from an external network rather than ironSource demand.",
        "dataType": ["STRING"],
        "complianceRules": "Null when winning bid came from an external network.",
        "allowedValues": "ironsource, isx, cross promotion, direct deals",
    },
    {
        "name": "is_auction_winner",
        "displayName": "Is Auction Winner",
        "description": "Whether this impression event represents the bid that won the mediation auction and was ultimately shown to the user. In LevelPlay's waterfall model, multiple networks are tried in rank order.",
        "dataType": ["BOOL"],
        "complianceRules": "true = this network's bid was accepted and the ad was served.",
    },
    {
        "name": "auid",
        "displayName": "AUID",
        "description": "The Application User ID — a publisher-defined identifier for a user within their app, as passed to the LevelPlay SDK. Used to link LevelPlay impression data back to the publisher's own user records. Contains PII.",
        "dataType": ["STRING"],
        "complianceRules": "Publisher-defined identifier.\n- Empty or all-zero values must be normalized to `NULL`\n- **PII** — access governed by data access policy",
        "synonyms": ["Application User ID"],
    },
]

# ─── [TEST] EngineData terms ──────────────────────────────────────────────────

ENGINEDATA_TERMS = [
    {
        "name": "ads_intent",
        "displayName": "Ads Intent",
        "description": "End-user preference or consent signal for advertising-related processing on this event, specific to the EngineData pipeline. Distinct from the privacy_purposes_* fields, which represent Unity's evaluated legal basis — ads_intent reflects what the user directly expressed.",
        "dataType": ["BOOL"],
        "complianceRules": "EngineData-specific field. Do not conflate with privacy_purposes_* fields.",
    },
    {
        "name": "analytics_intent",
        "displayName": "Analytics Intent",
        "description": "End-user preference or consent signal for analytics-related processing on this event, specific to the EngineData pipeline. See ads_intent for the distinction from privacy_purposes_* fields.",
        "dataType": ["BOOL"],
        "complianceRules": "EngineData-specific field. Do not conflate with privacy_purposes_* fields.",
    },
    {
        "name": "application_mega_session_id",
        "displayName": "Application Mega Session ID",
        "description": "A session identifier spanning the full lifetime of an application process — from launch to process termination. A single mega session encompasses all foreground and background activity in one continuous run.",
        "dataType": ["STRING"],
        "complianceRules": "Unique per application process lifetime. Resets on each new app launch.",
    },
    {
        "name": "foreground_session_id",
        "displayName": "Foreground Session ID",
        "description": "A session identifier covering a single period of active foreground use. Resets each time the app moves to the foreground. Finer-grained than application_mega_session_id.",
        "dataType": ["STRING"],
        "complianceRules": "Resets each time app moves to foreground. More granular than application_mega_session_id.",
    },
    {
        "name": "event_time_corrected",
        "displayName": "Event Time Corrected",
        "description": "The event timestamp adjusted for measured device clock skew. Prefer over event_time when comparing events across devices or measuring latency, because device clocks may drift significantly from wall time. The correction magnitude is available in server_time_delta.",
        "dataType": ["TIMESTAMP"],
        "complianceRules": "UTC timestamp. Derived from event_time adjusted by server_time_delta. Null when clock correction is unavailable.",
    },
    {
        "name": "severity_text",
        "displayName": "Severity Text",
        "description": "The log severity level of the event as a human-readable label. Used to filter diagnostic events by urgency.",
        "dataType": ["STRING"],
        "complianceRules": "Open vocabulary — additional values may exist per the OpenTelemetry specification.",
        "allowedValues": "FATAL, ERROR, WARN, INFO, DEBUG",
    },
    {
        "name": "error_message",
        "displayName": "Error Message",
        "description": "The error or crash body text captured when a diagnostic event (crash, ANR, exception) occurs. Null for non-error events. Primary field for root cause triage in diagnostic analysis.",
        "dataType": ["STRING"],
        "complianceRules": "Null for non-error events. May contain stack traces or exception messages.\n\n**PII risk:** may contain user-generated content in the crash context — handle with care.",
    },
    {
        "name": "scene_name",
        "displayName": "Scene Name",
        "description": "The human-readable name of the Unity scene that was active when the event occurred. A Unity scene is the logical grouping of game objects and assets representing one game level, screen, or state.",
        "dataType": ["STRING"],
        "complianceRules": "Developer-defined scene name. Null when no scene is active or scene name is unavailable.",
    },
]

# ── Term map ──────────────────────────────────────────────────────────────────

TERM_MAP = {
    "[TEST] Core":        CORE_TERMS,
    "[TEST] Attribution": ATTRIBUTION_TERMS,
    "[TEST] LevelPlay":   LEVELPLAY_TERMS,
    "[TEST] EngineData":  ENGINEDATA_TERMS,
}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("=== Creating [TEST] Collate glossaries ===\n")

    glossary_ids: dict[str, str] = {}
    for name, desc in GLOSSARY_DEFS:
        gid = ensure_glossary(name, desc)
        if gid:
            glossary_ids[name] = gid
        time.sleep(0.3)

    print()
    total_ok = 0
    total_fail = 0

    for gl_name, terms in TERM_MAP.items():
        if gl_name not in glossary_ids:
            print(f"SKIP {gl_name} — no glossary ID")
            continue
        print(f"\n── {gl_name} ({len(terms)} terms) ──")
        for t in terms:
            ok = create_term(gl_name, t)
            if ok:
                total_ok += 1
            else:
                total_fail += 1
            time.sleep(0.4)

    print(f"\n=== Done: {total_ok} OK, {total_fail} failed ===")


if __name__ == "__main__":
    main()
