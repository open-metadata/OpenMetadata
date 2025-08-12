---
title: Kubernetes Deployment | Official Documentation
description: Deploy the OpenMetadata on Kubernetes using Helm, custom values, and supported cloud configurations for scalable containerized environments.
slug: /deployment/kubernetes
collate: false
---

# Kubernetes Deployment

OpenMetadata supports the Installation and Running of Application on kubernetes through Helm Charts.

## Kubernetes Deployment Architecture

Below is the expected Kubernetes Deployment Architecture for OpenMetadata Application in **Production**.

{% image src="/images/v1.10/deployment/kubernetes/kubernetes-architecture-prod.png" alt="Kubernetes Deployment Architecture" /%}

In the above architecture diagram, OpenMetadata Application is deployed using Helm Charts. The various kubernetes manifests that supports the installation. With the above architecture, OpenMetadata Application Connects with external dependencies which is Database, ElasticSearch and Orchestration tools like airflow.

The OpenMetadata Helm Charts Exposes the Application from Kubernetes Service at Port `8585` and `8586`. The Health Checks and Metrics endpoints are available on port `8586`.

Network Policies and Ingresses are optional manifests and disabled by default. These can be installed / enabled using the [Helm Values](/deployment/kubernetes/helm-values).

## Links

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="cloud"
    bold="Helm Values"
    href="/deployment/kubernetes/helm-values" %}
    For customizing OpenMetadata Helm Deployments
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="cloud"
    bold="Deploy in AWS EKS"
    href="/deployment/kubernetes/eks" %}
    Deploy OpenMetadata in AWS Kubernetes
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="cloud"
    bold="Deploy in GCP GKE"
    href="/deployment/kubernetes/gke" %}
    Deploy OpenMetadata in GCP Kubernetes
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="cloud"
    bold="Deploy in Azure AKS"
    href="/deployment/kubernetes/aks" %}
    Deploy OpenMetadata in Azure Kubernetes
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    icon="cloud"
    bold="Deploy in OnPremises Kubernetes"
    href="/deployment/kubernetes/on-prem" %}
    Deploy OpenMetadata in On Premises Kubernetes
  {% /inlineCallout %}
{% /inlineCalloutContainer %}
