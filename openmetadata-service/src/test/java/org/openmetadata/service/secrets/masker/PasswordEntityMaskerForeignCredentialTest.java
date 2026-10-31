package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.service.exception.EntityMaskException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.DBSecretsManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;

/**
 * The unmask is where an update proves it owns the encoded credential it carries: the value the
 * field already holds in storage, as stored or as the unmask hands it back, is the only encoded
 * value the field may keep. Any other Fernet token or reference into the deployment's managed
 * namespace is a credential lifted from another entity and is rejected; a reference into a vault
 * the submitter manages themselves is accepted, as the ingestion framework resolves those at
 * runtime.
 */
class PasswordEntityMaskerForeignCredentialTest {
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String STORED_PASSWORD = "openmetadata-password";
  private static final String VICTIM_PASSWORD = "victim-password";
  private static final String MANAGED_REFERENCE =
      "secret:/prefix/openmetadata/database/other-service/authtype/password";
  private static final String EXTERNAL_REFERENCE = "secret:/external/vault/database/password";

  @BeforeEach
  void setUp() throws Exception {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    // DBSecretsManager caches a JVM-wide singleton with the first caller's configuration, and
    // other classes in the unit lane bootstrap it with no prefix - so build this class's own
    // instance instead of trusting whichever configuration the lane happened to initialize it
    // with.
    resetDbSecretsManagerSingleton();
    SecretsManager secretsManager =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    SecretsManagerFactory.setSecretsManager(secretsManager);
    assertTrue(secretsManager.isManagedSecretReference(MANAGED_REFERENCE));
    assertFalse(secretsManager.isManagedSecretReference(EXTERNAL_REFERENCE));
  }

  @AfterEach
  void tearDown() throws Exception {
    SecretsManagerFactory.setSecretsManager(null);
    resetDbSecretsManagerSingleton();
    Fernet.getInstance().setFernetKey((String) null);
  }

  private static void resetDbSecretsManagerSingleton() throws Exception {
    Field instance = DBSecretsManager.class.getDeclaredField("instance");
    instance.setAccessible(true);
    instance.set(null, null);
  }

  @Test
  void explicitCollateReStoragePolicyCanRestoreStoredCredentials() {
    SecretsManager manager = SecretsManagerFactory.getSecretsManager();
    basicAuth stored = new basicAuth().withPassword(encrypted(STORED_PASSWORD));

    basicAuth queryConfig =
        (basicAuth)
            manager.encryptQueryRunnerConfig(
                stored,
                "test-service",
                "user",
                SecretsManager.CredentialPolicy.INTERNAL_RE_STORAGE);
    assertEquals(STORED_PASSWORD, Fernet.getInstance().decrypt(queryConfig.getPassword()));
    basicAuth pluginConfig =
        (basicAuth)
            manager.encryptContextPluginConnection(
                new basicAuth().withPassword(encrypted(STORED_PASSWORD)),
                "test-plugin",
                SecretsManager.CredentialPolicy.INTERNAL_RE_STORAGE);
    assertEquals(STORED_PASSWORD, Fernet.getInstance().decrypt(pluginConfig.getPassword()));
  }

  @Test
  void explicitStrictCollateOverloadsRejectForeignTokens() {
    SecretsManager manager = SecretsManagerFactory.getSecretsManager();
    basicAuth foreign = new basicAuth().withPassword(encrypted(VICTIM_PASSWORD));
    assertThrows(
        SecretsManagerException.class,
        () ->
            manager.encryptQueryRunnerConfig(
                foreign, "service", "user", SecretsManager.CredentialPolicy.STRICT));
    assertThrows(
        SecretsManagerException.class,
        () ->
            manager.encryptContextPluginConnection(
                foreign, "plugin", SecretsManager.CredentialPolicy.STRICT));
  }

  /**
   * The default policy the no-policy overloads build for the entity is the strict one with the
   * entity's own reference bases, so a foreign Fernet token meets the same rejection the explicit
   * STRICT policy applies - a caller forgetting the policy argument must not open the re-storage
   * exemption.
   */
  @Test
  void defaultCollateOverloadsRejectAForeignToken() {
    SecretsManager manager = SecretsManagerFactory.getSecretsManager();
    basicAuth foreign = new basicAuth().withPassword(encrypted(VICTIM_PASSWORD));
    SecretsManagerException queryRunnerRejected =
        assertThrows(
            SecretsManagerException.class,
            () -> manager.encryptQueryRunnerConfig(foreign, "service", "user"));
    assertEquals(400, queryRunnerRejected.getResponse().getStatus());
    SecretsManagerException pluginRejected =
        assertThrows(
            SecretsManagerException.class,
            () -> manager.encryptContextPluginConnection(foreign, "plugin"));
    assertEquals(400, pluginRejected.getResponse().getStatus());
  }

