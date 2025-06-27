---
title: Nifi Connector Troubleshooting
slug: /connectors/pipeline/nifi/troubleshooting
---

{% partial file="/v1.9/connectors/troubleshooting.md" /%}

Learn how to resolve the most common problems people encounter in the Nifi connector.

## No applicable policies could be found

If you see the error `No applicable policies could be found. Contact the system administrator` during the Test
Connection or when running the ingestion, you will need to add the missing policies in the Nifi instance.

You can find more information in this [link](https://community.cloudera.com/t5/Support-Questions/API-call-to-nifi-api-resources-results-in-quot-No-applicable/td-p/363534).

The accepted answer is to add a policy to `authorizations.xml` as follows:

```xml
<policy identifier="0c6d205e-9153-4bcd-9534-aeb029c65e10" resource="/resources" action="R">
    <group identifier="2c7ce5db-0186-1000-ffff-ffffdbb1315d"/>
</policy>
```
