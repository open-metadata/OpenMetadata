# Shipping Collate / OpenMetadata releases through CloudFront

Each customer gets a Collate deployment at their own host —
`acme.getcolate.io`, `widgets.getcolate.io`, `globex.getcolate.io` — and each customer can
be on a different release. This is the AWS-only design for serving the UI bundle from
CloudFront in that model, and the coordination story when a request lands at one of those
hosts.

## What we want

- **One CloudFront distribution** for every customer (not one per customer).
- **One S3 bucket** for every release. Releases are immutable; promotion is a separate
  step from upload.
- **Per-customer version pinning** that updates atomically — no DNS change, no CloudFront
  redeploy.
- **Customer's own ALB** continues to serve `/api/*`; CloudFront only handles the UI bundle.

## What we explicitly do NOT want

- A new external data store to maintain (DynamoDB, an extra RDS, a separate Redis). The
  customer-version mapping is small (a few hundred entries, two tiny strings each) and
  changes rarely (a few writes per week, even at peak). Standing up a data store for that
  buys nothing and adds backup, monitoring, IAM, and cost surface.
- Per-customer CloudFront distributions. They give clean isolation but at N customers we
  have N distributions to manage, N caches that share no edge state across customers, and
  hit the AWS 200-distributions-per-account cap by default. The savings from edge cache
  sharing (a thousand customers on v1.12.0 hit the same cached chunk) are the entire
  reason the shared model is worth using.
- A lookup that requires Lambda@Edge. The cold start and per-request cost is real
  ($1+/M, plus 30-60 ms when cold) and we don't need the SDK access Lambda@Edge gives.

## The architecture

```
                                ┌──────────────────────────────────────┐
acme.getcolate.io     ───┐      │  CloudFront distribution             │
widgets.getcolate.io  ───┼─────►│  d1234abc.cloudfront.net              │
globex.getcolate.io   ───┘      │                                      │
                                │  ┌─ behavior: /* ──────────────────┐ │
                                │  │  origin: S3                      │ │     ┌─────────────────────────────┐
                                │  │  viewer-request: host_router.js  │─┼────►│  S3: collate-cdn            │
                                │  │   rewrites /foo →                │ │     │   release/v1.11.2/index.html │
                                │  │   /release/<version>/foo         │ │     │   release/v1.12.0/index.html │
                                │  └──────────────────────────────────┘ │     │   release/v1.13.0-beta/...   │
                                │                                      │     └─────────────────────────────┘
                                │  ┌─ behavior: /api/* ──────────────┐ │
                                │  │  bypass: same host's per-       │ │     ┌─────────────────────────────┐
                                │  │  customer ALB (Option A below)  │─┼────►│  Each customer's own ALB     │
                                │  └──────────────────────────────────┘ │     └─────────────────────────────┘
                                └──────────────────────────────────────┘
```

The CloudFront Function holds the customer→version routing table **as JavaScript object
literal**. Source of truth is the Function's source code in our git repo. Promotion is
a Function code update.

## The Function (no external lookup)

```js
// host_router.js — CloudFront Function v2.0 (no Lambda@Edge, no KVS, no DynamoDB)
//
// Source of truth for which release each customer is pinned to. Edit, commit, deploy.
// CI propagates a change to every edge POP in ~60 s.

const CUSTOMER_VERSIONS = {
  acme:    'v1.12.0',
  widgets: 'v1.11.2',
  globex:  'v1.13.0-beta',
  // … N customers
};

// Hosts that don't match a customer slug (apex, www., staging) fall back to the latest
// stable release. Bump this in lockstep with every GA release so new customers that
// haven't been added to CUSTOMER_VERSIONS yet still get a current build.
const DEFAULT_VERSION = 'v1.12.0';

function handler(event) {
    const request = event.request;

    // /api/* lives on a separate behavior with the customer's own ALB as origin.
    // The Function should never see these requests under the current behavior config,
    // but guard anyway.
    if (request.uri.startsWith('/api/')) {
        return request;
    }

    const host = (request.headers.host && request.headers.host.value) || '';
    // Convention: customer slug is the first label of the host.
    // acme.getcolate.io -> 'acme'
    const slug = host.split('.')[0];
    const version = CUSTOMER_VERSIONS[slug] || DEFAULT_VERSION;

    // /assets/foo.js -> /release/v1.12.0/assets/foo.js
    request.uri = '/release/' + version + request.uri;
    return request;
}
```

