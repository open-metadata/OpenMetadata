---
title: Redshift Connector Troubleshooting
slug: /connectors/database/redshift/troubleshooting
---

# Troubleshooting

Learn how to resolve the most common problems people encounter in the Redshift connector.

```
connection to server at \"<host>:<port>\" (@IP),
<port> failed: server certificate for \"\*<host>:<port>\"
does not match host name \"<host>:<port>\"
```

If you get this error that time plese pass `{'sslmode': 'verify-ca'}` in the connection arguments.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/redshift/service-connection-arguments.webp"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form"
/>
</div>
