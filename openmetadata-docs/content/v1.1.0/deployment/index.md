---
title: Deployment
slug: /deployment
---

# From 0 to OpenMetadata in 5 minutes

Are you exploring or doing a PoC? It won't get easier than following our Quickstart guide!

{% inlineCalloutContainer %}

{% inlineCallout
icon="celebration"
bold="Quickstart OpenMetadata in Docker"
href="/quick-start/local-docker-deployment" %}
Get OpenMetadata up and running using Docker in under 5 minutes!
{% /inlineCallout %}

{% inlineCallout
icon="celebration"
bold="Quickstart OpenMetadata in Kubernetes"
href="/quick-start/local-kubernetes-deployment" %}
Get OpenMetadata up and running using local Kubernetes in under 5 minutes!
{% /inlineCallout %}

{% inlineCallout
icon="open_in_new"
bold="Try the OpenMetadata Sandbox"
href="/quick-start/sandbox" %}
Interact with a sample installation with 0 setup to explore our Discovery, Governance and Collaboration features.
{% /inlineCallout %}

{% /inlineCalloutContainer %}

# Components Of OpenMetadata Application

OpenMetadata Application consists on one component which houses both APIs and UI. This component is powered by 3 external dependencies -

1. Relational Database (MySQL, PostgreSQL)
2. Search Engine (ElasticSearch, OpenSearch)
3. Workflow Orchestration Tool (Airflow)

The Dependencies must be deployed before installing OpenMetadata Application. With Docker and Kubernetes deployment, we package these together as part of quickstart. 

For production deployment, we recommend you to bring up these dependencies as external and do not rely on quickstart packages.

{%note%}

**Note on Airflow as workflow orchestration tool dependency -**

If you are looking for setting up the connectors in OpenMetadata Application from UI, Airflow is a required dependency. OpenMetadata Application dynamically generates the workflows from UI to be triggered and scheduled by Airflow orchestration tool.

You can also use OpenMetadata SDKs and run the connectors externally which will be an alternative to Airflow as one of the dependencies component from the above list.

{%/note%}

# Architecture and Deployment

We support different kinds of deployment which is meant for production deployments:

{%inlineCalloutContainer%}
  {%inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Deploy on Docker"
    href="/quick-start/local-deployment"%}
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

# Security

Find further information on how to secure your OpenMetadata deployment:

{%inlineCalloutContainer%}
  {%inlineCallout
    color="violet-70"
    icon="add_moderator"
    bold="Enable Security"
    href="/deployment/security"%}
    Enable Security for your OpenMetadata deployment
  {%/inlineCallout%}
{%/inlineCalloutContainer%}

# Upgrade

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
