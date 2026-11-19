package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.mcp.McpConnection;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

/**
 * A reference to another list element's secret is moved to the element's own id only when its
 * value can be read; otherwise the reference is kept and the save still succeeds.
 */
class ListSecretReferenceEdgeCasesTest {
  private static final String FERNET_KEY = "-uvd2sz2yfe3XoJZnBk3Aw9o_CjL36hHv_yFJlZL3-g=";
  private static final String SERVICE = "mcp_reference_edges";
  private static final SecretsManager.SecretsConfig CONFIG =
      new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null);

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
  }

  @Test
  void aReferenceToAMissingSecretIsKept() {
    final InMemorySecretsManager vault = vault(new InMemorySecretsManager(CONFIG));
    final McpConnection created = encrypt(vault, List.of(server("alpha", "alpha-key")));
    final String alphaReference = reference(created.getServers().getFirst());
    vault.getSecretsMap().remove(alphaReference.substring("secret:".length()));

    final McpConnection renamed =
        encrypt(vault, List.of(copy(created.getServers().getFirst()).withName("beta")));

    assertEquals(alphaReference, reference(renamed.getServers().getFirst()));
  }

  /** A server that may write secrets but not read them keeps the reference instead of failing. */
  @Test
  void aReferenceThatCannotBeReadIsKeptAndTheSaveSucceeds() {
    final AtomicBoolean readsDenied = new AtomicBoolean(false);
    final InMemorySecretsManager vault =
        vault(
            new InMemorySecretsManager(CONFIG) {
              @Override
              String getSecret(final String secretName) {
                if (readsDenied.get()) {
                  throw new IllegalStateException("access denied");
                }
                return super.getSecret(secretName);
              }
            });
    final McpConnection created = encrypt(vault, List.of(server("alpha", "alpha-key")));
    final String alphaReference = reference(created.getServers().getFirst());
    readsDenied.set(true);

    final McpConnection renamed =
        encrypt(vault, List.of(copy(created.getServers().getFirst()).withName("beta")));

    assertEquals(alphaReference, reference(renamed.getServers().getFirst()));
  }

  /** With "-" as separator, as on Azure and Kubernetes, a rename still moves the key. */
  @Test
  void aRenamedServerKeepsItsKeyWithADashSeparator() {
    final InMemorySecretsManager vault =
        vault(
            new InMemorySecretsManager(CONFIG) {
              @Override
              protected SecretsIdConfig builSecretsIdConfig() {
                return new SecretsIdConfig(
                    "-", Boolean.FALSE, "", Pattern.compile("[^A-Za-z0-9-]"));
              }
            });
    final McpConnection created = encrypt(vault, List.of(server("alpha", "alpha-key")));
    final McpConnection renamed =
        encrypt(vault, List.of(copy(created.getServers().getFirst()).withName("beta")));

    final McpConnection reused =
        encrypt(
            vault,
            List.of(copy(renamed.getServers().getFirst()), server("alpha", "new-alpha-key")));

    assertEquals("alpha-key", vault.getSecretValue(reference(reused.getServers().getFirst())));
    assertEquals("new-alpha-key", vault.getSecretValue(reference(reused.getServers().get(1))));
  }

  /** A swap whose second write fails leaves both servers reading their own keys. */
  @Test
  void aSwapThatFailsPartWayPutsBackTheKeyItOverwrote() {
    final AtomicInteger writesBeforeFailure = new AtomicInteger(Integer.MAX_VALUE);
    final InMemorySecretsManager vault =
        vault(
            new InMemorySecretsManager(CONFIG) {
              @Override
              void storeSecret(final String secretName, final String secretValue) {
                if (writesBeforeFailure.getAndDecrement() == 0) {
                  throw new IllegalStateException("provider unavailable");
                }
                super.storeSecret(secretName, secretValue);
              }
            });
    final McpConnection created =
        encrypt(vault, List.of(server("alpha", "alpha-key"), server("beta", "beta-key")));
    writesBeforeFailure.set(1);

    assertThrows(
        RuntimeException.class,
        () ->
            encrypt(
                vault,
                List.of(
                    copy(created.getServers().getFirst()).withName("beta"),
                    copy(created.getServers().get(1)).withName("alpha"))));

    assertEquals("alpha-key", vault.getSecretValue(reference(created.getServers().getFirst())));
    assertEquals("beta-key", vault.getSecretValue(reference(created.getServers().get(1))));
  }

  /** The database secrets manager holds no references, so a "secret:" value is a password. */
  @Test
  void theDatabaseSecretsManagerKeepsASecretPrefixedValueAsItIs() {
    final DBSecretsManager database =
        DBSecretsManager.getInstance(SecretsManagerProvider.DB, CONFIG);
    final String value = "secret:/openmetadata/mcp/" + SERVICE + "/servers/alpha/apikey";

    final McpConnection stored =
        (McpConnection)
            database.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("beta", value))),
                "Mcp",
                SERVICE,
                ServiceType.MCP);

    assertEquals(value, reference(stored.getServers().getFirst()));
  }

  private static InMemorySecretsManager vault(final InMemorySecretsManager vault) {
    vault.setFernet(Fernet.getInstance());
    return vault;
  }

  private static McpConnection encrypt(
      final SecretsManager manager, final List<McpServerConfig> servers) {
    return (McpConnection)
        manager.encryptServiceConnectionConfig(
            new McpConnection().withServers(servers), "Mcp", SERVICE, ServiceType.MCP);
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
