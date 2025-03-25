---
title: How to Enable Debug Logging for Ingestion Workflows
slug: /connectors/troubleshooting/enable-debug-logging
---

# How to Enable Debug Logging for Any Ingestion

To enable debug logging for any ingestion workflow in OpenMetadata:

1. **Navigate to Services**  
   Go to **Settings > Services > Service Type** (e.g., Database) in the OpenMetadata UI.

2. **Select a Service**  
   Choose the specific service for which you want to enable debug logging.

{% image
  src="/images/v1.6/connectors/debug/debug1.png"
  alt="Select a Service"
  caption="Select a Service"
/%}

3. **Access Ingestion Tab**  
Go to the **Ingestion tab** and click the three-dot menu on the right-hand side of the ingestion type, and select Edit.

{% image
  src="/images/v1.6/connectors/debug/debug2.png"
  alt="Access Agents Tab"
  caption="Access Agents Tab"
/%}

4. **Enable Debug Logging**  
   In the configuration dialog, enable the **Debug Log** option and click **Next**.

{% image
  src="/images/v1.6/connectors/debug/debug3.png"
  alt="Enable Debug Logging"
  caption="Enable Debug Logging"
/%}

5. **Schedule and Submit**  
   Configure the schedule if needed and click **Submit** to apply the changes.

{% image
  src="/images/v1.6/connectors/debug/debug4.png"
  alt="Schedule and Submit"
  caption="Schedule and Submit"
/%}
