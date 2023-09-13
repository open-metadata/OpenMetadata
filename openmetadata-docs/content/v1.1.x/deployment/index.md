---
title: Deployment
slug: /deployment
---

# Deploy OpenMetadata in Production

{%note%}
Are you looking to do POC? It won't get easier than following our [Quickstart](/quick-start) guide!
{%/note%}


## OpenMetadata Deployment Architecture

{% image
    src="/images/v1.1/deployment/architecture.png"
    alt="architecture" /%}

OpenMetadata requires 4 components

1. OpenMetadata Server, pick the latest release from our (GitHub releases)[https://github.com/open-metadata/OpenMetadata/releases]
2. OpenMetadata Server stores the metadata in a relational database. We support MySQL or Postgres. Any Cloud provider such as AWS or GCP's provided MySQL/Postgres services will work as well
	1. MySQL Version 8.0.0 or Greater
	2. Postgres Version 12.0 or Greater
3. Search Engine (ElasticSearch, OpenSearch)
	1. We support ElasticSearch 7.16 to 7.17
	2. OpenSearch 1.3 
4. Workflow Orchestration Tools
	OpenMetadata requires connectors to be scheduled to periodically fetch the metadata, or you can use the OpenMetadata APIs to push the metadata as well
	1. OpenMetadata Ingestion Framework is flexible to run on any orchestrator. However, we built an ability to deploy and manage connectors as pipelines from the UI. This requires the Airflow container we ship
	2. If your team prefers to run on any other orchestrator such as prefect, dagster or even GitHub workflows. Please refer to our recent webinar on [How Ingestion Framework works](https://www.youtube.com/watch?v=i7DhG_gZMmE&list=PLa1l-WDhLreslIS_96s_DT_KdcDyU_Itv&index=10)

The Dependencies must be deployed before installing OpenMetadata Application. With Docker and Kubernetes deployment, we package these together as part of quickstart. 

{% note noteType="Warning" %}
For production deployment, we recommend you to bring up MySQL/Postgres, Elastic/OpenSearch, Scheduler (like airflow) as an external service and do not rely on quickstart packages.
{% /note %}


## Deployment Options

We support following deployment options

{%inlineCalloutContainer%}
  {%inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Deploy on Docker"
    href="/deployment/docker"%}
    Deploy OpenMetadata with Docker
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    icon="storage"
    bold="Deploy on Bare Metal"
    href="/deployment/bare-metal"%}
    Deploy OpenMetadata directly using the binaries.
  {%/inlineCallout%}
  {%inlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Deploy on Kubernetes"
    href="/deployment/kubernetes"%}
    Deploy and scale with Kubernetes
  {%/inlineCallout%}
{%/inlineCalloutContainer%}

## Security

Secure your OpenMetadata deployment

{%inlineCalloutContainer%}
  {%inlineCallout
    color="violet-70"
    icon="add_moderator"
    bold="Enable Security"
    href="/deployment/security"%}
    Enable Security for your OpenMetadata deployment
  {%/inlineCallout%}
{%/inlineCalloutContainer%}

## Upgrade

Learn how to move from version to version:

{%inlineCalloutContainer%}
  {%inlineCallout
    color="violet-70"
    icon="10k"
    bold="Upgrade OpenMetadata"
    href="/deployment/upgrade/"%}
    Upgrade your OpenMetadata deployment
  {%/inlineCallout%}
{%/inlineCalloutContainer%}
