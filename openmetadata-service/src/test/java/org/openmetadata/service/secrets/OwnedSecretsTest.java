/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.SecretsManager.SECRET_FIELD_PREFIX;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.PasswordFieldWalkerTest.Endpoint;

class OwnedSecretsTest {
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final SecretsManager.SecretsConfig CONFIG =
      new SecretsManager.SecretsConfig("openmetadata", null, List.of(), null);
  private static final UUID SERVICE_ID = UUID.randomUUID();
  private static final SecretOwner ALICE = userOwner(UUID.randomUUID());
  private static final SecretOwner BOB = userOwner(UUID.randomUUID());
  private static final String LEGACY_REFERENCE =
      SECRET_FIELD_PREFIX + "/openmetadata/database/warehouse/password";

  private InMemorySecretsManager vault;
  private OwnedSecrets ownedSecrets;

  @BeforeAll
  static void setFernetKey() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
  }

  @AfterAll
  static void clearFernetKey() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @BeforeEach
  void newVault() {
    vault = new InMemorySecretsManager(CONFIG);
    ownedSecrets = vault.ownedSecrets();
  }

  @Test
  void ownersWithTheSameFieldGetSeparateSecrets() {
    SnowflakeConnection alice = encrypt(snowflake("alice-password"), ALICE);
    SnowflakeConnection bob = encrypt(snowflake("bob-password"), BOB);

    assertNotEquals(reference(alice.getPassword()), reference(bob.getPassword()));
    assertEquals("alice-password", resolve(alice.getPassword()));
    assertEquals("bob-password", resolve(bob.getPassword()));
    assertTrue(ownedSecrets.isOwnedBy(reference(alice.getPassword()), ALICE));
    assertFalse(ownedSecrets.isOwnedBy(reference(alice.getPassword()), BOB));
  }

  @Test
  void aNewValueReplacesTheOwnersSecretUnderTheSameKey() {
    String first = reference(encrypt(snowflake("first"), ALICE).getPassword());
    String second = reference(encrypt(snowflake("second"), ALICE).getPassword());

    assertEquals(first, second);
    assertEquals("second", vault.getSecretValue(second));
    assertEquals(1, vault.getSecretsMap().size());
  }

  @Test
  void reSavingAnUnchangedFieldKeepsItsCiphertext() {
    String stored = encrypt(snowflake("alice-password"), ALICE).getPassword();
    DBSecretsManager database = DBSecretsManager.getInstance(SecretsManagerProvider.DB, CONFIG);
    String storedInDatabase =
        ((SnowflakeConnection)
                database
                    .ownedSecrets()
                    .encrypt(snowflake("db-password"), ALICE, List.of(), Set.of()))
            .getPassword();

    assertEquals(stored, encrypt(snowflake(stored), ALICE).getPassword());
    assertEquals(
        storedInDatabase,
        ((SnowflakeConnection)
                database
                    .ownedSecrets()
                    .encrypt(snowflake(storedInDatabase), ALICE, List.of(), Set.of()))
            .getPassword());
  }

  @Test
  void anElementTakingARemovedElementsPlaceKeepsTheSurvivorsSecret() {
    Keyring saved = encrypt(new Keyring(new Endpoint("first"), new Endpoint("second")), Set.of());
    String secondStored = saved.getEndpoints().getLast().getToken();

    Keyring updated =
        encrypt(
            new Keyring(new Endpoint(secondStored), new Endpoint("third")),
            ownedSecrets.references(saved));
    String thirdStored = updated.getEndpoints().getLast().getToken();
    Keyring again =
        encrypt(
            new Keyring(new Endpoint(secondStored), new Endpoint("fourth")),
            ownedSecrets.references(updated));

    String kept = reference(updated.getEndpoints().getFirst().getToken());
    String added = reference(thirdStored);
    assertEquals(reference(secondStored), kept);
    assertNotEquals(kept, added);
    assertEquals("second", vault.getSecretValue(kept));
    assertTrue(ownedSecrets.isOwnedBy(added, ALICE));
    assertEquals(added, reference(again.getEndpoints().getLast().getToken()));
    assertEquals("fourth", vault.getSecretValue(added));
  }

  @Test
  void aFieldWhoseKeyADeletedSecretHoldsGetsAFreshKeyAndKeepsIt() {
    SoftDeletingVault softDeleting = new SoftDeletingVault();
    OwnedSecrets owned = softDeleting.ownedSecrets();
    String first = storedReference(owned, "first", Set.of());
    owned.delete(Set.of(first), ALICE);

    String second = storedReference(owned, "second", Set.of());
    String third = storedReference(owned, "third", Set.of(second));

    assertNotEquals(first, second);
    assertTrue(second.startsWith(first));
    assertTrue(owned.isOwnedBy(second, ALICE));
    assertEquals(second, third);
    assertEquals("third", softDeleting.getSecretValue(third));
    assertEquals(Set.of(secretName(third)), softDeleting.getSecretsMap().keySet());
  }

  @Test
  void aFieldKeepsUpdatingTheKeyItHolds() {
    String first = reference(encrypt(snowflake("first"), ALICE).getPassword());
    String fresh = first + SecretKeyEncoding.freshSuffix();
    vault.upsertSecret(secretName(fresh), "first");

    String second = storedReference(ownedSecrets, "second", Set.of(fresh));

    assertEquals(fresh, second);
    assertEquals("second", vault.getSecretValue(fresh));
  }

  @Test
  void twoPartsOfOneOwnerKeepSeparateSecrets() {
    SnowflakeConnection userAuth =
        (SnowflakeConnection)
            ownedSecrets.encrypt(snowflake("typed"), ALICE, List.of("userauthconfig"), Set.of());
    SnowflakeConnection credentials =
        (SnowflakeConnection)
            ownedSecrets.encrypt(
                snowflake("issued"), ALICE, List.of("encryptedcredentials"), Set.of());

    assertNotEquals(reference(userAuth.getPassword()), reference(credentials.getPassword()));
    assertEquals("typed", resolve(userAuth.getPassword()));
    assertEquals("issued", resolve(credentials.getPassword()));
  }

  @Test
  void aNestedCredentialGetsItsOwnSecret() {
    PostgresConnection connection =
        new PostgresConnection().withAuthType(new basicAuth().withPassword("nested-password"));

    ownedSecrets.encrypt(connection, ALICE, List.of(), Set.of());

    String stored = ((basicAuth) connection.getAuthType()).getPassword();
    assertTrue(ownedSecrets.isOwnedBy(reference(stored), ALICE));
    assertEquals("nested-password", resolve(stored));
  }

  @Test
  void aFieldKeyEncodesEverySegmentOfThePath() {
    assertNotEquals(
        SecretKeyEncoding.fieldKey(List.of("a", "b")), SecretKeyEncoding.fieldKey(List.of("a/b")));
  }

  @Test
  void anotherOwnersReferenceIsRejectedWithoutEchoingIt() {
    String aliceReference = reference(encrypt(snowflake("alice-password"), ALICE).getPassword());

    SecretsManagerException rejected =
        assertThrows(SecretsManagerException.class, () -> encrypt(snowflake(aliceReference), BOB));

    assertEquals(400, rejected.getResponse().getStatus());
    assertFalse(rejected.getMessage().contains(aliceReference));
  }

  @Test
  void aReferenceIsComparedByTheNameTheProviderResolves() {
    InMemorySecretsManager caseInsensitive =
        new InMemorySecretsManager(CONFIG) {
          @Override
          protected String canonicalSecretName(String secretName) {
            return secretName.toLowerCase(Locale.ROOT);
          }
        };
    OwnedSecrets secrets = caseInsensitive.ownedSecrets();
    String aliceReference =
        reference(
            ((SnowflakeConnection)
                    secrets.encrypt(snowflake("alice-password"), ALICE, List.of(), Set.of()))
                .getPassword());
    String otherSpelling =
        SECRET_FIELD_PREFIX + secretName(aliceReference).toUpperCase(Locale.ROOT);

    assertThrows(
        SecretsManagerException.class,
        () -> secrets.encrypt(snowflake(otherSpelling), BOB, List.of(), Set.of()));
  }

  @Test
  void aReferenceTheOwnerAlreadyHoldsIsKept() {
    SnowflakeConnection connection =
        (SnowflakeConnection)
            ownedSecrets.encrypt(
                snowflake(LEGACY_REFERENCE), ALICE, List.of(), Set.of(LEGACY_REFERENCE));

    assertEquals(LEGACY_REFERENCE, reference(connection.getPassword()));
    assertTrue(vault.getSecretsMap().isEmpty());
  }

  @Test
  void aReferenceIntoTheCallersOwnVaultIsLeftAlone() {
    String ownVault = SECRET_FIELD_PREFIX + "/payments/db-password";

    SnowflakeConnection connection = encrypt(snowflake(ownVault), ALICE);

    assertEquals(ownVault, reference(connection.getPassword()));
    assertTrue(vault.getSecretsMap().isEmpty());
  }

  @Test
  void aClearedFieldStoresNothing() {
    SnowflakeConnection connection = encrypt(snowflake(""), ALICE);

    assertNull(connection.getPassword());
    assertTrue(vault.getSecretsMap().isEmpty());
  }

  @Test
  void rekeyCopiesALegacySecretAndKeepsTheOldOne() {
    vault.getSecretsMap().put(secretName(LEGACY_REFERENCE), "stored-password");
    SnowflakeConnection connection = snowflake(LEGACY_REFERENCE);

    OwnedSecrets.RekeyResult result = ownedSecrets.rekey(connection, ALICE, List.of());

    assertEquals(List.of("/password"), result.rekeyedFields());
    assertTrue(ownedSecrets.isOwnedBy(connection.getPassword(), ALICE));
    assertEquals("stored-password", vault.getSecretValue(connection.getPassword()));
    assertEquals("stored-password", vault.getSecretsMap().get(secretName(LEGACY_REFERENCE)));
  }

  @Test
  void rekeyLeavesAReferenceWhoseSecretIsGone() {
    SnowflakeConnection connection = snowflake(LEGACY_REFERENCE);

    OwnedSecrets.RekeyResult result = ownedSecrets.rekey(connection, ALICE, List.of());

    assertEquals(List.of("/password"), result.missingFields());
    assertEquals(LEGACY_REFERENCE, connection.getPassword());
  }

  @Test
  void rekeyLeavesAReferenceWhoseSecretCannotBeRead() {
    InMemorySecretsManager unreadable =
        new InMemorySecretsManager(CONFIG) {
          @Override
          String getSecret(String secretName) {
            throw new SecretsManagerException("access denied");
          }
        };
    SnowflakeConnection connection = snowflake(LEGACY_REFERENCE);

    OwnedSecrets.RekeyResult result = unreadable.ownedSecrets().rekey(connection, ALICE, List.of());

    assertEquals(List.of("/password"), result.failedFields());
    assertEquals(LEGACY_REFERENCE, connection.getPassword());
    assertTrue(unreadable.getSecretsMap().isEmpty());
  }

  @Test
  void aSecretTheVaultRefusesToDeleteDoesNotFailTheCaller() {
    InMemorySecretsManager undeletable =
        new InMemorySecretsManager(CONFIG) {
          @Override
          protected void deleteSecretInternal(String secretName) {
            throw new IllegalStateException("access denied");
          }
        };
    OwnedSecrets secrets = undeletable.ownedSecrets();
    String alice =
        reference(
            ((SnowflakeConnection)
                    secrets.encrypt(snowflake("alice-password"), ALICE, List.of(), Set.of()))
                .getPassword());

    secrets.delete(List.of(alice), ALICE);

    assertTrue(secrets.exists(alice));
  }

  @Test
  void aSecondRekeyChangesNothing() {
    vault.getSecretsMap().put(secretName(LEGACY_REFERENCE), "stored-password");
    SnowflakeConnection connection = snowflake(LEGACY_REFERENCE);
    ownedSecrets.rekey(connection, ALICE, List.of());
    Map<String, String> afterFirstRun = Map.copyOf(vault.getSecretsMap());

    OwnedSecrets.RekeyResult second = ownedSecrets.rekey(connection, ALICE, List.of());

    assertTrue(second.rekeyedFields().isEmpty());
    assertEquals(afterFirstRun, vault.getSecretsMap());
  }

  @Test
  void deleteRemovesOnlyTheOwnersSecrets() {
    String alice = reference(encrypt(snowflake("alice-password"), ALICE).getPassword());
    String bob = reference(encrypt(snowflake("bob-password"), BOB).getPassword());
    vault.getSecretsMap().put(secretName(LEGACY_REFERENCE), "stored-password");

    ownedSecrets.delete(List.of(alice, bob, LEGACY_REFERENCE), ALICE);

    assertFalse(ownedSecrets.exists(alice));
    assertTrue(ownedSecrets.exists(bob));
    assertTrue(ownedSecrets.exists(LEGACY_REFERENCE));
  }

  @Test
  void retireKeepsASecretTheWriteStillReadsUnderAnotherSpelling() {
    OwnedSecrets owned = new CaseInsensitiveVault().ownedSecrets();
    String kept = partReference(owned, "kept", "a");
    String dropped = partReference(owned, "dropped", "b");

    owned.retire(Set.of(kept, dropped), Set.of(upperCased(kept)), ALICE);

    assertTrue(owned.exists(kept));
    assertFalse(owned.exists(dropped));
  }

  @Test
  void twoSpellingsOfOneSecretResolveToTheSameName() {
    OwnedSecrets owned = new CaseInsensitiveVault().ownedSecrets();
    String reference = partReference(owned, "password", "a");

    assertEquals(owned.resolvedName(reference), owned.resolvedName(upperCased(reference)));
    assertNotEquals(
        owned.resolvedName(reference), owned.resolvedName(partReference(owned, "other", "b")));
    assertThrows(IllegalArgumentException.class, () -> owned.resolvedName("plain-password"));
  }

  @Test
  void referencesListsWhatTheFieldsPointAt() {
    SnowflakeConnection connection =
        encrypt(snowflake("alice-password").withPrivateKey("alice-key"), ALICE);

    Set<String> references = ownedSecrets.references(connection);

    assertEquals(2, references.size());
    assertTrue(references.stream().allMatch(reference -> ownedSecrets.isOwnedBy(reference, ALICE)));
  }

  @Test
  void aKeyTheProviderWouldRefuseFailsBeforeAnyWrite() {
    InMemorySecretsManager shortKeys =
        new InMemorySecretsManager(CONFIG) {
          @Override
          protected int maxSecretIdLength() {
            return 20;
          }
        };

    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class,
            () -> shortKeys.ownedSecrets().encrypt(snowflake("pw"), ALICE, List.of(), Set.of()));

    assertTrue(rejected.getMessage().contains("over the 20"));
    assertTrue(shortKeys.getSecretsMap().isEmpty());
  }

  @Test
  void theDatabaseManagerKeepsTheCredentialInTheField() {
    DBSecretsManager database = DBSecretsManager.getInstance(SecretsManagerProvider.DB, CONFIG);

    SnowflakeConnection connection =
        (SnowflakeConnection)
            database.ownedSecrets().encrypt(snowflake("db-password"), ALICE, List.of(), Set.of());

    assertEquals("db-password", Fernet.getInstance().decrypt(connection.getPassword()));
  }

  @ParameterizedTest
  @MethodSource("providerLayouts")
  void keysFitEveryProviderAndDifferPerOwner(
      SecretsManager.SecretsIdConfig layout, Pattern allowed) {
    InMemorySecretsManager provider = withLayout(layout);
    String alice = keyOf(provider, ALICE);
    String bob = keyOf(provider, BOB);

    assertNotEquals(alice, bob);
    assertTrue(allowed.matcher(alice).matches(), alice);
    assertTrue(allowed.matcher(bob).matches(), bob);
  }

  @Test
  void anOwnerSegmentCannotCarryASeparator() {
    assertThrows(IllegalArgumentException.class, () -> SecretOwner.builder("query/runner"));
    assertThrows(
        IllegalArgumentException.class,
        () -> SecretOwner.builder("queryrunner").literal("User").build());
  }

  private static Stream<Arguments> providerLayouts() {
    return Stream.of(
        Arguments.of(
            new SecretsManager.SecretsIdConfig(
                "/", Boolean.TRUE, "_", Pattern.compile("[^A-Za-z0-9/_\\-]")),
            Pattern.compile("[A-Za-z0-9/_+=.@\\-]{1,512}")),
        Arguments.of(
            new SecretsManager.SecretsIdConfig(
                "-", Boolean.FALSE, "", Pattern.compile("[^A-Za-z0-9\\-]")),
            Pattern.compile("[A-Za-z0-9\\-]{1,127}")),
        Arguments.of(
            new SecretsManager.SecretsIdConfig(
                "_", Boolean.FALSE, "", Pattern.compile("[^A-Za-z0-9_]")),
            Pattern.compile("[A-Za-z0-9_\\-]{1,255}")),
        Arguments.of(
            new SecretsManager.SecretsIdConfig(
                "-", Boolean.FALSE, "-", Pattern.compile("[^A-Za-z0-9\\-]")),
            Pattern.compile("[a-z0-9]([a-z0-9\\-.]{0,251}[a-z0-9])?")));
  }

  private static InMemorySecretsManager withLayout(SecretsManager.SecretsIdConfig layout) {
    return new InMemorySecretsManager(CONFIG) {
      @Override
      protected SecretsIdConfig builSecretsIdConfig() {
        return layout;
      }
    };
  }

  private static String keyOf(InMemorySecretsManager provider, SecretOwner owner) {
    SnowflakeConnection connection =
        (SnowflakeConnection)
            provider.ownedSecrets().encrypt(snowflake("pw"), owner, List.of(), Set.of());
    return secretName(Fernet.getInstance().decrypt(connection.getPassword()));
  }

  private static SecretOwner userOwner(UUID userId) {
    return SecretOwner.builder("queryrunner").literal("user").id(SERVICE_ID).id(userId).build();
  }

  private static SnowflakeConnection snowflake(String password) {
    return new SnowflakeConnection().withUsername("user").withPassword(password);
  }

  private SnowflakeConnection encrypt(SnowflakeConnection connection, SecretOwner owner) {
    return (SnowflakeConnection) ownedSecrets.encrypt(connection, owner, List.of(), Set.of());
  }

  private Keyring encrypt(Keyring keyring, Set<String> keptReferences) {
    return (Keyring) ownedSecrets.encrypt(keyring, ALICE, List.of(), keptReferences);
  }

  private static String storedReference(
      OwnedSecrets owned, String password, Set<String> keptReferences) {
    SnowflakeConnection connection =
        (SnowflakeConnection) owned.encrypt(snowflake(password), ALICE, List.of(), keptReferences);
    return reference(connection.getPassword());
  }

  private String resolve(String stored) {
    return vault.getSecretValue(reference(stored));
  }

  private static String reference(String stored) {
    return Fernet.getInstance().decryptIfApplies(stored);
  }

  private static String secretName(String reference) {
    return reference.substring(SECRET_FIELD_PREFIX.length());
  }

  private static String partReference(OwnedSecrets owned, String password, String part) {
    SnowflakeConnection connection =
        (SnowflakeConnection) owned.encrypt(snowflake(password), ALICE, List.of(part), Set.of());
    return reference(connection.getPassword());
  }

  private static String upperCased(String reference) {
    return SECRET_FIELD_PREFIX + secretName(reference).toUpperCase(Locale.ROOT);
  }

  /** A provider whose secret names are case-insensitive, as Azure Key Vault's are. */
  private static final class CaseInsensitiveVault extends InMemorySecretsManager {
    private CaseInsensitiveVault() {
      super(CONFIG);
    }

    @Override
    void storeSecret(String secretName, String secretValue) {
      super.storeSecret(canonicalSecretName(secretName), secretValue);
    }

    @Override
    String getSecret(String secretName) {
      return super.getSecret(canonicalSecretName(secretName));
    }

    @Override
    protected void deleteSecretInternal(String secretName) {
      super.deleteSecretInternal(canonicalSecretName(secretName));
    }

    @Override
    protected String canonicalSecretName(String secretName) {
      return secretName.toLowerCase(Locale.ROOT);
    }
  }

  /** A provider that deletes softly: a deleted secret keeps its name and refuses writes to it. */
  private static final class SoftDeletingVault extends InMemorySecretsManager {
    private final Set<String> deleted = new HashSet<>();

    private SoftDeletingVault() {
      super(CONFIG);
    }

    @Override
    void storeSecret(String secretName, String secretValue) {
      if (deleted.contains(secretName)) {
        throw new IllegalStateException("deleted but recoverable");
      }
      super.storeSecret(secretName, secretValue);
    }

    @Override
    protected void deleteSecretInternal(String secretName) {
      super.deleteSecretInternal(secretName);
      deleted.add(secretName);
    }

    @Override
    protected boolean isNameReserved(Throwable failure) {
      return failure.getCause() instanceof IllegalStateException;
    }
  }

  /** Credentials in a list whose elements have no name, so each is keyed by its position. */
  public static final class Keyring {
    private final List<Endpoint> endpoints;

    Keyring(Endpoint... endpoints) {
      this.endpoints = List.of(endpoints);
    }

    public List<Endpoint> getEndpoints() {
      return endpoints;
    }
  }
}
