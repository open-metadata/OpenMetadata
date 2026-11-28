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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.azure.core.exception.HttpResponseException;
import com.azure.core.http.HttpResponse;
import com.azure.core.util.polling.SyncPoller;
import com.azure.security.keyvault.secrets.SecretClient;
import com.azure.security.keyvault.secrets.models.KeyVaultSecret;
import com.macasaet.fernet.Key;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Secret;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.transaction.TransactionalCallback;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentMatchers;
import org.openmetadata.schema.api.services.CreateMcpService.McpServiceType;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.mcp.McpConnection;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;

/**
 * Edge cases for reference-based secret id allocation on list elements: failed saves, batch
 * updates, provider-specific naming/limits/soft-delete, canonical ARN/case matching, DB manager,
 * prepare path, refused values, and user-supplied references.
 */
@Isolated("swaps the process-wide secrets manager and repository registry")
class ListSecretReferenceAllocationTest {
  private static final String FERNET_KEY = "mFNuF9gyyS4zNItmwvFq8wAf9TUFnNwj6m6pW1P5RjE=";
  private static final String CLUSTER = "openmetadata";
  private static final String SERVICE = "mcp-edge";

  private SecretsManager originalManager;
  private List<Key> originalKeys;

  @BeforeEach
  void setUp() {
    originalManager = SecretsManagerFactory.getSecretsManager();
    originalKeys = Fernet.getInstance().getCachedKeys();
    Fernet.getInstance().setFernetKey(FERNET_KEY);
  }

  @AfterEach
  void tearDown() {
    SecretsManagerFactory.setSecretsManager(originalManager);
    Fernet.getInstance()
        .setFernetKey(
            originalKeys == null
                ? null
                : originalKeys.stream().map(Key::serialise).collect(Collectors.joining(",")));
    Entity.cleanup();
    Entity.setCollectionDAO(null);
  }

  @Test
  void failedRepositorySaveAfterSwapAndEditLeavesCommittedCredentialsIntact() {
    InMemorySecretsManager vault = inMemoryVault();
    SecretsManagerFactory.setSecretsManager(vault);
    AtomicReference<String> committedJson = new AtomicReference<>();
    CollectionDAO.McpServiceDAO dao = mockMcpDao(committedJson);
    McpTestRepository repository = new McpTestRepository(dao);

    UUID id = UUID.randomUUID();
    McpService created =
        mcpService(id, List.of(server("alpha", "alpha-key"), server("beta", "beta-key")));
    repository.storeEntity(created, false);

    McpConnection afterCreate =
        configOf(JsonUtils.readValue(committedJson.get(), McpService.class));
    McpService swapped =
        mcpService(
            id,
            List.of(
                copy(afterCreate.getServers().get(0)).withName("beta"),
                copy(afterCreate.getServers().get(1)).withName("alpha")));
    repository.storeEntity(swapped, true);

    McpConnection afterSwap = configOf(JsonUtils.readValue(committedJson.get(), McpService.class));
    doThrow(new IllegalStateException("DB write failed"))
        .when(dao)
        .update(any(UUID.class), anyString(), anyString());

    McpService failedEdit =
        mcpService(
            id,
            List.of(
                copy(afterSwap.getServers().get(0)).withApiKey("new-beta-key"),
                copy(afterSwap.getServers().get(1)).withApiKey("new-alpha-key")));
    assertThrows(IllegalStateException.class, () -> repository.storeEntity(failedEdit, true));

    // Committed service still resolves both servers to their pre-failure credentials.
    McpConnection stillCommitted =
        configOf(JsonUtils.readValue(committedJson.get(), McpService.class));
    assertEquals("alpha-key", resolveKey(vault, stillCommitted, "beta"));
    assertEquals("beta-key", resolveKey(vault, stillCommitted, "alpha"));
  }