Function v2.0 has a 10 KB code limit. At ~30 bytes per entry that's ~300 customers
comfortably; well beyond that the design needs revisiting — but if you ever reach 300+
customers on this product, the operational economics of standing up KVS or DynamoDB
will have shifted significantly anyway.

## Promotion flow

1. Edit `CUSTOMER_VERSIONS` in the Function source.
2. Commit, push, open PR. The PR diff IS the promotion record — reviewable, auditable,
   git-blame'd.
3. CI runs on merge: pushes the new Function code via `aws cloudfront update-function`
   and `publish-function`.
4. ~60 s of edge propagation. Every POP picks up the new code.

A typical promotion PR looks like one line changed:

```diff
 const CUSTOMER_VERSIONS = {
-  acme:    'v1.12.0',
+  acme:    'v1.12.1',
   widgets: 'v1.11.2',
   globex:  'v1.13.0-beta',
 };
```

That's the entire surface area of a promotion. No DynamoDB write. No KVS API call. No
extra IAM role. No backup story. Just a code change reviewed like any other.

Rollback is symmetric: revert the commit. Canary is "promote one slug first, watch error
metrics, then PR the next batch." Roll-forward on a regression is the same revert.

### Release upload (independent of promotion)

The bundle bytes go to S3 separately, on every release tag, regardless of which customer
ends up using them:

```bash
VERSION="v1.12.0"
aws s3 sync openmetadata-ui/src/main/resources/ui/dist/assets/ \
    s3://collate-cdn/release/${VERSION}/assets/ \
    --cache-control "public, max-age=31536000, immutable"

aws s3 cp openmetadata-ui/src/main/resources/ui/dist/index.html \
    s3://collate-cdn/release/${VERSION}/index.html \
    --cache-control "no-cache, must-revalidate" \
    --content-type "text/html; charset=utf-8"
```

After this, the release exists in S3 but no customer is using it. Promotion (the PR
above) is what flips customers to it. The decoupling matters: you can sit on a release
in S3 for a week, watching it on staging, before promoting any customer to it.

## Why the Function code is a fine routing table

Honest comparison of the three approaches:

| | Function-embedded (this design) | CloudFront KeyValueStore | DynamoDB + Lambda@Edge |
|---|---|---|---|
| New AWS service to monitor / back up | none | KVS | DynamoDB + Lambda |
| Read latency at edge | ~0 (in-function) | ~1 ms | ~10 ms (warm Lambda) |
| Cold start | none | none | 30-60 ms |
| Per-request cost | $0.10/M Function | $0.10/M Function + $0.04/M KVS | $0.10/M + $1+/M Lambda + DynamoDB reads |
| Promotion surface | git PR | API call (`put-key`) | API call (`update-item`) |
| Audit trail | git history | CloudWatch + KVS audit logs | CloudWatch + DDB streams |
| Capacity ceiling | ~300 customers (10 KB code limit) | millions | millions |
| Concurrent promotion safety | git merge serializes | `IfMatch` ETag | conditional writes |
| Operational ownership | "this is in the repo" | "who paged on this last quarter?" | "who paged on this last quarter?" |

For a product that ships per-customer clusters and reaches dozens-to-low-hundreds of
customers, "the routing table is a file in the repo" wins on every operational axis that
matters. It only loses on capacity ceiling, and the day that becomes a problem we already
have a clear migration target (KVS) without changing anything else in the design.

## API routing — two options, pick one

The Function above only handles UI bundle requests. `/api/*` still has to reach the
customer's own ALB.

### Option A — Separate API host (recommended)

```
acme.getcolate.io      → CNAME → CloudFront distribution (this design)
api-acme.getcolate.io  → CNAME → acme's ALB
```

SPA's API base URL is derived from the page host at runtime: `https://api-{slug}.getcolate.io/api`.

Pros: CloudFront does one thing well (static delivery). No Lambda@Edge anywhere. Failure
modes are easy to reason about. Cons: SPA has a cookie/CORS story that knows about two
hosts; we already handle this for various integrations.

### Option B — Same host, Lambda@Edge for `/api/*`

CloudFront's `/api/*` behavior runs a Lambda@Edge on origin-request that reads the host
header and rewrites the origin to the right ALB.

Pros: single host per customer. Cons: now we DO have Lambda@Edge (which we explicitly
chose to avoid for routing), and the operational cost is per-customer-API-request, not
just per-promotion. We strongly prefer Option A.

## S3 bucket layout

