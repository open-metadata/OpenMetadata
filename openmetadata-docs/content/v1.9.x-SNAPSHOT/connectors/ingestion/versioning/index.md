---
title: Metadata Versioning | `brandName` Data History Management
description: Learn how `brandName`'sconnector versioning system manages data ingestion workflows. Discover version control best practices and compatibility guidelines.
slug: /connectors/ingestion/versioning
---

# Metadata Versioning

OpenMetadata maintains the version history for all entities using a number with the format *major.minor*, starting with 0.1 as the initial version of an entity.

Changes in metadata result in version changes as follows:
- Backward **compatible** changes result in a Minor version change. A change in the description, tags, or ownership will increase the version of the entity metadata by 0.1 (e.g., from 0.1 to 0.2).
- Backward **incompatible** changes result in a Major version change. For example, when a column in a table is deleted, the version increases by 1.0 (e.g., from 0.2 to 1.2).

Metadata versioning helps **simplify debugging processes**. View the version history to see if a recent change led to a data issue. Data owners and admins can review changes and revert if necessary.

Versioning also helps in **broader collaboration** among consumers and producers of data. Admins can provide access to more users in the organization to change certain fields. Crow sourcing makes metadata the collective responsibility of the entire organization.

{% image
  src="/images/v1.9/features/ingestion/versioning/metadata-versioning.gif"
  alt="Metadata versioning"
 /%}

