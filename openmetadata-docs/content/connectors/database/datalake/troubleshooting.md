---
title: Datalake Connector Troubleshooting
slug: /connectors/database/datalake/troubleshooting
---

# Troubleshooting

Learn how to resolve the most common problems people encounter in the Datalake connector.

* ** 'Access Denied' error when reading from S3 bucket **

Please, ensure you have a Bucket Policy with the permissions explained in the requirement section [here](/connectors/database/datalake).


#### ** 'Azure Datalake' ** credentials details

##### Where can I find 'Client Secret' from.

- Login to `Azure Portal`
- Find and click on your application 
- Select `Certificates & Secret` under `Manage` Section

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/datalake/troubleshoot-clientId.webp"
  alt="Configure service connection"
  caption="Find Client ID"
/>
</div>


