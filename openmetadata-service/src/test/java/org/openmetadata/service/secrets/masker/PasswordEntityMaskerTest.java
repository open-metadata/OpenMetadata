package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.dashboard.DomoDashboardConnection;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.services.connections.database.CassandraConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig__1;
import org.openmetadata.schema.services.connections.drive.SftpConnection;
import org.openmetadata.schema.services.connections.drive.sftp.SftpBasicAuth;
import org.openmetadata.schema.services.connections.drive.sftp.SftpKeyAuth;
import org.openmetadata.schema.services.connections.mcp.McpConnection;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.service.exception.EntityMaskException;

public class PasswordEntityMaskerTest extends TestEntityMasker {
  private static final String TOKEN = "openmetadata-token";
  private static final String ALPHA_KEY = "alpha-api-key";
  private static final String BETA_KEY = "beta-api-key";
  private static final String SFTP_PASSWORD = "openmetadata-sftp-secret";

  public PasswordEntityMaskerTest() {
    CONFIG.setMaskPasswordsAPI(true);
  }

  @Override
  protected String getMaskedPassword() {
    return PasswordEntityMasker.PASSWORD_MASK;
  }

  @Test
  void testDomoDeveloperTokenIsMaskedAndRestored() {
    DomoDashboardConnection original = new DomoDashboardConnection().withAccessToken(TOKEN);

    DomoDashboardConnection masked =
        (DomoDashboardConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "DomoDashboard", ServiceType.DASHBOARD);
    assertEquals(getMaskedPassword(), masked.getAccessToken());

    DomoDashboardConnection restored =
        (DomoDashboardConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(
                    masked, original, "DomoDashboard", ServiceType.DASHBOARD);
    assertEquals(TOKEN, restored.getAccessToken());
  }

  @Test
  void testLookerDisplayUrlIsAcceptedWhenRestoringSecrets() {
    Map<String, Object> updated =
        Map.of(
            "type", "Looker",
            "clientId", "test-client",
            "clientSecret", getMaskedPassword(),
            "hostPort", "https://api.example.com",
            "displayUrl", "https://ui.example.com");
    LookerConnection original =
        new LookerConnection()
            .withClientId("test-client")
            .withClientSecret(TOKEN)
            .withHostPort(URI.create("https://api.example.com"));

    LookerConnection restored =
        (LookerConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(updated, original, "Looker", ServiceType.DASHBOARD);

    assertEquals(URI.create("https://ui.example.com"), restored.getDisplayUrl());
    assertEquals(TOKEN, restored.getClientSecret());
  }

  @Test
  void testAstraTokenIsMaskedAndRestored() {
    CloudConfig cloudConfig =
        new CloudConfig().withCloudConfig(new CloudConfig__1().withToken(TOKEN));
    CassandraConnection original = new CassandraConnection().withAuthType(cloudConfig);

    CassandraConnection masked =
        (CassandraConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "Cassandra", ServiceType.DATABASE);
    assertEquals(getMaskedPassword(), astraToken(masked));

    CassandraConnection restored =
        (CassandraConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(masked, original, "Cassandra", ServiceType.DATABASE);
    assertEquals(TOKEN, astraToken(restored));
  }

  private String astraToken(CassandraConnection connection) {
    return ((CloudConfig) connection.getAuthType()).getCloudConfig().getToken();
  }

  /**
   * Secrets inside a collection are restored by element identity, not by position. Keying on
   * position means deleting the first of two servers shifts the second into slot 0, so it would be
   * handed the deleted server's key while its own is lost.
   */
  @Test
  void testCollectionSecretsFollowTheElementNotThePosition() {
    McpConnection original =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("alpha").withApiKey(ALPHA_KEY),
                    new McpServerConfig().withName("beta").withApiKey(BETA_KEY)));
    // What the edit form sends back after deleting "alpha": "beta" alone, key still masked.
    McpConnection edited =
        new McpConnection()
            .withServers(
                List.of(new McpServerConfig().withName("beta").withApiKey(getMaskedPassword())));

    McpConnection restored =
        (McpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(edited, original, "Mcp", ServiceType.MCP);

    assertEquals(1, restored.getServers().size());
    assertEquals(BETA_KEY, restored.getServers().getFirst().getApiKey());
  }

  /** Reordering must not swap the two servers' keys either. */
  @Test
  void testCollectionSecretsSurviveReordering() {
    McpConnection original =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("alpha").withApiKey(ALPHA_KEY),
                    new McpServerConfig().withName("beta").withApiKey(BETA_KEY)));
    McpConnection reordered =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("beta").withApiKey(getMaskedPassword()),
                    new McpServerConfig().withName("alpha").withApiKey(getMaskedPassword())));

    McpConnection restored =
        (McpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(reordered, original, "Mcp", ServiceType.MCP);

    assertEquals(BETA_KEY, restored.getServers().get(0).getApiKey());
    assertEquals(ALPHA_KEY, restored.getServers().get(1).getApiKey());
  }

  /**
   * A name is only an identity if it is unique, and the schema does not enforce that. Two servers
   * sharing a name must not share a key, or one secret would overwrite the other and both entries
   * would come back holding the survivor.
   */
  @Test
  void testDuplicateNamesDoNotShareASecret() {
    McpConnection original =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("dup").withApiKey(ALPHA_KEY),
                    new McpServerConfig().withName("dup").withApiKey(BETA_KEY)));
    McpConnection edited =
        new McpConnection()
            .withServers(
                List.of(
                    new McpServerConfig().withName("dup").withApiKey(getMaskedPassword()),
                    new McpServerConfig().withName("dup").withApiKey(getMaskedPassword())));

    McpConnection restored =
        (McpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(edited, original, "Mcp", ServiceType.MCP);

    assertEquals(ALPHA_KEY, restored.getServers().get(0).getApiKey());
    assertEquals(BETA_KEY, restored.getServers().get(1).getApiKey());
  }

  @Test
  void testSftpPasswordIsMaskedAndRestored() {
    SftpConnection original =
        new SftpConnection()
            .withHost("sftp.example.com")
            .withAuthType(
                new SftpBasicAuth().withUsername("sftp-user").withPassword(SFTP_PASSWORD));

    SftpConnection masked =
        (SftpConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "Sftp", ServiceType.DRIVE);
    assertEquals(getMaskedPassword(), sftpPassword(masked));
    assertEquals("sftp-user", sftpAuth(masked).getUsername());

    SftpConnection restored =
        (SftpConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(masked, original, "Sftp", ServiceType.DRIVE);
    assertEquals(SFTP_PASSWORD, sftpPassword(restored));
  }

  /** The config arrives from the database as a map, which is what used to defeat the masker. */
  @Test
  void testSftpPrivateKeyFromSerializedConfigIsMasked() {
    Map<String, Object> serialized =
        Map.of(
            "host",
            "sftp.example.com",
            "authType",
            Map.of("username", "sftp-user", "privateKey", SFTP_PASSWORD));

    SftpConnection masked =
        (SftpConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(serialized, "Sftp", ServiceType.DRIVE);

    assertEquals(getMaskedPassword(), ((SftpKeyAuth) masked.getAuthType()).getPrivateKey());
  }

  private SftpBasicAuth sftpAuth(SftpConnection connection) {
    return (SftpBasicAuth) connection.getAuthType();
  }

  private String sftpPassword(SftpConnection connection) {
    return sftpAuth(connection).getPassword();
  }

  @Test
  void testExceptionConnection() {
    Map<String, Object> mysqlConnectionObject =
        Map.of(
            "authType", Map.of("password", "openmetadata-test"), "username1", "openmetadata-test");

    EntityMaskException thrown =
        Assertions.assertThrows(
            EntityMaskException.class,
            () ->
                EntityMaskerFactory.createEntityMasker()
                    .maskServiceConnectionConfig(
                        mysqlConnectionObject, "Mysql", ServiceType.DATABASE));

    assertEquals(
        "Failed to mask 'Mysql' connection stored in DB due to an unrecognized field: 'username1'",
        thrown.getMessage());

    thrown =
        Assertions.assertThrows(
            EntityMaskException.class,
            () ->
                EntityMaskerFactory.createEntityMasker()
                    .unmaskServiceConnectionConfig(
                        mysqlConnectionObject,
                        new MysqlConnection(),
                        "Mysql",
                        ServiceType.DATABASE));

    assertEquals(
        "Failed to unmask 'Mysql' connection stored in DB due to an unrecognized field: 'username1'",
        thrown.getMessage());
  }
}
