---
title: Hybrid Ingestion Runner
slug: /getting-started/day-1/hybrid-saas/hybrid-ingestion-runner.md
collate: true
---

# Hybrid Ingestion Runner

The **Hybrid Ingestion Runner** is a component designed to enable Collate customers operating in hybrid environments to securely execute ingestion workflows within their own cloud infrastructure. In this setup, your SaaS instance is hosted on Collate’s cloud, while tools like Argo Workflows are deployed within the your private cloud. The Hybrid Runner acts as a bridge between these two environments, allowing ingestion workflows to be triggered and managed remotely—without requiring the customer to share secrets or sensitive credentials with Collate. It securely receives workflow execution requests and orchestrates them locally, maintaining full control and data privacy within the customer’s environment.

## Prerequisites

Before setting up the Hybrid Ingestion Runner, ensure the following:

- Your Collate SaaS instance is available.
- You have **Argo Workflows** deployed in your own cloud environment.
- Network access between your own cloud and Collate SaaS server (outbound traffic from your cloud to Collate).
- Java 17+ for the runner.
- Docker.
- Secrets manager configured on your cloud.

## How to Run the Hybrid Ingestion Runner

On your cloud environment, run the Hybrid Runner which connects to the Collate's server and wraps calls to the Argo Workflows client.

**Required environment variables**

| Environment Variable        | Value                                                                              |
|----------------------------|------------------------------------------------------------------------------------|
| `AGENT_ID`                 | `WestEu1Runner` # must be unique                                                   |
| `ARGO_EXTRA_ENVS_NOOP`     | `[AWS_DEFAULT_REGION:value, AWS_ACCESS_KEY_ID:value, AWS_SECRET_ACCESS_KEY:value]` |
| `ARGO_INGESTION_IMAGE`     | `openmetadata/collate-base:<version>`                                              |
| `AUTH_TOKEN`               | Collate server access token                                                        |
| `SERVER_URL`              | `wss://<collate_host>:<port>`                                                      |

```bash
aws ecr get-login-password --region us-east-2 | docker login -u AWS --password-stdin 118146679784.dkr.ecr.us-east-2.amazonaws.com
docker pull 118146679784.dkr.ecr.us-east-2.amazonaws.com/hybrid-ingestion-runner:<version>
```

The runner listens for incoming workflow execution messages and triggers them via Argo, providing status updates back to the server.