  @Test
  void failedBatchUpdateLeavesEarlierServiceCredentialsIntact() {
    InMemorySecretsManager vault = inMemoryVault();
    SecretsManagerFactory.setSecretsManager(vault);
    Map<UUID, String> committedById = new HashMap<>();
    CollectionDAO.McpServiceDAO dao = mockBatchMcpDao(committedById);
    McpTestRepository repository = new McpTestRepository(dao);

    UUID firstId = UUID.randomUUID();
    UUID secondId = UUID.randomUUID();
    McpService first = mcpService(firstId, "svc-one", List.of(server("alpha", "first-alpha")));
    McpService second = mcpService(secondId, "svc-two", List.of(server("alpha", "second-alpha")));
    repository.storeEntity(first, false);
    repository.storeEntity(second, false);

    McpConnection firstStored =
        configOf(JsonUtils.readValue(committedById.get(firstId), McpService.class));
    McpService firstRenamed =
        mcpService(
            firstId,
            "svc-one",
            List.of(copy(firstStored.getServers().getFirst()).withName("beta")));
    repository.storeEntity(firstRenamed, true);

    McpConnection firstAfterRename =
        configOf(JsonUtils.readValue(committedById.get(firstId), McpService.class));
    McpService firstUpdate =
        mcpService(
            firstId,
            "svc-one",
            List.of(
                copy(firstAfterRename.getServers().getFirst()).withApiKey("new-beta"),
                server("alpha", "new-alpha")));
    McpService secondInvalid =
        mcpService(
            secondId,
            "svc-two",
            List.of(server("alpha", ExternalSecretsManager.NULL_SECRET_STRING)));

    assertThrows(
        SecretsManagerException.class,
        () -> repository.updateManyPublic(List.of(firstUpdate, secondInvalid)));

    McpConnection stillCommitted =
        configOf(JsonUtils.readValue(committedById.get(firstId), McpService.class));
    assertEquals("first-alpha", resolveKey(vault, stillCommitted, "beta"));
  }