  @Test
  void unmaskRejectsAForeignFernetToken() {
    String foreignToken = encrypted(VICTIM_PASSWORD);
    MysqlConnection original = connection(encrypted(STORED_PASSWORD));
    MysqlConnection updated = connection(foreignToken);

    SecretsManagerException rejected =
        assertThrows(SecretsManagerException.class, () -> unmask(updated, original));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("Password"), rejected.getMessage());
    assertFalse(rejected.getMessage().contains(foreignToken), "the token must not be echoed");
  }

  @Test
  void unmaskAcceptsTheStoredTokenEchoedBack() {
    String storedToken = encrypted(STORED_PASSWORD);
    MysqlConnection original = connection(storedToken);

    MysqlConnection restored = (MysqlConnection) unmask(connection(storedToken), original);

    assertEquals(STORED_PASSWORD, password(restored));
  }

  @Test
  void unmaskAcceptsSecretPrefixedPlaintextWithTheDatabaseManager() {
    MysqlConnection original = connection(encrypted(STORED_PASSWORD));
    MysqlConnection restored = (MysqlConnection) unmask(connection(MANAGED_REFERENCE), original);
    assertEquals(MANAGED_REFERENCE, password(restored));
    assertEquals(
        MANAGED_REFERENCE, password((MysqlConnection) unmask(connection(MANAGED_REFERENCE), null)));
  }

  @Test
  void unmaskAcceptsAReferenceIntoTheSubmittersOwnVault() {
    MysqlConnection original = connection(encrypted(STORED_PASSWORD));

    MysqlConnection restored = (MysqlConnection) unmask(connection(EXTERNAL_REFERENCE), original);

    assertEquals(EXTERNAL_REFERENCE, password(restored));
  }

  @Test
  void unmaskRejectsAnEncodedValueWhenThereIsNoOriginalToCompareAgainst() {
    Workflow workflow = testConnectionWorkflow(encrypted(VICTIM_PASSWORD));

    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class,
            () -> EntityMaskerFactory.createEntityMasker().unmaskWorkflow(workflow, null));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("Password"), rejected.getMessage());
  }

  /**
   * A failure the walk itself cannot classify - a stored token whose bytes no longer decrypt,
   * say - surfaces as a 500, and the cause is the only diagnostic the response never carries.
   */
  @Test
  void unmaskKeepsTheCauseOfAFailureItCannotClassify() {
    Workflow original = testConnectionWorkflow("fernet:not-a-valid-token");
    Workflow updated = testConnectionWorkflow("fernet:not-a-valid-token");

    EntityMaskException wrapped =
        assertThrows(
            EntityMaskException.class,
            () -> EntityMaskerFactory.createEntityMasker().unmaskWorkflow(updated, original));

    assertNotNull(wrapped.getCause(), "the 500 must keep the walk's own failure as its cause");
  }

  /**
   * The mask leaves a bot's JWT token visible to its admin, so the token reaches the unmask walk
   * without the mask marker that would otherwise restore it - it must be validated like any other
   * credential instead of slipping through as a pre-encoded value.
   */
  @Test
  void unmaskValidatesTheBotTokenTheMaskLeavesVisible() {
    AuthenticationMechanism original = jwtMechanism(encrypted(STORED_PASSWORD));
    AuthenticationMechanism updated = jwtMechanism(encrypted(VICTIM_PASSWORD));

    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class,
            () ->
                EntityMaskerFactory.createEntityMasker()
                    .unmaskAuthenticationMechanism("ingestion-bot", updated, original));

    assertEquals(400, rejected.getResponse().getStatus());
  }

  /**
   * A connection added where none was stored has nothing to compare against, so it must be walked
   * like any other: an encoded value cannot be the entity's own, while a plain value passes.
   */
  @Test
  void unmaskRejectsAnEncodedValueWhenNoConnectionWasStored() {
    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class,
            () ->
                EntityMaskerFactory.createEntityMasker()
                    .unmaskServiceConnectionConfig(
                        connection(encrypted(VICTIM_PASSWORD)),
                        null,
                        "Mysql",
                        ServiceType.DATABASE));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("Password"), rejected.getMessage());
  }

  @Test
  void unmaskAcceptsAPlainValueWhenNoConnectionWasStored() {
    Object restored =
        EntityMaskerFactory.createEntityMasker()
            .unmaskServiceConnectionConfig(
                connection("a-plain-password"), null, "Mysql", ServiceType.DATABASE);

    assertEquals("a-plain-password", password((MysqlConnection) restored));
  }

  private Object unmask(Object updated, Object original) {
    return EntityMaskerFactory.createEntityMasker()
        .unmaskServiceConnectionConfig(updated, original, "Mysql", ServiceType.DATABASE);
  }

  private MysqlConnection connection(String password) {
    return new MysqlConnection().withAuthType(new basicAuth().withPassword(password));
  }

  private String password(MysqlConnection connection) {
    return ((basicAuth) connection.getAuthType()).getPassword();
  }

  private AuthenticationMechanism jwtMechanism(String token) {
    return new AuthenticationMechanism()
        .withAuthType(AuthenticationMechanism.AuthType.JWT)
        .withConfig(new JWTAuthMechanism().withJWTToken(token));
  }

  private Workflow testConnectionWorkflow(String password) {
    DatabaseConnection dbConnection = new DatabaseConnection().withConfig(connection(password));
    TestServiceConnectionRequest testRequest =
        new TestServiceConnectionRequest()
            .withConnection(dbConnection)
            .withServiceType(ServiceType.DATABASE)
            .withConnectionType("Mysql");
    return new Workflow().withName("test-workflow").withRequest(testRequest);
  }

  private String encrypted(String value) {
    return Fernet.getInstance().encrypt(value);
  }
}
