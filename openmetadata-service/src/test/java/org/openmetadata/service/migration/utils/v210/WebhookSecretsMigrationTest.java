package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.endsWith;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
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
import org.mockito.MockedStatic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationHaltException;
import org.openmetadata.service.migration.utils.MigrationTableUtil;

/**
 * The 2.1.0 data migration stops, before any step writes, when the credentials earlier releases
 * stored encrypted exist and none of them opens with the configured keys; the alert step itself
 * carries over what opens and leaves the rest as stored.
 */
class WebhookSecretsMigrationTest {
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String PREVIOUS_KEY = "ihZpp5gmmDvVsgoOG6OVivKWwC9vd5JQ5x4uDcWn7mY=";
  private static final String VERSION = "2.1.0";
  private static final String ALERT_TABLE = "event_subscription_entity";

  private final Handle handle = mock(Handle.class);
  private final MigrationDAO migrationDAO = mock(MigrationDAO.class);
  private final PreparedBatch batch = mock(PreparedBatch.class, RETURNS_SELF);
  private final List<Map<String, Object>> alertRows = new ArrayList<>();
  private boolean hasAlertTable = true;
  private boolean hasMigrationLog = true;
  private MockedStatic<MigrationTableUtil> tableUtil;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
    Query query = mock(Query.class, RETURNS_SELF);
    ResultIterable<Map<String, Object>> rows = mock(ResultIterable.class);
    ResultIterable<String> ids = mock(ResultIterable.class);
    when(handle.createQuery(anyString())).thenReturn(query);
    tableUtil = mockStatic(MigrationTableUtil.class);
    tableUtil
        .when(() -> MigrationTableUtil.tableExists(eq(handle), anyString()))
        .thenAnswer(
            invocation ->
                ALERT_TABLE.equals(invocation.getArgument(1)) ? hasAlertTable : hasMigrationLog);
    when(query.mapToMap()).thenReturn(rows);
    when(rows.list()).thenReturn(alertRows, List.of());
    when(query.mapTo(String.class)).thenReturn(ids);
    when(ids.list()).thenReturn(List.of());
    when(handle.prepareBatch(anyString())).thenReturn(batch);
    when(batch.size()).thenReturn(1);
  }

  @AfterEach
  void tearDown() {
    tableUtil.close();
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void stopsBeforeAnythingIsWrittenWhenNoEarlierCredentialOpens() {
    UUID alertId = UUID.randomUUID();
    alertRows.add(alertRow(alertId, "signed", writtenWithThePreviousKey("a signing key")));

    MigrationHaltException stopped =
        assertThrows(
            MigrationHaltException.class,
            () ->
                WebhookSecretsMigration.requireKeysThatOpenStoredCredentials(
                    migrationDAO, VERSION, handle, ConnectionType.POSTGRES));

    assertTrue(stopped.getMessage().contains("FERNET_KEY"), stopped.getMessage());
    assertTrue(
        stopped.getMessage().contains(WebhookSecretsMigration.KEEP_UNOPENED_ENV),
        stopped.getMessage());
    assertTrue(stopped.getMessage().contains("'signed' (" + alertId + ")"), stopped.getMessage());
    verify(handle, never()).prepareBatch(anyString());
  }

  @Test
  void goesOnWhenSomeEarlierCredentialsOpen() {
    alertRows.add(alertRow(UUID.randomUUID(), "opens", Fernet.getInstance().encrypt("a key")));
    alertRows.add(alertRow(UUID.randomUUID(), "does_not_open", writtenWithThePreviousKey("k")));

    assertDoesNotThrow(
        () ->
            WebhookSecretsMigration.requireKeysThatOpenStoredCredentials(
                migrationDAO, VERSION, handle, ConnectionType.POSTGRES));
  }

  @Test
  void goesOnWhenNoEarlierCredentialIsStored() {
    alertRows.add(alertRow(UUID.randomUUID(), "plain", "a key entered in the clear"));

    assertDoesNotThrow(
        () ->
            WebhookSecretsMigration.requireKeysThatOpenStoredCredentials(
                migrationDAO, VERSION, handle, ConnectionType.POSTGRES));
  }

  // Once the alert step has run, the values left as stored are the ones that did not open.
  @Test
  void isNotRunAgainOnceTheAlertStepIsRecorded() {
    alertRows.add(alertRow(UUID.randomUUID(), "left", writtenWithThePreviousKey("a key")));
    when(migrationDAO.getSqlQuery(
            eq(VERSION), endsWith(":" + WebhookSecretsMigration.ALERT_STEP_NAME)))
        .thenReturn("-- recorded");

    assertDoesNotThrow(
        () ->
            WebhookSecretsMigration.requireKeysThatOpenStoredCredentials(
                migrationDAO, VERSION, handle, ConnectionType.POSTGRES));
  }

  // A database still on the earliest migrations has alerts but no migration log yet.
  @Test
  void runsWithoutAMigrationLogAndReadsItOnlyOnceItExists() {
    hasMigrationLog = false;
    alertRows.add(alertRow(UUID.randomUUID(), "opens", Fernet.getInstance().encrypt("a key")));
    when(migrationDAO.getSqlQuery(anyString(), anyString()))
        .thenThrow(new IllegalStateException("SERVER_MIGRATION_SQL_LOGS does not exist"));

    assertDoesNotThrow(
        () ->
            WebhookSecretsMigration.requireKeysThatOpenStoredCredentials(
                migrationDAO, VERSION, handle, ConnectionType.POSTGRES));
  }

  // The operator's choice reads nothing, so no table a database lacks can stop it.
  @Test
  void theOperatorsChoiceToKeepUnopenedValuesReadsNothing() {
    when(migrationDAO.getSqlQuery(anyString(), anyString()))
        .thenThrow(new IllegalStateException("SERVER_MIGRATION_SQL_LOGS does not exist"));
    when(handle.createQuery(anyString()))
        .thenThrow(new IllegalStateException("event_subscription_entity does not exist"));
    tableUtil
        .when(() -> MigrationTableUtil.tableExists(eq(handle), anyString()))
        .thenThrow(new IllegalStateException("no table is read"));

    assertDoesNotThrow(
        () ->
            WebhookSecretsMigration.requireKeysThatOpenStoredCredentials(
                migrationDAO, VERSION, handle, ConnectionType.POSTGRES, true));
  }

  @Test
  void isNotRunOnADatabaseWithoutAlertsYet() {
    hasAlertTable = false;
    alertRows.add(alertRow(UUID.randomUUID(), "unread", writtenWithThePreviousKey("a key")));

    assertDoesNotThrow(
        () ->
            WebhookSecretsMigration.requireKeysThatOpenStoredCredentials(
                migrationDAO, VERSION, handle, ConnectionType.POSTGRES));
  }

  // A run of the alert step that did not finish bound some credentials; they opened.
  @Test
  void countsACredentialAnUnfinishedStepAlreadyCarriedOverAsOpened() {
    alertRows.add(alertRow(UUID.randomUUID(), "unread", writtenWithThePreviousKey("a key")));
    alertRows.add(
        carriedOver(alertRow(UUID.randomUUID(), "bound", Fernet.getInstance().encrypt("a key"))));

    assertDoesNotThrow(
        () ->
            WebhookSecretsMigration.requireKeysThatOpenStoredCredentials(
                migrationDAO, VERSION, handle, ConnectionType.POSTGRES));
  }

  @Test
  void namesARowItCannotRead() {
    alertRows.add(Map.of("id", "an-unreadable-row", "json", "{not json"));

    IllegalStateException stopped =
        assertThrows(
            IllegalStateException.class,
            () ->
                WebhookSecretsMigration.requireKeysThatOpenStoredCredentials(
                    migrationDAO, VERSION, handle, ConnectionType.POSTGRES));

    assertTrue(stopped.getMessage().contains("an-unreadable-row"), stopped.getMessage());
  }

  @Test
  void theAlertStepCarriesOverWhatOpensAndKeepsTheRest() {
    String notOpened = writtenWithThePreviousKey("a signing key");
    alertRows.add(alertRow(UUID.randomUUID(), "opens", Fernet.getInstance().encrypt("a key")));
    alertRows.add(alertRow(UUID.randomUUID(), "does_not_open", notOpened));

    WebhookSecretsMigration.bindAlertDestinationSecrets(handle, ConnectionType.POSTGRES);

    List<String> written = writtenJson();
    assertEquals(2, written.size());
    assertTrue(written.get(0).contains(StoredWebhookSecrets.BOUND_PREFIX), written.get(0));
    assertTrue(written.get(1).contains(notOpened), written.get(1));
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

  // The row as the alert step leaves it once it has carried over its credential.
  private static Map<String, Object> carriedOver(Map<String, Object> row) {
    JsonNode alert = JsonUtils.readTree(String.valueOf(row.get("json")));
    new StoredWebhookSecrets(Fernet.getInstance().getCachedKeys()).bindAlert(alert);
    return Map.of("id", row.get("id"), "json", alert.toString());
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
