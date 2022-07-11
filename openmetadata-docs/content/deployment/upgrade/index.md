---
title: Upgrade OpenMetadata
slug: /deployment/upgrade
---

# Upgrade OpenMetadata

## Backup Metadata

Before upgrading your OpenMetadata version we recommend backing up the metadata.

The source of truth is stored in the underlying database (MySQL and Postgres supported). You can refer
to the following guide for our backup utility:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="luggage"
    bold="Backup Metadata"
    href="/deployment/upgrade/backup-metadata"
  >
    Learn how to back up MySQL data.
  </InlineCallout>
</InlineCalloutContainer>

## Upgrade your installation

Once your metadata is safe, follow the required upgrade instructions:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Upgrade a Docker Deployment"
    href="/deployment/upgrade/docker"
  >
    Upgrade your Docker installation
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Upgrade a Bare Metal Deployment"
    href="/deployment/upgrade/bare-metal"
  >
    Upgrade your Bare Metal installation
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Upgrade a Kubernetes Deployment"
    href="/deployment/upgrade/kubernetes"
  >
    Upgrade your Kubernetes installation
  </InlineCallout>
</InlineCalloutContainer>

## Upgrade for a specific version

You can find further information about specific version upgrades in the following sections:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="10k"
    bold="Upgrade 0.9"
    href="/deployment/upgrade/versions/090-to-010"
  >
    Upgrade from 0.9 to 0.10. This is a backward incompatible upgrade!
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="10k"
    bold="Upgrade 0.10"
    href="/deployment/upgrade/versions/010-to-011"
  >
    Upgrade from 0.10 to 0.11 inplace.
  </InlineCallout>
</InlineCalloutContainer>
