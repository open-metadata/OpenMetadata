---
title: Data Governance Glossary Troubleshooting | OpenMetadata Guide
slug: /how-to-guides/data-governance/glossary/troubleshooting
---

# Troubleshooting

## Glossary Import/Export Stuck When Using NGINX

**Issue:**  
When running OpenMetadata behind NGINX with SSL (HTTPS proxy to port 8585), glossary bulk import and export operations may remain stuck in the "Import is in progress" state.

**Cause:**  
The glossary import/export functionality relies on WebSocket communication. If NGINX is not configured to support WebSocket upgrades, the WebSocket handshake will fail, resulting in the UI hanging on the import/export process.

**Solution:**  
Update your NGINX configuration to support WebSocket upgrades by modifying the `location /` block as follows:

```nginx
location / {
    proxy_pass http://127.0.0.1:8585;

    # Enable WebSocket support
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_http_version 1.1;
}
```