```
collate-cdn/
└── release/
    ├── v1.11.5/
    │   ├── index.html                         no-cache, must-revalidate
    │   ├── assets/index-Z3O_FBkA.js           immutable
    │   ├── assets/index-Z3O_FBkA.js.br        immutable
    │   ├── assets/index-Z3O_FBkA.js.gz        immutable
    │   ├── assets/vendor-antd-BgrjOjhB.js     immutable
    │   └── ...
    ├── v1.12.0/        ← acme + widgets currently here
    │   └── ...
    └── v1.13.0-beta/   ← globex currently here (canary)
        └── ...
```

Releases are immutable once uploaded. The promotion step never modifies S3 contents —
only the Function code that maps `slug → /release/<v>/`.

Disk cost is small: a typical OM bundle is ~12 MB on disk after content-hash dedup,
Brotli+gzip siblings add ~25%, call it 15 MB per release. 100 releases × 15 MB =
1.5 GB. S3 standard rates put that at a few cents per month — keep many releases live
for instant rollback and don't bother with aggressive lifecycle pruning.

## CloudFront cache behaviors

| Path pattern (after Function rewrite) | Edge TTL | Notes |
|---|---|---|
| `/release/<v>/assets/*` | 1 year | Content-addressed; bytes can't change |
| `/release/<v>/index.html`, `/release/<v>/` | 30 s | Concurrent users in one region share one origin hit; ETag layer takes over after 30 s |
| `/api/*` | bypass | Separate behavior to customer ALB (Option A: not via CloudFront at all) |

30 s on the shell is the sweet spot: long enough to dedupe a thousand concurrent reloads
to one origin fetch, short enough that a promotion lands at all customers within ~90 s
end-to-end (60 s Function propagation + 30 s residual edge cache).

## Per-customer branding (without per-customer bundles)

If a customer needs a different logo or accent colour, the right move is to keep one
universal bundle and overlay branding assets at request time:

- Universal default: `/release/v1.12.0/images/logo.png` in S3.
- Per-customer override (optional, only when needed): the Function checks for
  `s3://collate-cdn/customer-overrides/<slug>/logo.png` first and rewrites if it exists.

Branding stays out of the build artifact, which means one bundle still serves every
customer and the cache-sharing argument holds.

## Verification after promotion

Two synthetic checks worth running automatically after a promotion PR merges:

```bash
SLUG=acme
EXPECTED_VERSION=v1.12.0

# 1. CloudFront serves the right release for this slug
RESPONSE=$(curl -s "https://${SLUG}.getcolate.io/?nocache=$(uuidgen)")
echo "$RESPONSE" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | sort -u
# Should match the hash from the v1.12.0 build manifest

# 2. The HTML shell is being served fresh from the right S3 prefix
curl -sI "https://${SLUG}.getcolate.io/" \
  | grep -i 'x-amz-cf-pop\|via\|x-cache'
# Should show an edge POP near the test runner, and either "Miss from cloudfront"
# (first request after promotion) or "Hit from cloudfront" (within the 30 s edge TTL)
```

CI runs this on every promotion PR after the Function deploys, and fails loud if the
served bundle doesn't match the version we just pinned.

## What's not in this design

- **Per-customer API origin selection inside CloudFront**. Option A keeps `/api/*` off
  the CloudFront path entirely. If a customer ever needs single-host behavior, that's
  the moment to revisit Option B and accept Lambda@Edge.
- **Multi-region S3 origin failover**. Single bucket in one region; CloudFront's edge
  caching handles regional reach. If you want CRR + origin groups, add them; the cost
  is straightforward but rarely justified for a UI bundle.
- **WAF / Shield Advanced**. Add separately if your security posture requires them.

## What this design is good for and what would push it elsewhere

- **Good for**: dozens to low-hundreds of customers, infrequent promotion (a few per
  week), engineering ownership over the routing table.
- **Push toward KVS** when: customer count grows past a few hundred (function size
  pressure) OR promotions happen via a non-engineering UI (a customer-success dashboard
  that flips slugs without a git PR).
- **Push toward Lambda@Edge** when: routing decisions stop being a slug→version map and
  start needing per-request information not available in the host header (e.g. A/B
  testing by user ID, geo-routing, header-derived feature flags).

When those days come, the migration path from this design is small — the Function code
becomes a `kvs.get(slug)` instead of a hash lookup, and the rest of the architecture
(S3 layout, distribution behaviors, ALB routing) is identical.
