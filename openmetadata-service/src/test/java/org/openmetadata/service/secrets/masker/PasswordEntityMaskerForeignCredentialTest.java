package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Set;
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
  void unmaskRejectsAReferenceToAnotherEntitysSecret() {
    MysqlConnection original = connection(encrypted(STORED_PASSWORD));

    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class, () -> unmask(connection(MANAGED_REFERENCE), original));

    assertEquals(400, rejected.getResponse().getStatus());
    assertFalse(
        rejected.getMessage().contains(MANAGED_REFERENCE), "the reference must not be echoed");
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

  private Object unmask(Object updated, Object original) {
    return EntityMaskerFactory.createEntityMasker()
        .unmaskServiceConnectionConfig(updated, original, "Mysql", ServiceType.DATABASE);
  }

  @Test
  void theMaskerSkipsExactlyTheClassesTheEncryptWalkSkips() throws Exception {
    assertEquals(
        staticClassSet(SecretsManager.class, "DO_NOT_ENCRYPT_CLASSES"),
        staticClassSet(PasswordEntityMasker.class, "DO_NOT_UNMASK_CLASSES"),
        "the masker must skip exactly the classes the encrypt walk never encodes: a class on"
            + " only one side leaves a field the other pass cannot round-trip");
  }

  @SuppressWarnings("unchecked")
  private static Set<Class<?>> staticClassSet(Class<?> owner, String name) throws Exception {
    Field field = owner.getDeclaredField(name);
    field.setAccessible(true);
    return (Set<Class<?>>) field.get(null);
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
