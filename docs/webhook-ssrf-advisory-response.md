# Response to the Webhook SSRF advisory

Thanks for the detailed report and the live PoC. We've reproduced the behavior and audited the code paths. We'd like to separate what we agree on from where we think the impact framing overreaches, and lay out what we'll fix.

## What we accept

1. **The validator fails open on DNS names.** `URLValidator` regex-matches only literal private IP strings against the textual host; DNS hostnames, decimal/hex IPv4, IPv4-mapped IPv6, and `0.0.0.0` all bypass. This is a real gap and we'll fix it — resolve-then-validate, re-checked at dispatch time.
2. **The status-code oracle.** `lastFailedStatusCode` / `lastFailedReason` in the destinations API leak internal service reachability and fingerprints. We'll collapse this for External webhook destinations.
3. **Arbitrary headers and unvalidated redirects.** `Webhook.headers` is applied verbatim, and the JAX-RS client follows redirects with no re-validation. Both will be tightened.

## Where we disagree on impact

**This requires EventSubscription create permission, which default policies restrict to admin.** The CVSS PR:H framing is correct, and we ask that the write-up keep it prominent. The "application admin ≠ infrastructure access" argument is deployment-dependent: it holds for managed/multi-team setups where subscription management is delegated to data-platform users, but not for the common single-team self-hosted deployment where the OM admin and the cluster operator are the same principal. We'd characterize this as a hardening gap that becomes a boundary crossing in specific deployment models — not a universal privilege escalation.

**The IMDS credential claim is deployment-dependent and wasn't demonstrated.** Your PoC demonstrated (a) event-content exfiltration to an external endpoint and (b) a blind status-code oracle against an internal service. It did not demonstrate credential theft. For IMDS exfiltration to work, all of the following must hold: the deployment is cloud-hosted, the pod can reach the node/instance metadata endpoint (not the case with EKS hop-limit=1, GKE Workload Identity + metadata concealment, or non-cloud installs), and the attacker holds subscription-create privilege. We also note that one of your escalation paths relies on "the separately-tracked committed-admin-JWT advisory" — chaining to an unproven second bug is speculation, not evidence about this one.

That said, in the spirit of candor: while auditing we found that the `/testDestination` endpoint returns the target's response **body** (not just status) in `statusDetails.entity`, which converts the blind oracle into a full read-back channel. So the IMDS mechanism you describe is more reachable than your PoC showed. We're treating that as a bug and will redact response bodies/headers from test-destination results for external webhook types. We'd rather tell you this than have it surface later.

## What we'll ship

1. Resolve-then-validate in `URLValidator` (`InetAddress.getAllByName`), rejecting loopback, link-local, site-local, any-local, multicast, ULA, IPv4-mapped private, and known cloud-metadata addresses; re-validated against the resolved address at dispatch time (defeats DNS rebinding TOCTOU).
2. Redirect following disabled on the webhook client (or every redirect target re-validated).
3. Cloud-metadata headers (`Metadata-Flavor`, `Metadata`, `X-aws-ec2-metadata-token`, …) stripped from `Webhook.headers`.
4. `statusDetails` for External webhook destinations collapsed to ok/fail; response body/headers no longer returned from `/testDestination`.

## On the CVE

You're within your rights to file with MITRE/a CNA. We ask for a reasonable coordination window after the fix ships, and that the CVE record reflect the privilege requirement (admin / subscription-create) and the deployment preconditions for the IMDS path, rather than the unqualified "leaks IAM credentials" framing. We'll credit you in the advisory and release notes.
