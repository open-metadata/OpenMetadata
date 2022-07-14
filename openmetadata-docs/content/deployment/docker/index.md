---
title: Docker Deployment
slug: /deployment/docker
---

# Docker Deployment

Deploying OpenMetadata in Docker is a great start! Take a look at our
[Quickstart](/quick-start/local-deployment) guide to learn how to get OpenMetadata
up and running locally in less than 7 minutes!

If those steps are already done, you might want to bind Named Volumes
for data persistence. Learn how to do so [here](/deployment/docker/volumes).

To test out your security integration, check out how to 
[Enable Security](/deployment/docker/security).

# Production Deployment

If instead, you are planning on going to PROD, we recommend the following
deployment strategies:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Deploy on Bare Metal"
    href="/deployment/bare-metal"
  >
    Deploy OpenMetadata directly using the binaries.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Deploy on Kubernetes"
    href="/deployment/kubernetes"
  >
    Deploy and scale with Kubernetes
  </InlineCallout>
</InlineCalloutContainer>
