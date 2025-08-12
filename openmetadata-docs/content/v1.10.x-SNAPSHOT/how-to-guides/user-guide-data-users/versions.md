---
title: Data Asset Versioning | OpenMetadata Version Control Guide
description: Track asset versions and view historical changes to schema, descriptions, tags, and ownership with full traceability.
slug: /how-to-guides/guide-for-data-users/versions
---

# Data Asset Versioning

OpenMetadata maintains the version history for all data assets using a number with the format *major.minor*, starting with 0.1 as the initial version of an entity. Changes in metadata result in version changes as follows:
- **Backward compatible** changes result in a **Minor version** change. A change in the description, tags, or ownership will increase the version of the data asset metadata by 0.1 (e.g., from 0.1 to 0.2).
- **Backward incompatible** changes result in a **Major version** change. For example, when a column in a table is deleted, the version increases by 1.0 (e.g., from 0.2 to 1.2).

Metadata versioning helps **simplify debugging processes**. View the version history to see if a recent change led to a data issue. Data owners and admins can review changes and revert if necessary.

Versioning also helps in **broader collaboration** among consumers and producers of data. Admins can provide access to more users in the organization to change certain fields. Crowd-sourcing makes metadata the collective responsibility of the entire organization.

{% image
  src="/images/v1.10/features/ingestion/versioning/metadata-versioning.gif"
  alt="Metadata versioning"
  caption="Metadata Versioning"
 /%}

OpenMetadata versions all the changes to the metadata to capture the evolution of data over time in the Versions History. This is tracked for all the data assets. OpenMetadata also captures the metadata changes at the source. Click on the Versions icon to see the Version History of your data.

{% image
src="/images/v1.10/how-to-guides/user-guide-for-data-stewards/v1.png"
alt="Version History Icon"
caption="Version History Icon"
/%}

If a user adds a description to a column that is recorded as a **Minor version** change by incrementing the version number by 0.1. When description, owner, or tags are added, updated, or removed the minor version changes are recorded. These are backward-compatible changes. When a column is deleted at the source, OpenMetadata captures it as backward-incompatible change. To indicate that, the **major version** is changed by incrementing the version number by 1.0.

{% image
src="/images/v1.10/how-to-guides/user-guide-for-data-stewards/v2.png"
alt="Version History"
caption="Version History"
/%}

All the changes that have happened to your data and metadata are at your fingertips to understand the evolution of your data over time. This is also key for Data Governance.

{%inlineCallout
  color="violet-70"
  bold="How to Delete a Data Asset"
  icon="MdArrowForward"
  href="/how-to-guides/guide-for-data-users/delete"%}
  Soft, or hard delete data assets
{%/inlineCallout%}