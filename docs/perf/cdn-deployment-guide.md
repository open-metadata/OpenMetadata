# CDN deployment guide for OpenMetadata

OpenMetadata is shipped one cluster per customer — your customer gets their own VPC, their own
load balancer, their own database, their own OpenMetadata pod. This guide is about how to make
the **first paint** of the OpenMetadata UI feel instant in that deployment model, with or
without a CDN in front.

## Why a CDN at all when you're already single-tenant?

A CDN doesn't fix multi-tenancy problems — those are solved by the per-customer cluster
architecture. The CDN solves a different problem: **distance between the browser and the
origin**.

For a customer whose users are spread across regions (US East, EU West, APAC), every asset
request crosses an ocean to hit the ALB. A 1.2 MB JS bundle behind 150 ms of round-trip
latency takes ~7 round-trips of TCP slow-start to fill the pipe — call it 1.5 s before the
first byte actually arrives at the browser.

A CDN puts a Brotli-compressed copy of every hashed asset at every edge POP near your users.
First paint goes from "Atlanta browser hits us-east-1 ALB" to "Atlanta browser hits Atlanta
CloudFront POP." That's the 1.5 s recovered, every time.

For a customer whose users are all in one region, near the ALB, the CDN is a smaller win —
maybe 50–150 ms. Still worthwhile, but you'd choose differently between options.

## What's already in the cluster

Before reaching for any CDN, OpenMetadata's Jetty already does most of the right things at the
origin (see the perf commits on the `harshach/perceived-latency-p1` branch):

1. **Pre-compressed Brotli + gzip** served from disk. Vite emits `.br` and `.gz` siblings at
   build time; `OpenMetadataAssetServlet` picks the best one per `Accept-Encoding` at zero CPU
   cost.
2. **`Cache-Control: public, max-age=31536000, immutable`** on hashed `/assets/*` paths.
   The browser never re-asks the server for these once it has them — even reloads serve from
   disk cache.
3. **`Cache-Control: no-cache, must-revalidate` + strong `ETag`** on the SPA HTML shell. The
   browser revalidates each load but the response is a 304 of ~150 bytes when nothing changed.
4. **`<link rel="modulepreload">`** for the entry chunk's sync deps. The browser starts
   fetching `vendor-antd` while it's still parsing the HTML.
5. **Inline CSS-only loading shell**. The user sees the OpenMetadata layout (sidebar, content
   skeleton, shimmer) the instant the HTML parser hits `</body>` — not 1–2 s later when
   React mounts.
6. **Service Worker (`app-worker.js`)** caches hashed `/assets/*` for the rare case where the
   browser's HTTP cache gets evicted.

All of those benefits ship with the cluster — no CDN required. If your customer is local to
the cluster's region, you may not need any of what follows.

## Deployment options, in order of complexity

### Option 1 — No CDN, edge caching at the cluster's nginx ingress

Best for: **single-region customers, lowest-cost option, air-gapped deployments**.

If you're running on Kubernetes with `ingress-nginx`, add a snippet that caches `/assets/*` at
the ingress layer. The asset bytes never have to travel from the OpenMetadata pod to the
ingress more than once.

```yaml
# Helm values for openmetadata via ingress-nginx
ingress:
  enabled: true
  annotations:
    # Cache hashed assets for 1 hour at the ingress (in addition to the immutable
    # Cache-Control the origin emits to the browser).
    nginx.ingress.kubernetes.io/server-snippet: |
      location ~ ^/assets/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$ {
        proxy_pass http://upstream_balancer;
        proxy_cache static_cache;
        proxy_cache_valid 200 1h;
        proxy_cache_use_stale error timeout updating;
        add_header X-Cache-Status $upstream_cache_status;
      }
```

The `proxy_cache` zone has to exist; configure it once at the ingress level:

```yaml
# ingress-nginx controller chart values
controller:
  config:
    http-snippet: |
      proxy_cache_path /tmp/nginx-cache levels=1:2 keys_zone=static_cache:50m
                       max_size=1g inactive=24h use_temp_path=off;
```

**Trade-off:** still has the cross-region latency problem if your users are far from the
cluster. nginx ingress only helps with the origin-pod ⇆ ingress hop, not the browser-to-region
distance.

### Option 2 — CloudFront in front, per-customer distribution

