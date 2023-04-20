---
title: Secrets Manager
slug: /deployment/secrets-manager/how-to-add-a-new-implementation
---

# How to add a new implementation

If we want to create our implementation of a Secrets Manager, we can do it in 3 simple steps.

## 1. Update the JSON schema

Create a new entry in the JSON schema definition of the Secrets Manager provider inside the `enum` property. 

```json
{
  "$id": "https://open-metadata.org/schema/entity/services/connections/metadata/secretsManagerProvider.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Secrets Manager Provider",
  "description": "OpenMetadata Secrets Manager Provider. Make sure to configure the same secrets manager providers as the ones configured on the OpenMetadata server.",
  "type": "string",
  "javaType": "org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider",
  "enum": ["noop", "managed-aws","aws", "managed-aws-ssm", "aws-ssm", "in-memory", "awesome-sm"],
  "additionalProperties": false
}
```

You can find [this](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/secretsManagerProvider.json) file here in the repository.

## 2. Update OM Server code

Once we have updated the JSON Schema, we can start implementing our Secrets Manager, extending the `ExternalSecretsManager.java` abstract class located [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-service/src/main/java/org/openmetadata/service/secrets/ThirdPartySecretsManager.java). For example:

```java
public abstract class AwesomeSecretsManager extends ExternalSecretsManager {

  protected AwesomeSecretsManager(String clusterPrefix) {
    super(SecretsManagerProvider.AWESOME_SM, clusterPrefix);
  }

  void storeSecret(String secretName, String secretValue) {
    // your implementation
  }
  void updateSecret(String secretName, String secretValue) {
    // your implementation
  }

  String getSecret(String secretName) {
    // your implementation
  }
}
```

After this, we can update `SecretsManagerFactory.java` which is a factory class. We can find this file [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-service/src/main/java/org/openmetadata/service/secrets/SecretsManagerFactory.java).

```java
...
    case AWESOME_SM:
      return AwesomeSecretsManager.getInstance(config, clusterName);
...
```

## 3. Update Python SDK code

The steps are similar to the Java ones. We have to extend the [following](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/utils/secrets/external_secrets_manager.py) `ExternalSecretsManager` abstract class as it is shown below:

```python
class AwesomeSecretsManager(ExternalSecretsManager, ABC):
    def __init__(
        self,
        cluster_prefix: str,
    ):
        super().__init__(cluster_prefix, SecretsManagerProvider.awesome-sm)

    @abstractmethod
    def get_string_value(self, name: str) -> str:
        # your implementation
        pass
```

Similar to what we did in step 2, we have to add our implementation to the factory class `ExternalSecretsManager` that can be found [here]():

```json
...
    elif secrets_manager_provider == SecretsManagerProvider.awesome-sm:
        return AwesomeSecretsManager(cluster_name)
...
```
<p/><p/>

If you need support while implementing your Secret Manager client, do not hesitate to reach out to us on [Slack](https://slack.open-metadata.org/).
