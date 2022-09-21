---
title: Upgrade OpenMetadata
slug: /deployment/upgrade
---

# Upgrade OpenMetadata

## Releases

OpenMetadata community will be doing feature releases and stable releases. 
 - Feature releases are to upgrade your sandbox or POCs to give feedback to the community and any potential bugs that the community needs to fix.
 - Stable releases are to upgrade your production environments and share it with your users.

## 0.12.0 - Feature release
 
 OpenMetadata 0.12.0 is a feature release ** Please do not upgrade your production ** 
 Join our slack https://slack.open-metadata.org provide your feedback and help community to get to the stable 0.12.1 release
 
## 0.12.0 - Known Issues

- Upgrade Issues - https://github.com/open-metadata/OpenMetadata/issues/7504
- Bots listing page not showing Ingestion Bot account - https://github.com/open-metadata/OpenMetadata/issues/7539
- UI- Search Filter malfunction - https://github.com/open-metadata/OpenMetadata/issues/7313

 
 

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
    bold="Upgrade 0.11 to 0.12"
    href="/deployment/upgrade/versions/011-to-012"
  >
    Upgrade from 0.11 to 0.12 inplace.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="10k"
    bold="Upgrade 0.10"
    href="/deployment/upgrade/versions/010-to-011"
  >
    Upgrade from 0.10 to 0.11 inplace.
  </InlineCallout>
   <InlineCallout
    color="violet-70"
    icon="10k"
    bold="Upgrade 0.9"
    href="/deployment/upgrade/versions/090-to-010"
  >
    Upgrade from 0.9 to 0.10. This is a backward incompatible upgrade!
  </InlineCallout>
</InlineCalloutContainer>
