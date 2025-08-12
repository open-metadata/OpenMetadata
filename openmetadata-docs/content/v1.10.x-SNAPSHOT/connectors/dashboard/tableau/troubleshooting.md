---
title: Tableau Troubleshooting Guide | OpenMetadata Support
description: Fix Tableau connector issues in OpenMetadata with expert troubleshooting guides. Resolve common errors, connection problems, and data ingestion failures fast.
slug: /connectors/dashboard/tableau/troubleshooting
---


{% partial file="/v1.10connectors/troubleshooting.md" /%}

{% note %}
- As of OpenMetadata versions `1.7.4` and `1.7.5`, the `siteUrl` field has been removed from the Tableau connector configuration. This change was intentional, as confirmed in the release commit.  
- To connect to a non-default Tableau site, use the `siteName` field instead. The Tableau Python SDK does not require `siteUrl` for authentication.  
- Ensure the `siteName` field is correctly populated (do not use `*`) to enable successful metadata ingestion for multi-site Tableau environments.
{% /note %}
