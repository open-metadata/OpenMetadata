package org.openmetadata.service.secrets;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import com.google.cloud.secretmanager.v1.SecretManagerServiceClient;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.fernet.Fernet;

@ExtendWith(MockitoExtension.class)
public class GCPSecretsManagerTest extends ExternalSecretsManagerTest {
  private MockedStatic<SecretManagerServiceClient> mocked;

  @BeforeEach
  void setUp() {
    Fernet fernet = Fernet.getInstance();
    fernet.setFernetKey("jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=");
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("projectId", "123456");
    SecretsManagerConfiguration config = new SecretsManagerConfiguration();
    config.setParameters(parameters);
    setUpSpecific(config);

    mocked = mockStatic(SecretManagerServiceClient.class);
    mocked
        .when(SecretManagerServiceClient::create)
        .thenReturn(mock(SecretManagerServiceClient.class));
  }

  @AfterEach
  void tearDown() {
    mocked.close();
  }

  @Override
  void setUpSpecific(SecretsManagerConfiguration config) {
    this.secretsManager =
        GCPSecretsManager.getInstance(
            new SecretsManager.SecretsConfig(
                "openmetadata",
                "prefix",
                List.of("key:value", "key2:value2"),
                config.getParameters()));
  }

  @Override
  protected SecretsManagerProvider expectedSecretManagerProvider() {
    return SecretsManagerProvider.GCP;
  }
}
