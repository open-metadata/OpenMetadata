---
title: Troubleshooting for Import-Export issue
description: Resolve glossary CSV export failures in `brandName` by checking proxy settings, enabling WebSockets, and verifying real-time connectivity.
slug: /how-to-guides/data-discovery/troubleshooting
---

# Troubleshooting Export Issue 
When attempting to export a **CSV file for a Glossary**, the process gets stuck on the message **"Export initiated successfully."** and never completes. The file is not downloaded, and the export button remains disabled.

This issue may occur if **WebSockets are blocked** in your network setup due to a **proxy** or **load balancer** configuration. OpenMetadata relies on WebSockets for real-time communication, and if they are blocked, the export process cannot complete.

## Troubleshooting Steps

### Step 1: Check for Load Balancer or Proxy

If your setup includes a **load balancer** or **proxy**, verify whether WebSockets are being blocked.

1. Run the following API request to check the export status:

```bash
curl -X GET "https://<your-openmetadata-instance>/api/v1/glossaries/name/<Glossary_Name>/exportAsync"
```

If the response does not return a file and remains in an active state indefinitely, WebSockets might be blocked.

### Step 2: Verify WebSocket Connectivity

1. Open the Developer Tools in your browser (F12 or Ctrl + Shift + I in Chrome).
2. Navigate to the Network tab.
3. Filter requests by WebSockets (WS).
4. Check if WebSocket requests to OpenMetadata (wss://<your-openmetadata-instance>) are blocked, failing, or not established.

### Step 3: Adjust WebSocket Settings in Your Proxy

If WebSockets are blocked, update your proxy configuration to allow WebSocket traffic.

### Step 4: Restart Services and Verify

1. Restart your proxy or load balancer after making the configuration changes.
2. Clear browser cache and cookies.
3. Retry the CSV export in OpenMetadata.

Once WebSockets are enabled in the proxy settings, the glossary export should complete successfully, and the CSV file should be available for download.
