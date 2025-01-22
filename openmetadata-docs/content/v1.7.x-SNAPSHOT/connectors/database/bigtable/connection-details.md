---
title: Connection Details
slug: /connectors/database/bigtable/connections
---

{% partial file="/v1.7/connectors/database/auth/bigtable.md" /%}

{% note %}
If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for BigTable you can just leave
the GCP credentials empty. This is why they are not marked as required.
{% /note %}


{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}