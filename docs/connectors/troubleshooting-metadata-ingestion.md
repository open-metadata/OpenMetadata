# Troubleshooting Metadata Ingestion

## Ensure that your connector version and OpenMetadata version  match

Many errors in metadata ingestion can be the result of a version mismatch between your connector and the OpenMetadata server. Entities and other schemas evolve with each release of OpenMetadata.

Connector and OpenMetadata server versions are numbered using an `x.y.z` scheme. Where `x` is the major version, `y` is the minor version, and `z` is the patch version. Please ensure that your connector minor (`y`) version matches the minor version of your OpenMetadata deployment.

Run the following command to test your version of `openmetadata-ingestion`.

```bash
metadata --version
```

Use the information menu in your OpenMetadata deployment user interface to check the version of OpenMetadata. The figure below illustrates how to do this.

![](../.gitbook/assets/om-version.png)

### To Upgrade Your Connector

Run the following command, replacing `<connector name>` with the appropriate name for your connector. See the documentation for your connector if you are not sure what name to use.

```javascript
pip3 install --upgrade 'openmetadata-ingestion[<connector name>]'
```

### To Upgrade OpenMetadata

See [Upgrade OpenMetadata](../install/upgrade-openmetadata.md) to upgrade production and production-like deployments.

See [Upgrade OpenMetadata (Local Deployment)](https://docs.open-metadata.org/install/run-openmetadata#upgrade-openmetadata) to upgrade a test version of OpenMetadata deployed following the instructions in Run OpenMetadata.

