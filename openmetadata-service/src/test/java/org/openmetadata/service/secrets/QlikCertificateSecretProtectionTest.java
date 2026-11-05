package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.dashboard.QlikSenseConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityMaskException;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

class QlikCertificateSecretProtectionTest {
  private static final String SECRET = "qlik-certificate-secret";
  private static final String SECRET_PATH = "/certificates/sslConfig/sslKey";
  private DBSecretsManager manager;

  @BeforeEach
  void configureSecretsManager() {
    Fernet.getInstance().setFernetKey("GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=");
    manager =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    manager.setFernet(Fernet.getInstance());
  }

  @Test
  void encryptsCertificateWithUndeclaredNestedField() {
    Object encrypted =
        manager.encryptServiceConnectionConfig(
            connection(SECRET), "QlikSense", "qlik", ServiceType.DASHBOARD);

    String encryptedKey = JsonUtils.valueToTree(encrypted).at(SECRET_PATH).asText();
    assertTrue(Fernet.isTokenized(encryptedKey));
    assertEquals(SECRET, Fernet.getInstance().decrypt(encryptedKey));
    assertFalse(JsonUtils.pojoToJson(encrypted).contains(SECRET));
  }

  @Test
  void masksCertificateWithUndeclaredNestedField() {
    Object masked =
        EntityMaskerFactory.createEntityMasker()
            .maskServiceConnectionConfig(connection(SECRET), "QlikSense", ServiceType.DASHBOARD);

    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK, JsonUtils.valueToTree(masked).at(SECRET_PATH).asText());
    assertFalse(JsonUtils.pojoToJson(masked).contains(SECRET));
  }

  @Test
  void rejectsMalformedCertificateDuringEncryption() {
    assertThrows(
        InvalidServiceConnectionException.class,
        () ->
            manager.encryptServiceConnectionConfig(
                connection(Map.of("credential", SECRET)),
                "QlikSense",
                "qlik",
                ServiceType.DASHBOARD));
  }

  @Test
  void rejectsMalformedCertificateDuringMasking() {
    assertThrows(
        EntityMaskException.class,
        () ->
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(
                    connection(Map.of("credential", SECRET)), "QlikSense", ServiceType.DASHBOARD));
  }

  @Test
  void acceptsDeclaredCertificatePaths() {
    Object converted =
        ClassConverterFactory.getConverter(QlikSenseConnection.class)
            .convert(
                Map.of(
                    "type",
                    "QlikSense",
                    "certificates",
                    Map.of(
                        "clientCertificate", "/certs/client.pem",
                        "clientKeyCertificate", "/certs/key.pem",
                        "rootCertificate", "/certs/root.pem")));

    assertEquals(
        "/certs/client.pem",
        JsonUtils.valueToTree(converted).at("/certificates/clientCertificate").asText());
    assertEquals(
        "/certs/key.pem",
        JsonUtils.valueToTree(converted).at("/certificates/clientKeyCertificate").asText());
    assertEquals(
        "/certs/root.pem",
        JsonUtils.valueToTree(converted).at("/certificates/rootCertificate").asText());
  }

  private static Map<String, Object> connection(Object sslKey) {
    return Map.of(
        "type", "QlikSense",
        "hostPort", "wss://qlik.example.com",
        "certificates", Map.of("sslConfig", Map.of("sslKey", sslKey, "unexpected", true)));
  }
}
