package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.function.Predicate;
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

  /**
   * A server renamed without touching its key keeps its reference until the next save, which moves
   * the key to the id of its new name: a server later added under the old name then gets an id that
   * no other server still reads.
   */
  @Test
  void aRenamedServerKeepsItsKeyWhenItsOldNameIsReusedLater() {
    final McpConnection created = encrypt(List.of(server("alpha", "alpha-key")));
    final McpConnection renamed =
        encrypt(List.of(copy(created.getServers().getFirst()).withName("beta")));

    final McpConnection reused =
        encrypt(List.of(copy(renamed.getServers().getFirst()), server("alpha", "new-alpha-key")));

    assertEquals("alpha-key", storedKey(reused, "beta"));
    assertEquals("new-alpha-key", storedKey(reused, "alpha"));
  }

  @Test
  void aRenamedServerKeepsItsKeyWhenItsOldNameIsReusedInTheSameSave() {
    final McpConnection created = encrypt(List.of(server("alpha", "alpha-key")));

    final McpConnection updated =
        encrypt(
            List.of(
                copy(created.getServers().getFirst()).withName("beta"),
                server("alpha", "new-alpha-key")));

    assertEquals("alpha-key", storedKey(updated, "beta"));
    assertEquals("new-alpha-key", storedKey(updated, "alpha"));
  }

  /** Swapping two names moves both keys before either is written, then an edit hits only one. */
  @Test
  void swappingServerNamesThenReplacingOneKeyKeepsTheOther() {
    final McpConnection created =
        encrypt(List.of(server("alpha", "alpha-key"), server("beta", "beta-key")));
    final McpConnection swapped =
        encrypt(
            List.of(
                copy(created.getServers().getFirst()).withName("beta"),
                copy(created.getServers().get(1)).withName("alpha")));

    final McpConnection edited =
        encrypt(
            List.of(
                copy(swapped.getServers().getFirst()),
                copy(swapped.getServers().get(1)).withApiKey("replaced-key")));

    assertEquals("alpha-key", storedKey(edited, "beta"));
    assertEquals("replaced-key", storedKey(edited, "alpha"));
  }

  /** Servers keyed by position keep their own keys through a reorder and a later edit. */
  @Test
  void reorderingServersKeyedByPositionThenReplacingOneKeyKeepsTheOther() {
    final McpConnection created =
        encrypt(
            List.of(
                server("dup", "first-key").withUrl("https://first/mcp"),
                server("dup", "second-key").withUrl("https://second/mcp")));
    final McpConnection reordered =
        encrypt(List.of(copy(created.getServers().get(1)), copy(created.getServers().getFirst())));

    final McpConnection edited =
        encrypt(
            List.of(
                copy(reordered.getServers().getFirst()).withApiKey("replaced-key"),
                copy(reordered.getServers().get(1))));

    assertEquals("replaced-key", storedKeyAt(edited, "https://second/mcp"));
    assertEquals("first-key", storedKeyAt(edited, "https://first/mcp"));
  }

  /** A reference a user gave to a secret outside the service is kept as it is. */
  @Test
  void aReferenceOutsideTheServiceIsNotMoved() {
    secretsManager.getSecretsMap().put("/shared/team/key", "shared-key");

    final McpConnection stored = encrypt(List.of(server("alpha", "secret:/shared/team/key")));

    assertEquals("secret:/shared/team/key", reference(stored.getServers().getFirst()));
    assertEquals("shared-key", storedKey(stored, "alpha"));
  }

  private McpConnection encrypt(final List<McpServerConfig> servers) {
    return (McpConnection)
        secretsManager.encryptServiceConnectionConfig(
            new McpConnection().withServers(servers), "Mcp", SERVICE, ServiceType.MCP);
  }

  private String storedKey(final McpConnection connection, final String name) {
    return storedKeyOf(connection, server -> name.equals(server.getName()));
  }

  private String storedKeyAt(final McpConnection connection, final String url) {
    return storedKeyOf(connection, server -> url.equals(server.getUrl()));
  }

  private String storedKeyOf(
      final McpConnection connection, final Predicate<McpServerConfig> matches) {
    return secretsManager.getSecretValue(
        reference(connection.getServers().stream().filter(matches).findFirst().orElseThrow()));
  }

  private static String reference(final McpServerConfig server) {
    final String apiKey = server.getApiKey();
    return Fernet.isTokenized(apiKey) ? Fernet.getInstance().decrypt(apiKey) : apiKey;
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
