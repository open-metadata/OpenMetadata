---
title: Connection Details
slug: /connectors/database/bigquery/connections
---

{% partial file="/v1.5/connectors/database/auth/bigquery.md" /%}

{% note %}
If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for BigQuery you can just leave
the GCP credentials empty. This is why they are not marked as required.
{% /note %}


{% partial file="/v1.5/connectors/database/advanced-configuration.md" /%}