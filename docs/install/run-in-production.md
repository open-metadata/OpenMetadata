---
description: >-
  This installation doc will help you start a OpenMetadata instances
  on your production.
---


# Run in production

Please refer to the previous section [Run Openmetadata](install/run-openmetadata.md) for configuring OpenMetadata.

{% hint style="info" %}
**Prerequisites**

* MySQL &gt;= 8.x
* ElasticSearch &gt;= 7.x
* Airflow or other schedulers to run Ingestion Connectors

{% endhint %}


## Start OpenMetadata

OpenMetadata release ships with ```./bin/openmetadata``` init.d style 
script. 

```text
cd openmetdata-0.3.0
./bin/openmetdata start
```

We recommend to configure serviced to monitor openmetadata command to restart
incase of any failures.


## Running with a load balancer

One or more OpenMetadata instances can be put behind a load balancer for reverse proxying,
in that case appropriate OpenMetdata url must be mentioned in the load balancer's configuraiton file.

For example, in case Apache mod proxy the VirtualHost tag in the configuration file should be
edited out with the following

```text

  <VirtualHost *:80>
  <Proxy balancer://mycluster>
      BalancerMember http://127.0.0.1:8585 <!-- First OpenMetadata server -->
      BalancerMember http://127.0.0.2:8686 <!-- Second OpenMetadata server -->
  </Proxy>

      ProxyPreserveHost On

      ProxyPass / balancer://mycluster/
      ProxyPassReverse / balancer://mycluster/
  </VirtualHost>
  ```
  