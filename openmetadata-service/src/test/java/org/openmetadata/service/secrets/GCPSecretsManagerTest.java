package org.openmetadata.service.secrets;

import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;

import java.util.List;

import static org.mockito.Mockito.reset;

public class GCPSecretsManagerTest extends ExternalSecretsManagerTest {
    @Override
    void setUpSpecific(SecretsManagerConfiguration config) {
        secretsManager =
                GCPSecretsManager.getInstance(
                        new SecretsManager.SecretsConfig(
                                "openmetadata", "prefix", List.of("key:value", "key2:value2"), null));
//        ((AWSSSMSecretsManager) secretsManager).setSsmClient(ssmClient);
//        reset(ssmClient);
    }

    @Override
    protected SecretsManagerProvider expectedSecretManagerProvider() {
        return SecretsManagerProvider.GCP;
    }
}
