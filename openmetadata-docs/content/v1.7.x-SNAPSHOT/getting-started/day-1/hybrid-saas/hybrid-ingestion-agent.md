---
title: Hybrid Ingestion Agent
slug: /getting-started/day-1/hybrid-saas/hybrid-ingestion-agent.md
collate: true
---

# Hybrid Ingestion Agent

The **Hybrid Ingestion Agent** is a component designed to enable Collate customers operating in hybrid environments to securely execute ingestion workflows within their own cloud infrastructure. In this setup, your SaaS instance is hosted on Collate’s cloud, while tools like Argo Workflows are deployed within the your private cloud. The Hybrid Agent acts as a bridge between these two environments, allowing ingestion workflows to be triggered and managed remotely—without requiring the customer to share secrets or sensitive credentials with Collate. It securely receives workflow execution requests and orchestrates them locally, maintaining full control and data privacy within the customer’s environment.

## Prerequisites

Before setting up the Hybrid Ingestion Agent, ensure the following:

- Your SaaS instance is up and running.
- You have **Argo** deployed in your own cloud environment.
- Network access between the customer’s cloud and Collate’s WebSocket server (outbound traffic from your cloud to Collate).
- Java 17+ for the agent.
- Docker.
- Secrets manager configured on the Customer cloud.

## How to Activate the Hybrid Ingestion Agent Server

The server-side WebSocket component runs as part of the Collate server within Collate's cloud and handles the orchestration of ingestion triggers. To activate the hybrid ingestion agent server, some environment variables must be configured:


| Environment Variable                                | Value                                        |
|-----------------------------------------------------|----------------------------------------------|
| `OM_SM_ACCESS_KEY_ID`                               | Secrets manager key ID                       |
| `OM_SM_ACCESS_KEY`                                  | Secrets manager access key                   |
| `OM_SM_REGION`                                      | Secrets manager region                       |
| `PIPELINE_SERVICE_CLIENT`                           | `argo`                                        |
| `PIPELINE_SERVICE_CLIENT_CLASS_NAME`                | `io.collate.service.hybrid.HybridServiceClient` |
| `PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER`    | `env`                                         |


Ensure that the Collate's server port is accessible and configured for secure communication if used in production.

## How to Run the Hybrid Ingestion Agent

On the customer’s cloud environment, run the Hybrid Agent which connects to the Collate's server and wraps calls to the Argo Workflows client.

**Required environment variables**

| Environment Variable        | Value                                                                              |
|----------------------------|------------------------------------------------------------------------------------|
| `AGENT_ID`                 | `WestEu1Agent` # must be unique                                                    |
| `ARGO_EXTRA_ENVS_NOOP`     | `[AWS_DEFAULT_REGION:value, AWS_ACCESS_KEY_ID:value, AWS_SECRET_ACCESS_KEY:value]` |
| `ARGO_INGESTION_IMAGE`     | `penmetadata/collate-base:<version>`                                               |
| `AUTH_TOKEN`               | Collate server access token                                                        |
| `SERVER_URL`              | `wss://<collate_host>:<port>`                                                      |

```bash
aws ecr get-login-password --region us-east-2 | docker login -u AWS --password-stdin 118146679784.dkr.ecr.us-east-2.amazonaws.com
docker pull 118146679784.dkr.ecr.us-east-2.amazonaws.com/hybrid-ingestion-agent:<version>
```

The agent listens for incoming workflow execution messages and triggers them via Argo, providing status updates back to the server.

## Monitoring

The Hybrid Agent exposes internal metrics for observability and monitoring.

To access metrics visit the metrics endpoint:

```
http://<hybrid ingestion agent host>:8989/metrics
```

**Customizing metrics path and port**

| Environment Variable  |
|-----------------------|
| METRICS_SERVER_PATH   | 
| METRICS_SERVER_PORT   |

These metrics can be scraped by Prometheus or visualized using tools like Grafana. Exposed metrics include:

| Metric                                                       | Type     | Description                                                  |
|--------------------------------------------------------------|----------|--------------------------------------------------------------|
| `collate_hybrid_agent_jobs_counter_total`                    | counter  | Number of jobs created by the agent                          |
| `collate_hybrid_agent_memory_usage`                          | gauge    | RAM usage (MB) - Java heap memory                            |
| `collate_hybrid_agent_jobs_total{status="succeeded"}`        | counter  | Number of jobs by status                                     |
| `collate_hybrid_agent_server_response_time_seconds_max`      | gauge    | Average Collate server response time                         |
| `collate_hybrid_agent_server_response_time_seconds_count`    | summary  | Number of Collate server response time observations          |
| `collate_hybrid_agent_server_response_time_seconds_sum`      | summary  | Total Collate server response time (for average calculation) |
| `collate_hybrid_agent_argo_response_time_seconds_max`        | gauge    | Average Argo Workflow response time                          |
| `collate_hybrid_agent_argo_response_time_seconds_count`      | summary  | Number of Argo response time observations                    |
| `collate_hybrid_agent_argo_response_time_seconds_sum`        | summary  | Total Argo response time (for average calculation)           |
| `collate_hybrid_agent_cpu_usage`                             | gauge    | CPU usage (%)                                                |
| `collate_hybrid_agent_connected`                             | gauge    | Is the agent connected to the server? (0 = No, 1 = Yes)      |