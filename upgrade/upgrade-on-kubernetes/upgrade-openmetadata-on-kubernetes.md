---
description: >-
  This guide will help you upgrade your OpenMetadata Kubernetes Application with
  automated helm hooks.
---

# Upgrade OpenMetadata on Kubernetes

### Requirements

This guide assumes that you have an OpenMetadata deployment that you installed and configured following the [Run OpenMetadata](../../deploy/deploy-on-kubernetes/run-in-kubernetes.md) guide.

### Procedure

{% hint style="info" %}
#### Backup your metadata

Follow the [Backup Metadata](broken-reference) guide to ensure you have a restorable copy of your metadata before proceeding further.
{% endhint %}

{% hint style="danger" %}
At this moment, OpenMetadata does not support Rollbacks as part of Database Migrations. Please proceed cautiously or connect with us on [Slack](https://join.slack.com/t/openmetadata/shared\_invite/zt-wksh1bww-iQGk45NTw6Tp4Q9UZd6QOw).
{% endhint %}

{% hint style="success" %}
This guide assumes your helm chart release names as _openmetadata_ and _openmetadata-dependencies._
{% endhint %}

#### Upgrade Helm Repository with new release

Update Helm Chart Locally for open-metadata with the below command.

```
helm repo update open-metadata
```

It will result in the below output on screen.

> ```
> Hang tight while we grab the latest from your chart repositories...
> ...Successfully got an update from the "open-metadata" chart repository
> Update Complete. ⎈Happy Helming!⎈
> ```

Verify with the below command to see the latest release available locally.

```
helm search repo open-metadata --versions
```

```
NAME                                   	CHART VERSION	APP VERSION	DESCRIPTION                                
open-metadata/openmetadata             	0.0.6        	0.8.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.5        	0.8.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.4        	0.8.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.3        	0.7.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.2        	0.6.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata             	0.0.1        	0.5.0      	A Helm chart for OpenMetadata on Kubernetes
open-metadata/openmetadata-dependencies	0.0.6        	0.8.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.5        	0.8.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.4        	0.8.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.3        	0.7.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.2        	0.6.0      	Helm Dependencies for OpenMetadata         
open-metadata/openmetadata-dependencies	0.0.1        	0.5.0      	Helm Dependencies for OpenMetadata
```

#### Upgrade OpenMetadata Dependencies

We upgrade OpenMetadata Dependencies with below command

```
helm upgrade openmetadata-dependencies open-metadata/openmetadata-dependencies
```

#### Upgrade OpenMetdata

We upgrade OpenMetadata with the below command

```
helm upgrade openmetadata open-metadata/openmetadata
```

{% hint style="info" %}
Starting from `0.0.6` open-metadata helm release, we support automatic repair and migration of databases. This will **ONLY** be handle on Helm chart upgrades to latest versions going-forward.
{% endhint %}

### What's Next

Head on to [connectors](../../docs/integrations/connectors/) section to ingest data from various sources.
