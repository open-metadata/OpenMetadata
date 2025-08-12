---
title: MongoDB Troubleshooting Guide | OpenMetadata Support
description: Troubleshoot MongoDB integration errors such as connection failures, schema fetch issues, or metadata mismatches.
slug: /connectors/database/mongodb/troubleshooting
---

{% partial file="/v1.10/connectors/troubleshooting.md" /%}

## Resolving MongoDB Ingestion Failures

When attempting to connect OpenMetadata to MongoDB, particularly cloud-hosted or replica set deployments, you might encounter timeout errors or connection failures. Follow the steps below to identify and resolve these issues.

## 1. Verify Connection Scheme

### Cloud MongoDB (MongoDB Atlas)
Use the connection scheme `mongodb+srv` in the **Advanced Config > Connection Scheme** field.  
Do **not** include the port in the host field.

**Example:**

```yaml
hostPort: ahamove.mongodb.net
connectionScheme: mongodb+srv
```
## 2. Enable SSL for Encrypted Connections

If your connection string includes `ssl=true`, you must explicitly set SSL in the Connection Options.

```yaml
connectionOptions:
  ssl: true
```

This is mandatory when connecting to clusters that enforce SSL/TLS encryption.

## 3. Inspect Debug Logs

Enable and review debug logs for more detailed error messages:

- Navigate to the ingestion workflow in the OpenMetadata UI
- Enable **Debug Log** in the configuration settings
- Check logs using the Docker CLI:

```bash
docker logs <openmetadata-ingestion-container>
```
4. Check Docker Networking

Ensure that the OpenMetadata container is on the same network as the ingestion container, especially when running locally via Docker Compose.
