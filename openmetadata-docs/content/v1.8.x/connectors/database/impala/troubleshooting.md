---
title: Impala Connector Troubleshooting | Official Documentation
description: Troubleshoot Impala connector for ingestion failures, type mismatches, and driver issues.
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
