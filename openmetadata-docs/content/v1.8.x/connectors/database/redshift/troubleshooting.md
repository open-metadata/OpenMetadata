---
title: Redshift Connector Troubleshooting
description: Solve OpenMetadata Redshift connector issues fast with our comprehensive troubleshooting guide. Fix connection errors, authentication problems & more.
slug: /connectors/database/redshift/troubleshooting
---

{% partial file="/v1.8/connectors/troubleshooting.md" /%}

Learn how to resolve the most common problems people encounter in the Redshift connector.

### Connection Error

```
connection to server at \"<host>:<port>\" (@IP),
<port> failed: server certificate for \"\*<host>:<port>\"
does not match host name \"<host>:<port>\"
```

If you get this error that time please pass `{'sslmode': 'verify-ca'}` in the connection arguments.

{% image
src="/images/v1.8/connectors/redshift/service-connection-arguments.png"
alt="Configure service connection"
caption="Configure the service connection by filling the form" /%}

### Metdata Ingestion Failure

If your metadata ingesiton fails and you have errors like:

```text
RuntimeError: Table entity not found: [<default>.pg_class]
RuntimeError: Table entity not found: [<default>.pg_constraint]
```

This is because the schema `information_schema` is being ingested and the ingestion bot does not have the permissions
to access it. It is recommended to exclude the schema `information_schema` unless you explicitly need to ingest it
like in [the example config](https://github.com/open-metadata/OpenMetadata/blob/2477bbc9ca398c33703c85627cdd26bc2c27aad3/ingestion/src/metadata/examples/workflows/redshift.yaml#L16).

```yaml
# ...
source:
  # ...
  type: redshift
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        excludes:
        - information_schema.*
# ...
```