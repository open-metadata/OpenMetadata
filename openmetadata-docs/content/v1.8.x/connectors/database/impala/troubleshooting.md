---
title: Impala Connector Troubleshooting
description: Fix Impala database connector issues with OpenMetadata's comprehensive troubleshooting guide. Get solutions for common errors and configuration problems.
slug: /connectors/database/impala/troubleshooting
---

{% partial file="/v1.8/connectors/troubleshooting.md" /%}

Learn how to resolve the most common problems people encounter in the Impala connector.

## Connection Timeout

You might be getting `thrift.transport.TTransport.TTransportException: TSocket read 0 bytes`.

Make sure that if there is a Load Balancer in between OpenMetadata and Impala, the LB timeout
is not impacting the ingestion. For example, when extracting data with a lot of partitions the `DESCRIBE`
command might take more than 60 seconds, so a Load Balancer with `Idle Timeout` at 60 seconds would
kill the connection.
