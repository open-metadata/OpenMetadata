---
title: Upgrade OpenMetadata | Official Documentation
description: Upgrade the platform version with step-by-step instructions on migration, compatibility, and new feature adoption.
slug: /deployment/upgrade
collate: false
---

# Upgrade OpenMetadata

In this guide, you will find all the necessary information to safely upgrade your OpenMetadata instance to 1.8.x.

{% partial file="/v1.10/deployment/upgrade/upgrade-prerequisites.md" /%}

# Upgrade your installation

Once your metadata is safe, follow the required upgrade instructions based on your environment:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Upgrade a Kubernetes Deployment"
    href="/deployment/upgrade/kubernetes#upgrade-process" %}
      Upgrade your Kubernetes installation
  {% /inlineCallout %}

  {% inlineCallout
    color="violet-70"
    icon="celebration"
    bold="Upgrade a Docker Deployment"
    href="/deployment/upgrade/docker#upgrade-process" %}
      Upgrade your Docker installation
  {% /inlineCallout %}

  {% inlineCallout
    color="violet-70"
    icon="storage"
    bold="Upgrade a Bare Metal Deployment"
    href="/deployment/upgrade/bare-metal#upgrade-process" %}
      Upgrade your Bare Metal installation
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

{% partial file="/v1.10/deployment/upgrade/post-upgrade-steps.md" /%}
