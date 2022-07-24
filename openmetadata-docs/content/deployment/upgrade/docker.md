---
title: Upgrade on Docker
slug: /deployment/upgrade/docker
---

# Upgrade on Docker

For running OpenMetadata on Docker, we downloaded a `docker-compose.yml` file. Optionally, we added some
Named Volumes to handle data persistence.

<Note>

You can refresh these steps [here](/deployment/docker)

</Note>

Now,

1. Visit [github.com/open-metadata/OpenMetadata/releases](github.com/open-metadata/OpenMetadata/releases). The
    latest release will be at the top of this page.
2. Download the new `docker-compose.yml` file.
3. Run the `docker compose up -d` command on the new compose file.
