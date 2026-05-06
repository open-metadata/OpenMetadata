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

Pre-warm the per-entity bundle cache with tags and certification.

$$

$$section
### Warm Relationships $(id="warmRelationships")

Pre-warm common relationship fields in the read bundle cache. Requires Warm Read Bundles and can add extra warmup time on large installs.

$$

$$section
### Enable Distributed Claim $(id="enableDistributedClaim")

Claim each entity type through Redis so only one instance warms it.

$$

$$section
### Force Warmup $(id="force")

Force cache warmup even if another instance is detected (use with caution).

$$
