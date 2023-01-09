---
title: Superset
slug: /connectors/dashboard/superset/sso
---

# Superset with SSO

OpenMetadata utilizes [Superset REST APIs](https://superset.apache.org/docs/api/) to retrieve metadata from Superset. These APIs support two modes of authentication: `db` and `ldap`. At this time, `OAuth` authentication is not supported by these APIs.

Although the Superset REST APIs do not support OAuth authentication, there are still two ways for a user to authenticate through the API:

- **Using admin user credentials**: When a Superset instance is initialized, a default admin user is created with the username and password both set as "admin". This admin user can be used to authenticate to the Superset APIs via the "db" authentication mode.

- **Using a Superset session token**: When a user logs in to their Superset instance, a session token is generated and stored in cookies to uniquely identify the user. When this session token is included in the request header of a REST API, the user can be authenticated and communication with the API can occur. However, we do not support this method due to the inconvenience of manually updating the session token in the event that it expires.