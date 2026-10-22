package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.URISyntaxException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.CreateMetadataService;
import org.openmetadata.schema.api.services.CreateMetadataService.MetadataServiceType;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.services.connections.metadata.AmundsenConnection;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

/**
 * The credential fields of a service connection only accept a value the service itself holds: a
 * plain value on create or update, the masked placeholder the UI echoes back on save, or — for
 * unmask-permitted callers — the value the unmask call handed them. An encoded value minted
 * outside the request has no owner in this entity, so the write is rejected with a 400 that names
 * the field instead of being stored as the service's credential.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SecretsManagerCredentialValidationIT {

  private static final String METADATA_SERVICES_PATH = "/v1/services/metadataServices";

  @Test
  void putCreateOrUpdateRejectsAnEncryptedCredentialMintedOutsideTheRequest(TestNamespace ns) {
    String foreignToken = Fernet.getInstance().encrypt("credential of another context");
    CreateMetadataService request = createRequest(ns.prefix("reject_foreign_token"));
    amundsenConnection(request).setPassword(foreignToken);

    InvalidRequestException rejected =
        assertThrows(
            InvalidRequestException.class,
            () -> putCreateOrUpdate(request),
            "a create must not adopt an encrypted credential minted outside the request");
    assertRejectedValue(rejected, foreignToken);
  }

  @Test
  void putUpdateRejectsAnEncryptedCredentialMintedOutsideTheRequest(TestNamespace ns) {
    CreateMetadataService request = createRequest(ns.prefix("reject_foreign_token_update"));
    MetadataService created = putCreateOrUpdate(request);
    assertNotNull(created, "a plain credential must still create the service");

    String foreignToken = Fernet.getInstance().encrypt("credential of another context");
    amundsenConnection(request).setPassword(foreignToken);

    InvalidRequestException rejected =
        assertThrows(
            InvalidRequestException.class,
            () -> putCreateOrUpdate(request),
            "an update must not replace the stored credential with one minted outside the request");
    assertRejectedValue(rejected, foreignToken);
  }

  @Test
  void putUpdateAcceptsTheMaskedPlaceholderAndPlainValues(TestNamespace ns) {
    CreateMetadataService request = createRequest(ns.prefix("mask_round_trip"));
    putCreateOrUpdate(request);

    amundsenConnection(request).setPassword(PasswordEntityMasker.PASSWORD_MASK);
    MetadataService echoed = putCreateOrUpdate(request);
    assertNotNull(echoed, "echoing the masked placeholder back on save must keep the service");

    amundsenConnection(request).setPassword("a-new-plain-password");
    MetadataService updated = putCreateOrUpdate(request);
    assertNotNull(updated, "changing the credential to a new plain value must succeed");
  }

  private static void assertRejectedValue(InvalidRequestException rejected, String rejectedValue) {
    assertEquals(400, rejected.getStatusCode());
    String message = rejected.getResponseBody();
    assertTrue(message != null && message.contains("Password"), message);
    assertFalse(message.contains(rejectedValue), "the rejection must not echo the rejected value");
  }

  private static MetadataService putCreateOrUpdate(CreateMetadataService body) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, METADATA_SERVICES_PATH, body, MetadataService.class);
  }

  private static AmundsenConnection amundsenConnection(CreateMetadataService request) {
    return (AmundsenConnection) request.getConnection().getConfig();
  }

  private static CreateMetadataService createRequest(String serviceName) {
    try {
      AmundsenConnection connection =
          new AmundsenConnection()
              .withHostPort(new URI("bolt://localhost:7687"))
              .withUsername("test")
              .withPassword("test");
      return new CreateMetadataService()
          .withName(serviceName)
          .withServiceType(MetadataServiceType.Amundsen)
          .withConnection(new MetadataConnection().withConfig(connection));
    } catch (URISyntaxException e) {
      throw new RuntimeException(e);
    }
  }
}
