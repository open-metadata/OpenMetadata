---
description: This guide will help you run OpenMetadata using docker
---

# Run Docker

[Docker](https://docs.docker.com/get-started/overview/) is an open platform for developing, shipping, and running applications that enables you to separate your applications from your infrastructure so you can deliver software quickly using OS-level virtualization to deliver software in packages called containers.

{% hint style="info" %}
**Prerequisites**

* Docker &gt;= 20.10.x

**Ports to access once the docker is up:**

* OpenMetadata UI: 8585
* Scheduler UI: 7777
{% endhint %}

```text
cd docker/metadata
docker-compose up
```

