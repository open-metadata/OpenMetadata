package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import com.google.cloud.secretmanager.v1.AccessSecretVersionResponse;
import com.google.cloud.secretmanager.v1.Secret;
import com.google.cloud.secretmanager.v1.SecretManagerServiceClient;
import com.google.cloud.secretmanager.v1.SecretPayload;
import com.google.cloud.secretmanager.v1.SecretVersion;
import com.google.cloud.secretmanager.v1.SecretVersionName;
import com.google.protobuf.ByteString;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.fernet.Fernet;

@ExtendWith(MockitoExtension.class)
public class GCPSecretsManagerTest extends ExternalSecretsManagerTest {
  private MockedStatic<SecretManagerServiceClient> mocked;
  private final Map<String, String> mockSecretStorage = new HashMap<>();

  @BeforeEach
  void setUp() {
    Fernet fernet = Fernet.getInstance();
    fernet.setFernetKey("jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=");
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("projectId", "123456");
    SecretsManagerConfiguration config = new SecretsManagerConfiguration();
    config.setParameters(parameters);

    mockSecretStorage.clear();
    SecretManagerServiceClient mockClient = mock(SecretManagerServiceClient.class);
    mocked = mockStatic(SecretManagerServiceClient.class);
    mocked.when(SecretManagerServiceClient::create).thenReturn(mockClient);

    // Mock GCP client to simulate real storage and retrieval
    lenient()
        .when(mockClient.createSecret(any(String.class), any(String.class), any(Secret.class)))
        .thenReturn(Secret.newBuilder().build());

    lenient()
        .when(mockClient.addSecretVersion(any(String.class), any(SecretPayload.class)))
        .thenAnswer(
            invocation -> {
              String secretName = invocation.getArgument(0);
              SecretPayload payload = invocation.getArgument(1);
              mockSecretStorage.put(secretName, payload.getData().toStringUtf8());
              return SecretVersion.newBuilder().build();
            });

    lenient()
        .when(mockClient.accessSecretVersion(any(SecretVersionName.class)))
        .thenAnswer(
            invocation -> {
              SecretVersionName secretVersionName = invocation.getArgument(0);
              // Extract the secret name from SecretVersionName
              String secretName = secretVersionName.getSecret();
              String storedValue =
                  mockSecretStorage.computeIfAbsent(secretName, n -> "secret:" + n);

              // Calculate correct CRC32C checksum for the data
              byte[] data = storedValue.getBytes();
              java.util.zip.CRC32C checksum = new java.util.zip.CRC32C();
              checksum.update(data, 0, data.length);

              return AccessSecretVersionResponse.newBuilder()
                  .setPayload(
                      SecretPayload.newBuilder()
                          .setData(ByteString.copyFromUtf8(storedValue))
                          .setDataCrc32C(checksum.getValue()))
                  .build();
            });

    setUpSpecific(config);
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

  @Test
  void testEncryptBotTokenRevocationWithEmptyToken() {
    JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism().withJWTToken(StringUtils.EMPTY);
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuthMechanism);
    mockSecretStorage.clear();

    secretsManager.encryptAuthenticationMechanism("ingestion-bot", authMechanism);

    boolean hasEmptyPayload =
        mockSecretStorage.values().stream().anyMatch(value -> value.isEmpty());
    assertEquals(
        false,
        hasEmptyPayload,
        "Token revocation with empty string should not create empty secret payloads");
  }

  @Test
  void testEncryptBotTokenRevocationWithNullToken() {
    JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism().withJWTToken(null);
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuthMechanism);
    mockSecretStorage.clear();

    secretsManager.encryptAuthenticationMechanism("ingestion-bot", authMechanism);

    boolean hasEmptyPayload =
        mockSecretStorage.values().stream().anyMatch(value -> value.isEmpty());
    assertEquals(
        false,
        hasEmptyPayload,
        "Token revocation with null should not create empty secret payloads");
  }
}
