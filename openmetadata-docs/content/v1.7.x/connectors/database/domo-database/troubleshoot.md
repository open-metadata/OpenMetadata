---
title: Domo Database Connector Troubleshooting
description: Troubleshoot Domo Database connector issues in OpenMetadata with expert solutions, common error fixes, and step-by-step debugging guides.
slug: /connectors/database/domo-database/troubleshoot
---

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

Learn how to resolve the most common problems people encounter in the Domo Database connector.

### How to find clientId?
* You can find your `clientId` by [logging](https://developer.domo.com/) into your domo instance.
* After that click on `My Account`> `Manage Clients`(if created).

{% image
src="/images/v1.7/connectors/domodatabase/client-id.png"
alt="Client-id"
caption="Find Services under the Settings menu" /%}

### Where to find accessToken?
* You need to generate accessToken.
* [Login](https://www.domo.com/login) into your sandbox domain ex. `<your-domain>.domo.com`.
* Click on the `MORE` button on navbar, after that click on `Admin`.
* Under `Authentication` you will find `Access tokens`.

{% image
src="/images/v1.7/connectors/domodatabase/access-token.png"
alt="Access Token"
caption="access-token" /%}


### Where can I find my scopes?
* Scopes can be find Under `Manage Clients` section in `My Account` (If client not found, click [here](#how-to-find-clientid))

{% image
src="/images/v1.7/connectors/domodatabase/scopes.jpeg"
alt="Scopes"
caption="Scopes" /%}



