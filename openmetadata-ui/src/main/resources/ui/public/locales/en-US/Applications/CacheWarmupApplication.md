# Cache Warmup Application

Cache Warmup Application Configuration.

$$section
### entities $(id="entities")

$$

$$section
### Batch Size $(id="batchSize")

Number of entities to process in each batch.

$$

$$section
### Warm Read Bundles $(id="warmBundles")

Pre-warm the per-entity bundle cache (tags + certification) so the first read after deploy doesn't fan out to the DB. Disable for very large installs.

$$

$$section
### Warm Relationships $(id="warmRelationships")

Optionally pre-warm common relationship fields in the read bundle cache. Requires Warm Read Bundles. This adds extra relationship-table and entity-reference reads during warmup, so enable it only when first-read relationship latency matters.

$$

$$section
### Enable Distributed Claim $(id="enableDistributedClaim")

In multi-instance deployments, claim each entity type via Redis SETNX so only one instance warms it. Disable to let every instance warm independently (idempotent but redundant).

$$

$$section
### Force Warmup $(id="force")

Force cache warmup even if another instance is detected (use with caution).

$$