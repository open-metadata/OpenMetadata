# Troubleshooting

## Workflow Deployment Error

If there were any errors during the workflow deployment process, the
Ingestion Pipeline Entity will still be created, but no workflow will be
present in the Ingestion container.

- You can then Edit the Ingestion Pipeline and **Deploy** it again.
- From the Connection tab, you can also Edit the Service if needed.

## Connector Debug Troubleshooting

This section provides instructions to help resolve common issues encountered during connector setup and metadata ingestion in OpenMetadata. Below are some of the most frequently observed troubleshooting scenarios.

## How to Enable Debug Logging for Any Ingestion

To enable debug logging for any ingestion workflow in OpenMetadata:

1. **Navigate to Services**
   Go to **Settings > Services > Service Type** (e.g., Database) in the OpenMetadata UI.

2. **Select a Service**
   Choose the specific service for which you want to enable debug logging.

{% image
  src="/images/v1.7/connectors/debug/debug1.png"
  alt="Select a Service"
  caption="Select a Service"
/%}

3. **Access Ingestion Tab**
Go to the **Ingestion tab** and click the three-dot menu on the right-hand side of the ingestion type, and select Edit.

{% image
  src="/images/v1.7/connectors/debug/debug2.png"
  alt="Access Agents Tab"
  caption="Access Agents Tab"
/%}

4. **Enable Debug Logging**
   In the configuration dialog, enable the **Debug Log** option and click **Next**.

{% image
  src="/images/v1.7/connectors/debug/debug3.png"
  alt="Enable Debug Logging"
  caption="Enable Debug Logging"
/%}

5. **Schedule and Submit**
   Configure the schedule if needed and click **Submit** to apply the changes.

{% image
  src="/images/v1.7/connectors/debug/debug4.png"
  alt="Schedule and Submit"
  caption="Schedule and Submit"
/%}

## Permission Issues

If you encounter permission-related errors during connector setup or metadata ingestion, ensure that all the prerequisites and access configurations specified for each connector are properly implemented. Refer to the connector-specific documentation to verify the required permissions.