---
title: Vertica Connector Troubleshooting
slug: /connectors/database/vertica/troubleshooting
---

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

Learn how to resolve the most common problems people encounter in the Vertica connector.

## Profiler: New session rejected

If you see the following error when computing the profiler `New session rejected due to limit, already XYZ sessions active`,
it means that the number of threads configured in the profiler workflow is exceeding the connection limits of your
Vertica instance.

Note that by default the profiler runs with 5 threads. In case you see this error, you might need to reduce this number.