Best for: **multi-region users, AWS-hosted customers, premium tier where bandwidth is paid
through CloudFront's lower egress rates**.

Each customer's installation provisions one CloudFront distribution. Origin is the ALB you
already have. DNS layer: `{customer}.openmetadata.{your-domain}` → CloudFront.

```hcl
# Terraform module: per-customer-cloudfront
variable "customer_slug" {}
variable "alb_dns_name" {}
variable "acm_cert_arn" {}     # cert covering {customer_slug}.openmetadata.example.com
variable "alias_domain" {}     # e.g. acme.openmetadata.example.com

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  is_ipv6_enabled = true
  http_version    = "http2and3"   # offer HTTP/3 to clients
  aliases         = [var.alias_domain]
  price_class     = "PriceClass_100"   # NA + EU; flip up for global users

  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      # ALB -> CloudFront is always HTTP/1.1.
      origin_keepalive_timeout = 60
      origin_read_timeout      = 60
    }
  }

  # Hashed assets: cache at the edge for a year, content-addressed so the body can't
  # change under a given URL.
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.assets.id
  }

  # API: never cache. CloudFront sits in the path for TLS termination and HTTP/3 only.
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.api_no_cache.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # Everything else (the SPA HTML shell at /, the SPA routes like /table/foo): cache for a
  # few seconds at the edge so concurrent users in one region share a single origin hit, but
  # don't cache longer — the origin ETag/no-cache layer needs to do its job.
  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.html_short_ttl.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  viewer_certificate {
    acm_certificate_arn = var.acm_cert_arn
    ssl_support_method  = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  # Origin Shield in the region nearest the ALB. Adds an L2 cache between the edge POPs and
  # the origin so cache-miss traffic from a thousand edges still hits ALB just once.
  origin_shield {
    enabled              = true
    origin_shield_region = "us-east-1"   # wherever the ALB lives
  }
}

# Re-usable cache policies (define once at the AWS account level, reference in every
# customer's distribution).
data "aws_cloudfront_cache_policy" "assets"           { name = "om-assets-1y-immutable" }
data "aws_cloudfront_cache_policy" "html_short_ttl"   { name = "om-html-30s" }
data "aws_cloudfront_cache_policy" "api_no_cache"     { name = "om-no-cache" }
data "aws_cloudfront_origin_request_policy" "all_viewer" { name = "Managed-AllViewer" }
```

**Provisioning cost:** ~10–20 minutes per distribution after `terraform apply` (CloudFront's
own propagation). Worth automating: each new customer-onboarding flow ends with this module
applying, then your DNS layer points their subdomain at the new distribution.

**Operational cost:** CloudFront billing is per-request and per-GB-egress. For a typical
OpenMetadata customer (a few hundred internal users), this lands well within the free tier.
A large customer might see $5–$20/month per distribution at most.

**Trade-off:** N customers = N distributions to manage. AWS hard-caps you at 200
distributions per account by default; bump it via support ticket if you onboard more.

### Option 3 — Per-customer CloudFront, single hosted zone, wildcard cert

A variant of Option 2 that keeps the management overhead bounded as you scale:

- One wildcard cert: `*.openmetadata.{your-domain}` in ACM.
- One Route53 hosted zone: `openmetadata.{your-domain}`.
- Each customer's distribution still gets its own resource — but the surrounding DNS/cert
  story is shared.

The Terraform module from Option 2 stays mostly the same; the cert ARN and alias come from
the wildcard and the customer slug respectively.

### Option 4 — Caddy as the cluster-local reverse proxy (no CloudFront)

Best for: **on-prem customers, customers who don't want AWS infrastructure beyond k8s, or
shipping a "batteries-included" install that doesn't lean on cloud-vendor CDN services**.

Caddy can act as both the TLS terminator and the edge cache. Configure it in front of Jetty
inside the same cluster:

```caddyfile
{customer}.openmetadata.example.com {
    tls /etc/caddy/cert.pem /etc/caddy/key.pem

    # Hashed assets: cache aggressively. Even though the origin emits
    # Cache-Control: immutable, Caddy's own cache keeps a server-side copy so multiple
    # users in the same site share one origin fetch after a deploy.
    @hashed_assets path_regexp ^/assets/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$
    handle @hashed_assets {
        cache {
            stale 1d
            ttl 24h
        }
        reverse_proxy openmetadata-server:8585
    }

    # Everything else passes through; the origin's own cache policy applies.
    reverse_proxy openmetadata-server:8585
}
```

