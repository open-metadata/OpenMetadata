package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.result.ResultIterable;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.jdbi.v3.core.statement.Query;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * The alert step stops, before it writes anything, when the credentials earlier releases stored
 * encrypted exist and none of them opens with the configured keys.
 */
class WebhookSecretsMigrationTest {
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String PREVIOUS_KEY = "ihZpp5gmmDvVsgoOG6OVivKWwC9vd5JQ5x4uDcWn7mY=";

  private final Handle handle = mock(Handle.class);
  private final PreparedBatch batch = mock(PreparedBatch.class, RETURNS_SELF);
  private final List<Map<String, Object>> alertRows = new ArrayList<>();

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
    Query query = mock(Query.class, RETURNS_SELF);
    ResultIterable<Map<String, Object>> rows = mock(ResultIterable.class);
    ResultIterable<String> ids = mock(ResultIterable.class);
    when(handle.createQuery(anyString())).thenReturn(query);
    when(query.mapToMap()).thenReturn(rows);
    when(rows.list()).thenReturn(alertRows, List.of());
    when(query.mapTo(String.class)).thenReturn(ids);
    when(ids.list()).thenReturn(List.of());
    when(handle.prepareBatch(anyString())).thenReturn(batch);
    when(batch.size()).thenReturn(1);
  }

  @AfterEach
  void tearDown() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void stopsBeforeWritingWhenNoEarlierCredentialOpens() {
    UUID alertId = UUID.randomUUID();
    alertRows.add(alertRow(alertId, "signed", writtenWithThePreviousKey("a signing key")));

    IllegalStateException stopped =
        assertThrows(
            IllegalStateException.class,
            () ->
                WebhookSecretsMigration.bindAlertDestinationSecrets(
                    handle, ConnectionType.POSTGRES));

    assertTrue(stopped.getMessage().contains("FERNET_KEY"), stopped.getMessage());
    assertTrue(
        stopped.getMessage().contains(WebhookSecretsMigration.KEEP_UNOPENED_ENV),
        stopped.getMessage());
    assertTrue(stopped.getMessage().contains("'signed' (" + alertId + ")"), stopped.getMessage());
    verify(handle, never()).prepareBatch(anyString());
  }

  @Test
  void continuesWhenTheOperatorChoseToKeepCredentialsThatDoNotOpen() {
    String notOpened = writtenWithThePreviousKey("a signing key");
    alertRows.add(alertRow(UUID.randomUUID(), "kept", notOpened));

    WebhookSecretsMigration.bindAlertDestinationSecrets(handle, ConnectionType.POSTGRES, true);

    List<String> written = writtenJson();
    assertEquals(1, written.size());
    assertTrue(written.getFirst().contains(notOpened), written.getFirst());
  }

  @Test
  void continuesWhenSomeEarlierCredentialsOpen() {
    String notOpened = writtenWithThePreviousKey("a signing key");
    alertRows.add(alertRow(UUID.randomUUID(), "opens", Fernet.getInstance().encrypt("a key")));
    alertRows.add(alertRow(UUID.randomUUID(), "does_not_open", notOpened));

    WebhookSecretsMigration.bindAlertDestinationSecrets(handle, ConnectionType.POSTGRES);

    List<String> written = writtenJson();
    assertEquals(2, written.size());
    assertTrue(written.get(0).contains(StoredWebhookSecrets.BOUND_PREFIX), written.get(0));
    assertTrue(written.get(1).contains(notOpened), written.get(1));
  }

  @Test
  void continuesWhenNoEarlierCredentialIsStored() {
    alertRows.add(alertRow(UUID.randomUUID(), "plain", "a key entered in the clear"));

    WebhookSecretsMigration.bindAlertDestinationSecrets(handle, ConnectionType.POSTGRES);

    List<String> written = writtenJson();
    assertEquals(1, written.size());
    assertTrue(written.getFirst().contains(StoredWebhookSecrets.BOUND_PREFIX), written.getFirst());
  }

  private List<String> writtenJson() {
    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    verify(batch, atLeastOnce()).bind(eq("json"), json.capture());
    return json.getAllValues();
  }

  private static String writtenWithThePreviousKey(String secret) {
    Fernet.getInstance().setFernetKey(PREVIOUS_KEY);
    String ciphertext = Fernet.getInstance().encrypt(secret);
    Fernet.getInstance().setFernetKey(KEY);
    return ciphertext;
  }

  private static Map<String, Object> alertRow(UUID id, String name, String signingKey) {
    JsonNode alert =
        JsonUtils.readTree(
            """
            {"id": "%s", "name": "%s", "destinations": [
              {"id": "%s", "type": "Webhook", "enabled": true,
               "config": {"endpoint": "https://hooks.example.com/%s",
                          "authType": {"type": "bearer", "secretKey": "%s"}}}]}"""
                .formatted(id, name, UUID.randomUUID(), name, signingKey));
    return Map.of("id", id.toString(), "json", alert.toString());
  }
}