  @Test
  void directFourArgCallWithoutOriginalStillProtectsIncomingReferences() {
    InMemorySecretsManager vault = inMemoryVault();
    McpConnection created =
        (McpConnection)
            vault.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("alpha", "alpha-key"))),
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    McpConnection updated =
        (McpConnection)
            vault.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(
                        List.of(
                            copy(created.getServers().getFirst()).withName("beta"),
                            server("alpha", "new-alpha-key"))),
                "Mcp",
                SERVICE,
                ServiceType.MCP);

    assertEquals("alpha-key", resolveKey(vault, updated, "beta"));
    assertEquals("new-alpha-key", resolveKey(vault, updated, "alpha"));

    // A direct caller has no ownership ledger for suffixed references.
    String freshSecretName =
        referenceOf(updated, "alpha").substring(SecretsManager.SECRET_FIELD_PREFIX.length());
    assertTrue(vault.getSecretsMap().containsKey(freshSecretName));
    vault.deleteSecretsFromServiceConnectionConfig(updated, "Mcp", SERVICE, ServiceType.MCP);
    assertTrue(vault.getSecretsMap().containsKey(freshSecretName));
  }

  @ParameterizedTest
  @ValueSource(strings = {"replacement", ""})
  void changingAFreshShapedUserReferenceLeavesItsSecretUntouched(String newValue) {
    InMemorySecretsManager vault = inMemoryVault();
    SecretsManagerFactory.setSecretsManager(vault);
    String userSecretName =
        vault.buildSecretId(true, ServiceType.MCP.value(), SERVICE, "servers", "alpha", "apikey")
            + "/abcdefghijklm";
    vault.upsertSecret(userSecretName, "user-owned");
    AtomicReference<String> committedJson = new AtomicReference<>();
    McpTestRepository repository = new McpTestRepository(mockMcpDao(committedJson));
    UUID id = UUID.randomUUID();
    repository.storeEntity(
        mcpService(
            id, List.of(server("alpha", SecretsManager.SECRET_FIELD_PREFIX + userSecretName))),
        false);

    repository.storeEntity(mcpService(id, List.of(server("alpha", newValue))), true);

    McpConnection stored = configOf(JsonUtils.readValue(committedJson.get(), McpService.class));
    if (newValue.isEmpty()) {
      assertNull(referenceOf(stored, "alpha"));
    } else {
      assertEquals(newValue, resolveKey(vault, stored, "alpha"));
    }
    assertEquals("user-owned", vault.getSecretsMap().get(userSecretName));
  }

  @Test
  void legacyHardDeleteDoesNotAdoptAFreshShapedUserReference() {
    InMemorySecretsManager vault = inMemoryVault();
    String root = vault.buildSecretId(true, ServiceType.MCP.value(), SERVICE);
    String userSecretName = root + "/servers/alpha/apikey/abcdefghijklm";
    vault.upsertSecret(userSecretName, "user-owned");
    McpConnection config =
        new McpConnection()
            .withServers(
                List.of(server("alpha", SecretsManager.SECRET_FIELD_PREFIX + userSecretName)));
    SecretMapOwnership ownership = new SecretMapOwnership(mockExtensionDao(), vault);

    ownership.removeOwner(UUID.randomUUID(), vault.secretInventory(config, root));
    ownership.clean(root);

    assertEquals(Map.of(userSecretName, "user-owned"), vault.getSecretsMap());
  }

  @Test
  void refusedNullPlaceholderRejectsBeforeAnyVaultWriteOrDelete() {
    InMemorySecretsManager vault = inMemoryVault();
    McpConnection created =
        (McpConnection)
            vault.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(List.of(server("alpha", "alpha-key"), server("beta", "beta-key"))),
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    Map<String, String> snapshot = Map.copyOf(vault.getSecretsMap());

    McpConnection invalid =
        new McpConnection()
            .withServers(
                List.of(
                    copy(created.getServers().get(0)).withApiKey(""),
                    copy(created.getServers().get(1))
                        .withApiKey(ExternalSecretsManager.NULL_SECRET_STRING)));

    SecretsManagerException refused =
        assertThrows(
            SecretsManagerException.class,
            () ->
                vault.encryptServiceConnectionConfig(
                    invalid, created, "Mcp", SERVICE, ServiceType.MCP));

    assertEquals(400, refused.getResponse().getStatus());
    assertEquals(snapshot, vault.getSecretsMap());
  }

  @Test
  void clearingNewServerReusingOldNameDoesNotDeleteRenamedServersSecret() {
    InMemorySecretsManager vault = inMemoryVault();
    McpConnection created =
        (McpConnection)
            vault.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("alpha", "alpha-key"))),
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    McpConnection renamed =
        (McpConnection)
            vault.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(List.of(copy(created.getServers().getFirst()).withName("beta"))),
                created,
                "Mcp",
                SERVICE,
                ServiceType.MCP);

    McpConnection addedCleared =
        (McpConnection)
            vault.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(
                        List.of(copy(renamed.getServers().getFirst()), server("alpha", ""))),
                renamed,
                "Mcp",
                SERVICE,
                ServiceType.MCP);

    assertEquals("alpha-key", resolveKey(vault, addedCleared, "beta"));
    assertNull(
        addedCleared.getServers().stream()
            .filter(server -> "alpha".equals(server.getName()))
            .findFirst()
            .orElseThrow()
            .getApiKey());
  }

  @Test
  void userSuppliedExternalReferenceIsNeverOverwrittenOrDeleted() {
    InMemorySecretsManager vault = inMemoryVault();
    String root = vault.buildSecretId(true, ServiceType.MCP.value(), SERVICE);
    String canonicalAlphaId = root + "/servers/alpha/apikey";
    vault.upsertSecret(canonicalAlphaId, "user-owned-secret");

    EntityExtensionDAO extDao = mockExtensionDao();
    SecretMapOwnership ownership = new SecretMapOwnership(extDao, vault);
    UUID owner = UUID.randomUUID();

    // Beta holds a user-supplied reference sitting right at alpha's default path.
    McpConnection initialInput =
        new McpConnection()
            .withServers(
                List.of(server("beta", SecretsManager.SECRET_FIELD_PREFIX + canonicalAlphaId)));
    SecretsManager.SecretInventory initInv = vault.secretInventory(initialInput, root);
    McpConnection initialStored =
        (McpConnection)
            vault.encryptServiceConnectionConfig(
                JsonUtils.deepCopy(initialInput, McpConnection.class),
                null,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    ownership.recordWrite(owner, null, initInv, vault.secretInventory(initialStored, root));

    // Adding alpha with a plaintext key must not overwrite beta's user-owned secret and must not
    // claim ownership of canonicalAlphaId.
    McpConnection secondInput =
        new McpConnection()
            .withServers(
                List.of(
                    copy(initialStored.getServers().getFirst()),
                    server("alpha", "alpha-managed-key")));
    SecretsManager.SecretInventory secondInv = vault.secretInventory(secondInput, root);
    McpConnection secondStored =
        (McpConnection)
            vault.encryptServiceConnectionConfig(
                JsonUtils.deepCopy(secondInput, McpConnection.class),
                initialStored,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    ownership.recordWrite(
        owner,
        vault.secretInventory(initialStored, root),
        secondInv,
        vault.secretInventory(secondStored, root));

    assertEquals("user-owned-secret", resolveKey(vault, secondStored, "beta"));
    assertEquals("alpha-managed-key", resolveKey(vault, secondStored, "alpha"));

    // Hard delete deletes alpha's fresh managed secret, leaving user-owned secret untouched.
    ownership.removeOwner(owner, vault.secretInventory(secondStored, root));
    ownership.clean(root);
    assertEquals(Map.of(canonicalAlphaId, "user-owned-secret"), vault.getSecretsMap());
  }

  @Test
  void azureDashSeparatorCaseInsensitivitySoftDeleteAndMaxLengthAreHandled() {
    Parameters params = new Parameters();
    params.setAdditionalProperty("vaultName", "test-vault");
    params.setAdditionalProperty("tenantId", "test-tenant");
    params.setAdditionalProperty("clientId", "test-client");
    params.setAdditionalProperty("clientSecret", "test-secret");
    AzureKVSecretsManager azure =
        AzureKVSecretsManager.getInstance(
            new SecretsManager.SecretsConfig(CLUSTER, "prefix", List.of(), params));
    SoftDeletingAzureClient fakeAzure = new SoftDeletingAzureClient();
    azure.setClient(fakeAzure.client);

    // 1. Rename + uppercase spelling + reuse old name with '-' separator.
    McpConnection created =
        (McpConnection)
            azure.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("alpha", "k1"))),
                null,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    String alphaRefUpper =
        SecretsManager.SECRET_FIELD_PREFIX
            + referenceOf(created, "alpha")
                .substring(SecretsManager.SECRET_FIELD_PREFIX.length())
                .toUpperCase(Locale.ROOT);
    McpConnection renamedUpper =
        new McpConnection().withServers(List.of(server("beta", alphaRefUpper)));
    McpConnection reused =
        (McpConnection)
            azure.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(List.of(server("beta", alphaRefUpper), server("alpha", "k2"))),
                renamedUpper,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    String betaRef = referenceOf(reused, "beta");
    String alphaFreshRef = referenceOf(reused, "alpha");
    assertNotEquals(
        azure.canonicalSecretName(betaRef.substring(SecretsManager.SECRET_FIELD_PREFIX.length())),
        azure.canonicalSecretName(
            alphaFreshRef.substring(SecretsManager.SECRET_FIELD_PREFIX.length())));
    assertEquals("k1", azure.getSecretValue(betaRef));
    assertEquals("k2", azure.getSecretValue(alphaFreshRef));

    // 2. Soft-deleted name (HTTP 409) falls back to a fresh id automatically.
    McpConnection gammaCreated =
        (McpConnection)
            azure.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("gamma", "g1"))),
                null,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    McpConnection gammaCleared =
        (McpConnection)
            azure.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("gamma", ""))),
                gammaCreated,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    McpConnection gammaRecreated =
        (McpConnection)
            azure.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("gamma", "g2"))),
                gammaCleared,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    String gammaRef = referenceOf(gammaRecreated, "gamma");
    assertNotEquals(referenceOf(gammaCreated, "gamma"), gammaRef);
    assertEquals("g2", azure.getSecretValue(gammaRef));

    // 3. Long server name near Azure's 127-char limit uses compact fallback without exceeding 127.
    String longName = "s".repeat(80);
    McpConnection longCreated =
        (McpConnection)
            azure.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server(longName, "long-1"))),
                null,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    McpConnection longReused =
        (McpConnection)
            azure.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(
                        List.of(
                            copy(longCreated.getServers().getFirst()).withName("other"),
                            server(longName, "long-2"))),
                longCreated,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    String longFreshName =
        referenceOf(longReused, longName).substring(SecretsManager.SECRET_FIELD_PREFIX.length());
    assertTrue(longFreshName.length() <= azure.maxSecretIdLength());
    assertEquals("long-1", azure.getSecretValue(referenceOf(longReused, "other")));
    assertEquals("long-2", azure.getSecretValue(referenceOf(longReused, longName)));
  }

  @Test
  void awsArnReferenceAndUnderscoreGcpStyleSeparatorsPreventOverwrite() {
    // AWS ARN spelling still matches canonical secret name and blocks overwrite.
    InMemorySecretsManager awsStyle =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig(CLUSTER, "prefix", List.of(), null)) {
          private final Pattern arn =
              Pattern.compile(
                  "^arn:aws:secretsmanager:[^:]+:[^:]+:secret:(.+?)(-[A-Za-z0-9]{6})?$");

          @Override
          protected String canonicalSecretName(String secretName) {
            var matcher = arn.matcher(secretName);
            return matcher.matches() ? matcher.group(1) : secretName;
          }
        };
    McpConnection created =
        (McpConnection)
            awsStyle.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("alpha", "k1"))),
                null,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    String rawId =
        referenceOf(created, "alpha").substring(SecretsManager.SECRET_FIELD_PREFIX.length());
    String arnRef =
        SecretsManager.SECRET_FIELD_PREFIX
            + "arn:aws:secretsmanager:us-east-1:123456789012:secret:"
            + rawId
            + "-AbCdEf";
    McpConnection reused =
        (McpConnection)
            awsStyle.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(List.of(server("beta", arnRef), server("alpha", "k2"))),
                new McpConnection().withServers(List.of(server("beta", arnRef))),
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    assertEquals("k1", awsStyle.getSecretsMap().get(rawId));
    assertEquals("k2", resolveKey(awsStyle, reused, "alpha"));

    // Underscore separator (GCP style) with max-length cap.
    InMemorySecretsManager gcpStyle =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig(CLUSTER, "prefix", List.of(), null)) {
          @Override
          protected SecretsIdConfig builSecretsIdConfig() {
            return new SecretsIdConfig("_", Boolean.FALSE, "", Pattern.compile("[^A-Za-z0-9_]"));
          }

          @Override
          protected int maxSecretIdLength() {
            return 255;
          }
        };
    McpConnection gcpCreated =
        (McpConnection)
            gcpStyle.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("alpha", "gcp-1"))),
                null,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    McpConnection gcpReused =
        (McpConnection)
            gcpStyle.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(
                        List.of(
                            copy(gcpCreated.getServers().getFirst()).withName("beta"),
                            server("alpha", "gcp-2"))),
                gcpCreated,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    assertEquals("gcp-1", resolveKey(gcpStyle, gcpReused, "beta"));
    assertEquals("gcp-2", resolveKey(gcpStyle, gcpReused, "alpha"));
  }

  @Test
  void kubernetesLongServerNameUsesCompactFreshIdWithoutTruncatingSuffix() throws Exception {
    Parameters params = new Parameters();
    params.setAdditionalProperty("skipInit", "true");
    KubernetesSecretsManager k8s =
        KubernetesSecretsManager.getInstance(
            new SecretsManager.SecretsConfig(CLUSTER, "prefix", List.of(), params));
    Map<String, String> k8sStore = new HashMap<>();
    CoreV1Api api = mock(CoreV1Api.class);
    k8s.setApiClient(api);
    k8s.setNamespace("default");

    when(api.readNamespacedSecret(anyString(), anyString()))
        .thenAnswer(
            call -> {
              String name = call.getArgument(0);
              CoreV1Api.APIreadNamespacedSecretRequest req =
                  mock(CoreV1Api.APIreadNamespacedSecretRequest.class);
              when(req.execute())
                  .thenAnswer(
                      unused -> {
                        String val = k8sStore.get(name);
                        if (val == null) {
                          throw new io.kubernetes.client.openapi.ApiException(404, "not found");
                        }
                        return new V1Secret()
                            .data(Map.of("value", val.getBytes(StandardCharsets.UTF_8)));
                      });
              return req;
            });
    when(api.createNamespacedSecret(anyString(), any(V1Secret.class)))
        .thenAnswer(
            call -> {
              V1Secret secret = call.getArgument(1);
              CoreV1Api.APIcreateNamespacedSecretRequest req =
                  mock(CoreV1Api.APIcreateNamespacedSecretRequest.class);
              when(req.execute())
                  .thenAnswer(
                      unused -> {
                        k8sStore.put(
                            secret.getMetadata().getName(),
                            new String(secret.getData().get("value"), StandardCharsets.UTF_8));
                        return secret;
                      });
              return req;
            });

    String longName = "k".repeat(210);
    McpConnection created =
        (McpConnection)
            k8s.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server(longName, "k8s-1"))),
                null,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    McpConnection reused =
        (McpConnection)
            k8s.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(
                        List.of(
                            copy(created.getServers().getFirst()).withName("other"),
                            server(longName, "k8s-2"))),
                created,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    String otherRef = referenceOf(reused, "other");
    String freshRef = referenceOf(reused, longName);
    String freshName = freshRef.substring(SecretsManager.SECRET_FIELD_PREFIX.length());
    assertNotEquals(otherRef, freshRef);
    assertTrue(freshName.length() <= k8s.maxSecretIdLength());
    assertEquals("k8s-1", k8s.getSecretValue(otherRef));
    assertEquals("k8s-2", k8s.getSecretValue(freshRef));
  }

  @Test
  void databaseSecretsManagerAndPreparePathStayUnaffected() {
    DBSecretsManager db =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig(CLUSTER, null, List.of(), null));
    McpConnection dbCreated =
        (McpConnection)
            db.encryptServiceConnectionConfig(
                new McpConnection().withServers(List.of(server("alpha", "db-1"))),
                null,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    McpConnection dbReused =
        (McpConnection)
            db.encryptServiceConnectionConfig(
                new McpConnection()
                    .withServers(
                        List.of(
                            copy(dbCreated.getServers().getFirst()).withName("beta"),
                            server("alpha", "db-2"))),
                dbCreated,
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    assertEquals("db-1", referenceOf(dbReused, "beta"));
    assertEquals("db-2", referenceOf(dbReused, "alpha"));

    InMemorySecretsManager vault = inMemoryVault();
    McpConnection prepared =
        (McpConnection)
            vault.prepareServiceConnectionConfig(
                new McpConnection()
                    .withServers(
                        List.of(
                            server(
                                "beta", "secret:/openmetadata/mcp/mcp-edge/servers/alpha/apikey"),
                            server("alpha", "staged-key"))),
                "Mcp",
                SERVICE,
                ServiceType.MCP);
    assertTrue(vault.getSecretsMap().isEmpty());
    assertEquals("staged-key", referenceOf(prepared, "alpha"));
  }

  private static InMemorySecretsManager inMemoryVault() {
    return new InMemorySecretsManager(
        new SecretsManager.SecretsConfig(CLUSTER, null, List.of(), null));
  }

  private static McpServerConfig server(String name, String apiKey) {
    return new McpServerConfig()
        .withName(name)
        .withUrl("https://" + name + ".example.com/mcp")
        .withApiKey(apiKey);
  }

  private static McpServerConfig copy(McpServerConfig server) {
    return JsonUtils.deepCopy(server, McpServerConfig.class);
  }

  private static McpService mcpService(UUID id, List<McpServerConfig> servers) {
    return mcpService(id, SERVICE, servers);
  }

  private static McpService mcpService(UUID id, String name, List<McpServerConfig> servers) {
    return new McpService()
        .withId(id)
        .withName(name)
        .withFullyQualifiedName(name)
        .withServiceType(McpServiceType.Mcp)
        .withConnection(
            new org.openmetadata.schema.type.McpConnection()
                .withConfig(new McpConnection().withServers(servers)));
  }

  private static McpConnection configOf(McpService service) {
    return JsonUtils.convertValue(service.getConnection().getConfig(), McpConnection.class);
  }

  private static String referenceOf(McpConnection connection, String name) {
    String apiKey =
        connection.getServers().stream()
            .filter(server -> name.equals(server.getName()))
            .findFirst()
            .orElseThrow()
            .getApiKey();
    return Fernet.isTokenized(apiKey) ? Fernet.getInstance().decrypt(apiKey) : apiKey;
  }

  private static String resolveKey(
      ExternalSecretsManager vault, McpConnection connection, String name) {
    return vault.getSecretValue(referenceOf(connection, name));
  }

  private static EntityExtensionDAO mockExtensionDao() {
    EntityExtensionDAO dao = mock(EntityExtensionDAO.class);
    Map<UUID, String> rows = new HashMap<>();
    when(dao.getExtensionForUpdate(any(), anyString()))
        .thenAnswer(call -> rows.get(call.getArgument(0)));
    doAnswer(
            call -> {
              rows.put(call.getArgument(0), call.getArgument(3));
              return null;
            })
        .when(dao)
        .insert(any(), anyString(), anyString(), anyString());
    doAnswer(
            call -> {
              rows.remove(call.getArgument(0));
              return null;
            })
        .when(dao)
        .delete(any(), anyString());
    return dao;
  }

  private static CollectionDAO.McpServiceDAO mockMcpDao(AtomicReference<String> committedJson) {
    CollectionDAO collection = mockCollectionDao();
    CollectionDAO.McpServiceDAO dao = mock(CollectionDAO.McpServiceDAO.class);
    when(dao.getEntityClass()).thenReturn(McpService.class);
    when(dao.getTableName()).thenReturn("mcp_service_entity");
    when(dao.getNameHashColumn()).thenReturn("nameHash");
    when(dao.findJsonByIdForUpdate(any(UUID.class), any())).thenAnswer(call -> committedJson.get());
    doAnswer(
            call -> {
              committedJson.set(call.getArgument(3));
              return null;
            })
        .when(dao)
        .insert(anyString(), anyString(), anyString(), anyString());
    doAnswer(
            call -> {
              committedJson.set(call.getArgument(2));
              return null;
            })
        .when(dao)
        .update(any(UUID.class), anyString(), anyString());
    Entity.setCollectionDAO(collection);
    return dao;
  }

  private static CollectionDAO.McpServiceDAO mockBatchMcpDao(Map<UUID, String> committedById) {
    CollectionDAO collection = mockCollectionDao();
    CollectionDAO.McpServiceDAO dao = mock(CollectionDAO.McpServiceDAO.class);
    when(dao.getEntityClass()).thenReturn(McpService.class);
    when(dao.getTableName()).thenReturn("mcp_service_entity");
    when(dao.getNameHashColumn()).thenReturn("nameHash");
    when(dao.findJsonByIdForUpdate(any(UUID.class), any()))
        .thenAnswer(call -> committedById.get(call.getArgument(0)));
    doAnswer(
            call -> {
              String json = call.getArgument(3);
              McpService saved = JsonUtils.readValue(json, McpService.class);
              committedById.put(saved.getId(), json);
              return null;
            })
        .when(dao)
        .insert(anyString(), anyString(), anyString(), anyString());
    doAnswer(
            call -> {
              committedById.put(call.getArgument(0), call.getArgument(2));
              return null;
            })
        .when(dao)
        .update(any(UUID.class), anyString(), anyString());
    doAnswer(
            call -> {
              List<String> jsons = call.getArgument(4);
              for (String json : jsons) {
                McpService saved = JsonUtils.readValue(json, McpService.class);
                committedById.put(saved.getId(), json);
              }
              return null;
            })
        .when(dao)
        .updateMany(anyString(), anyString(), anyList(), anyList(), anyList());
    Entity.setCollectionDAO(collection);
    return dao;
  }

  private static CollectionDAO mockCollectionDao() {
    EntityExtensionDAO extensionDao = mockExtensionDao();
    CollectionDAO collection = mock(CollectionDAO.class);
    when(collection.entityExtensionDAO()).thenReturn(extensionDao);
    when(collection.inTransaction(
            ArgumentMatchers.<TransactionalCallback<Object, CollectionDAO, RuntimeException>>any()))
        .thenAnswer(
            invocation ->
                invocation
                    .<TransactionalCallback<Object, CollectionDAO, RuntimeException>>getArgument(0)
                    .inTransaction(collection));
    return collection;
  }

  private static class McpTestRepository
      extends ServiceEntityRepository<McpService, org.openmetadata.schema.type.McpConnection> {
    McpTestRepository(CollectionDAO.McpServiceDAO dao) {
      super(
          "/v1/services/mcpServices/",
          Entity.MCP_SERVICE,
          dao,
          org.openmetadata.schema.type.McpConnection.class,
          "",
          ServiceType.MCP);
    }

    void updateManyPublic(List<McpService> services) {
      updateMany(services);
    }
  }

  private static final class SoftDeletingAzureClient {
    private final Map<String, String> live = new HashMap<>();
    private final Map<String, String> deleted = new HashMap<>();
    private final SecretClient client = mock(SecretClient.class);

    @SuppressWarnings("unchecked")
    private SoftDeletingAzureClient() {
      when(client.setSecret(any(KeyVaultSecret.class)))
          .thenAnswer(call -> set(call.getArgument(0)));
      when(client.getSecret(anyString()))
          .thenAnswer(
              call -> {
                String name = ((String) call.getArgument(0)).toLowerCase(Locale.ROOT);
                String val = live.get(name);
                if (val == null) {
                  throw new IllegalStateException("missing " + name);
                }
                return new KeyVaultSecret(name, val);
              });
      when(client.beginDeleteSecret(anyString()))
          .thenAnswer(
              call -> {
                String name = ((String) call.getArgument(0)).toLowerCase(Locale.ROOT);
                if (live.containsKey(name)) {
                  deleted.put(name, live.remove(name));
                }
                return mock(SyncPoller.class);
              });
    }

    private KeyVaultSecret set(KeyVaultSecret secret) {
      String key = secret.getName().toLowerCase(Locale.ROOT);
      if (deleted.containsKey(key)) {
        HttpResponse response = mock(HttpResponse.class);
        when(response.getStatusCode()).thenReturn(409);
        throw new HttpResponseException("deleted but recoverable", response);
      }
      live.put(key, secret.getValue());
      return secret;
    }
  }
}