Caddy auto-issues TLS certs via Let's Encrypt or accepts uploaded ones. The `cache` directive
needs the `caddy-cache` plugin compiled in (or use Caddy 2.7+ which ships caching support
natively).

**Trade-off:** still single-region. Caddy doesn't sit at edge POPs. But for any cluster-local
deployment this is the simplest path and removes the cloud-vendor dependency for the CDN
layer.

### Option 5 — Cloudflare in front (cross-cloud customers)

Best for: **customers running OpenMetadata on GCP, Azure, on-prem, or anywhere except AWS,
who still want a global edge**.

Cloudflare's free tier covers small deployments. The flow is:

1. Customer's DNS for `{customer}.openmetadata.{their-domain}` proxies through Cloudflare.
2. Cloudflare hits the customer's ingress (a public LB IP, ALB, GCP LB, etc.) as the origin.
3. Page Rules / Cache Rules set TTLs by path the same way as CloudFront:
   - `/assets/*` → Cache Everything, Edge TTL 1 month, Origin Cache-Control respected.
   - `/api/*` → Bypass Cache.
   - `/` → Standard caching, ~30 s edge TTL.
4. Enable HTTP/3 in the Cloudflare site settings.

No code or config changes needed in OpenMetadata for this option — the origin headers we
already emit drive Cloudflare's cache layer correctly.

## Choosing between options

| Customer profile | Recommended path |
|---|---|
| Single-region users (e.g. all in EU), on AWS | Option 1 (ingress-nginx cache) — Option 2 if budget allows |
| Multi-region users, on AWS | Option 2 or Option 3 (per-customer CloudFront) |
| Customer on GCP / Azure / multi-cloud | Option 5 (Cloudflare) |
| Customer on-prem / air-gapped | Option 4 (Caddy or nginx, no external CDN) |
| Single small customer being bootstrapped quickly | Option 1, then upgrade if their users complain about latency |

## Measuring whether it's working

After deploying any of these options, the first-paint number to watch in Chrome DevTools is
**Time to First Byte (TTFB) for `/`** and **download time for the largest `/assets/*` chunk**.

Two specific tests:

1. **Cold first paint**, incognito tab: open DevTools → Network → disable cache → reload.
   Look at the entry JS chunk. Without CDN, this download is bandwidth-limited (~500 ms on a
   100 Mbps connection for a 1 MB chunk on the origin pulled from the ALB region). With a CDN
   in the customer's region: <200 ms.

2. **Reload after a session**: don't disable cache. Reload `/my-data`. Look at the
   `/api/v1/system/version` and `/assets/index-X.js` rows.
   - `/api/v1/system/version`: should always be a 200, no cache layer touches it.
   - `/assets/index-X.js`: should be `(disk cache)` in the Size column — the immutable
     `Cache-Control` header is doing its job. If it's `(memory cache)` or a fresh 200, the
     browser cache is being evicted under memory pressure (rare) and the Service Worker
     layer becomes the next line of defence.

For CloudFront in particular, the `X-Cache: Hit from cloudfront` response header tells you
whether the edge served the request or whether it went all the way to ALB.

## Things to avoid

- **Don't put CloudFront in `Cache-Everything` mode for the SPA HTML.** The Jetty origin
  emits `Cache-Control: no-cache` on the shell for a reason: a fresh deploy lands and the
  shell now references hashed asset filenames that didn't exist before. If CloudFront has the
  old shell cached at the edge, users get the old shell pointing at chunks that 404. Use the
  short-TTL cache policy from the Terraform example above.

- **Don't cache `/api/*` at any CDN.** Even GET-only endpoints have authz baked into the
  response: cached responses leak across users. The React Query cache on the client side
  handles request deduplication.

- **Don't enable a CDN for the OpenMetadata Helm chart's default install.** Each customer's
  deployment topology is different — making CDN provisioning part of the chart adds a hard
  dependency on AWS credentials, ACM certs, and Route53 zones that not every customer wants
  Helm to touch. Keep it as a separate Terraform module / GitOps step that runs after the
  cluster is up.
