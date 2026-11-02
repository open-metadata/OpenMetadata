package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.dashboard.DomoDashboardConnection;
import org.openmetadata.schema.services.connections.database.CassandraConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig;
import org.openmetadata.schema.services.connections.database.cassandra.CloudConfig__1;
import org.openmetadata.schema.services.connections.mcp.McpConnection;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.exception.EntityMaskException;

public class PasswordEntityMaskerTest extends TestEntityMasker {
  private static final String ALPHA_KEY = "alpha-api-key";
  private static final String BETA_KEY = "beta-api-key";

  private static final String TOKEN = "openmetadata-token";

  public PasswordEntityMaskerTest() {
    CONFIG.setMaskPasswordsAPI(true);
  }

  @Override
  protected String getMaskedPassword() {
    return PasswordEntityMasker.PASSWORD_MASK;
  }

  @Test
  void testOpenMetadataServerJwtTokenIsMaskedAndRestored() {
    // OpenMetadataJWTClientConfig#jwtToken (the token embedded in a server connection) is a
    // @PasswordField: it must be masked for non-bot readers and restored on write.
    final OpenMetadataConnection original =
        new OpenMetadataConnection()
            .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken(TOKEN));

    final OpenMetadataConnection masked =
        (OpenMetadataConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(original, "OpenMetadata", ServiceType.METADATA);
    assertEquals(getMaskedPassword(), masked.getSecurityConfig().getJwtToken());

    final OpenMetadataConnection restored =
        (OpenMetadataConnection)
            EntityMaskerFactory.createEntityMasker()
                .unmaskServiceConnectionConfig(
                    masked, original, "OpenMetadata", ServiceType.METADATA);
    assertEquals(TOKEN, restored.getSecurityConfig().getJwtToken());
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
  void testNullListElementIsSkipped() {
    McpConnection mcpConnection =
        new McpConnection()
            .withServers(
                Arrays.asList(null, new McpServerConfig().withName("alpha").withApiKey(ALPHA_KEY)));

    McpConnection masked =
        (McpConnection)
            EntityMaskerFactory.createEntityMasker()
                .maskServiceConnectionConfig(mcpConnection, "Mcp", ServiceType.MCP);

    assertEquals(getMaskedPassword(), masked.getServers().get(1).getApiKey());
  }
}
