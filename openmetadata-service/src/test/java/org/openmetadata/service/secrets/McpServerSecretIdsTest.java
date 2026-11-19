package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.mcp.McpConnection;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

/**
 * MCP server keys round-tripped through an external secrets manager, with a real Fernet key.
 * {@code Prod} and {@code prod} clean into one secret id, so each is stored under an id from its
 * exact name, which does not move when the servers are reordered.
 */
class McpServerSecretIdsTest {
  private static final String FERNET_KEY = "-uvd2sz2yfe3XoJZnBk3Aw9o_CjL36hHv_yFJlZL3-g=";
  private static final String SERVICE = "mcp_secret_ids";

  private InMemorySecretsManager secretsManager;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    secretsManager =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    secretsManager.setFernet(Fernet.getInstance());
  }

  @Test
  void reorderingServersThatShareACleanedNameThenReplacingOneKeyKeepsTheOther() {
    final McpConnection created =
        encrypt(List.of(server("Prod", "prod-upper-key"), server("prod", "prod-key")));

    final McpServerConfig upper = copy(created.getServers().getFirst()).withApiKey("replaced-key");
    final McpConnection updated = encrypt(List.of(copy(created.getServers().get(1)), upper));

    assertEquals("prod-key", storedKey(updated, "prod"));
    assertEquals("replaced-key", storedKey(updated, "Prod"));
  }

  @Test
  void reorderingServersThatShareACleanedNameThenClearingOneKeyKeepsTheOther() {
    final McpConnection created =
        encrypt(List.of(server("Prod", "prod-upper-key"), server("prod", "prod-key")));

    final McpServerConfig upper = copy(created.getServers().getFirst()).withApiKey("");
    final McpConnection updated = encrypt(List.of(copy(created.getServers().get(1)), upper));

    assertEquals("prod-key", storedKey(updated, "prod"));
  }

  @Test
  void addingAServerThatSharesACleanedNameThenEditingKeepsEachKey() {
    final McpConnection created = encrypt(List.of(server("Prod", "prod-upper-key")));
    final McpConnection added =
        encrypt(List.of(server("prod", "prod-key"), copy(created.getServers().getFirst())));

    final McpServerConfig lower = copy(added.getServers().getFirst()).withApiKey("replaced-key");
    final McpConnection updated = encrypt(List.of(copy(added.getServers().get(1)), lower));

    assertEquals("prod-upper-key", storedKey(updated, "Prod"));
    assertEquals("replaced-key", storedKey(updated, "prod"));
  }

  private McpConnection encrypt(final List<McpServerConfig> servers) {
    return (McpConnection)
        secretsManager.encryptServiceConnectionConfig(
            new McpConnection().withServers(servers), "Mcp", SERVICE, ServiceType.MCP);
  }

  private String storedKey(final McpConnection connection, final String name) {
    final String apiKey =
        connection.getServers().stream()
            .filter(server -> name.equals(server.getName()))
            .findFirst()
            .orElseThrow()
            .getApiKey();
    final String reference =
        Fernet.isTokenized(apiKey) ? Fernet.getInstance().decrypt(apiKey) : apiKey;
    return secretsManager.getSecretValue(reference);
  }

  private static McpServerConfig server(final String name, final String apiKey) {
    return new McpServerConfig()
        .withName(name)
        .withUrl("https://" + name + ".example.com/mcp")
        .withApiKey(apiKey);
  }

  private static McpServerConfig copy(final McpServerConfig server) {
    return JsonUtils.deepCopy(server, McpServerConfig.class);
  }
}
