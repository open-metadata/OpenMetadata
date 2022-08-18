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

## Changing ports

This docker deployment is powered by `docker compose`, and uses the `docker-compose.yml` files shipped during 
each release [example](https://github.com/open-metadata/OpenMetadata/releases/tag/0.11.4-release).

As with the [Named Volumes](/deployment/docker/volumes), you might want to tune a bit the compose file to modify
the default ports.

We are shipping the OpenMetadata server and UI at `8585`, and the ingestion container (Airflow) at `8080`. You can
take a look at the official Docker [docs](https://docs.docker.com/compose/compose-file/#ports). As an example, You could
update the ports to serve Airflow at `1234` with:

```yaml
ports:
  - "1234:8080"
```

# Production Deployment

If you are planning on going to PROD, we also recommend taking a look at the following
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
