package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
class AuditLogEntityAccessIT {
  private static final String AUDIT_PATH = "/v1/audit/logs";
  private static final String MEMORY_PATH = "/v1/contextCenter/memories";
  private static final String FILE_PATH = "/v1/contextCenter/drive/files";

  @ParameterizedTest
  @ValueSource(strings = {Entity.CONTEXT_MEMORY, Entity.CONTEXT_FILE})
  void privateEntityAuditEntriesFollowCurrentSharing(String type, TestNamespace ns) {
    final EntityInterface<?> entity = createPrivateEntity(type, ns);
    final String entityPath = entityPath(type) + "/" + entity.getId();
    final Map<String, String> filters = entityFilters(type, entity);
    awaitEntries(filters);

    assertThrows(
        ForbiddenException.class, () -> get(SdkClients.user2Client(), entityPath, Map.of()));
    assertThrows(
        ForbiddenException.class, () -> get(SdkClients.user2Client(), AUDIT_PATH, filters));
    assertEntriesFor(SdkClients.user1Client(), filters, entity);
    assertEntriesFor(SdkClients.adminClient(), filters, entity);

    request(SdkClients.adminClient(), HttpMethod.DELETE, entityPath, null);
    assertThrows(
        ForbiddenException.class, () -> get(SdkClients.user2Client(), AUDIT_PATH, filters));
    assertEntriesFor(SdkClients.user1Client(), filters, entity);
    assertEntriesFor(SdkClients.adminClient(), filters, entity);
  }

  @Test
  void aSharedMemoryAuditIsReadableByItsNamedReader(TestNamespace ns) {
    final ContextMemory memory = createMemory(ns, MemoryVisibility.SHARED);
    final Map<String, String> filters = entityFilters(Entity.CONTEXT_MEMORY, memory);
    awaitEntries(filters);

    assertEntriesFor(SdkClients.user2Client(), filters, memory);
    assertEquals(
        memory.getId().toString(),
        get(SdkClients.user2Client(), MEMORY_PATH + "/" + memory.getId(), Map.of())
            .path("id")
            .asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {Entity.CONTEXT_MEMORY, Entity.CONTEXT_FILE})
  void serviceFiltersDoNotReplaceAnEntityRead(String type, TestNamespace ns) {
    final EntityInterface<?> entity = createPrivateEntity(type, ns);
    final Map<String, String> entityFilter = entityFilters(type, entity);
    awaitEntries(entityFilter);
    final String serviceName =
        get(SdkClients.adminClient(), AUDIT_PATH, entityFilter)
            .path("data")
            .get(0)
            .path("serviceName")
            .asText();
    final Map<String, String> filters = Map.of("entityType", type, "serviceName", serviceName);
    assertThrows(
        ForbiddenException.class, () -> get(SdkClients.user2Client(), AUDIT_PATH, filters));
    assertEntriesFor(SdkClients.adminClient(), filters, entity);
  }

  @Test
  void auditExportsAndTheirResultsRequireAnAdminOrBot() {
    final OpenMetadataClient reader = SdkClients.user2Client();
    assertThrows(
        ForbiddenException.class,
        () ->
            get(
                reader,
                AUDIT_PATH + "/export",
                Map.of("startTs", "0", "endTs", Long.toString(System.currentTimeMillis()))));
    assertThrows(ForbiddenException.class, () -> get(reader, AUDIT_PATH + "/export/1", Map.of()));
    assertThrows(
        ForbiddenException.class, () -> get(reader, AUDIT_PATH + "/export/1/result", Map.of()));
  }

  @Test
  void aMemoryAuditNamesOnlyReadableSourceFiles(TestNamespace ns) {
    final ContextFile file = (ContextFile) createPrivateEntity(Entity.CONTEXT_FILE, ns);
    final CreateContextMemory create =
        memoryRequest(ns, MemoryVisibility.ENTITY)
            .withSourceEntity(file.getEntityReference())
            .withRelatedEntities(List.of(file.getEntityReference()));
    final ContextMemory memory =
        ns.trackRoot(
            Entity.CONTEXT_MEMORY,
            create(SdkClients.adminClient(), MEMORY_PATH, create, ContextMemory.class));
    final Map<String, String> filters = entityFilters(Entity.CONTEXT_MEMORY, memory);
    awaitEntries(filters);

    final String hidden = get(SdkClients.user2Client(), AUDIT_PATH, filters).toString();
    assertFalse(hidden.contains(file.getName()), hidden);
    assertTrue(hidden.contains(file.getId().toString()), hidden);
    assertTrue(
        get(SdkClients.adminClient(), AUDIT_PATH, filters).toString().contains(file.getName()));
  }

  private EntityInterface<?> createPrivateEntity(String type, TestNamespace ns) {
    return Entity.CONTEXT_MEMORY.equals(type)
        ? createMemory(ns, MemoryVisibility.PRIVATE)
        : ns.trackRoot(
            Entity.CONTEXT_FILE,
            create(
                SdkClients.adminClient(),
                FILE_PATH,
                new CreateContextFile()
                    .withName(ns.prefix("audit-file"))
                    .withOwners(List.of(SharedEntities.get().USER1_REF))
                    .withShareConfig(
                        new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)),
                ContextFile.class));
  }

  private ContextMemory createMemory(TestNamespace ns, MemoryVisibility visibility) {
    return ns.trackRoot(
        Entity.CONTEXT_MEMORY,
        create(
            SdkClients.adminClient(),
            MEMORY_PATH,
            memoryRequest(ns, visibility),
            ContextMemory.class));
  }

  private CreateContextMemory memoryRequest(TestNamespace ns, MemoryVisibility visibility) {
    return new CreateContextMemory()
        .withName(ns.prefix("audit-memory"))
        .withQuestion("What is the retention period?")
        .withAnswer("Keep records for thirty days.")
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withOwners(List.of(SharedEntities.get().USER1_REF))
        .withShareConfig(
            new MemoryShareConfig()
                .withVisibility(visibility)
                .withSharedWith(
                    List.of(
                        new MemorySharedPrincipal()
                            .withId(SharedEntities.get().USER2.getId())
                            .withType(Entity.USER)
                            .withName(SharedEntities.get().USER2.getName()))));
  }

  private void assertEntriesFor(
      OpenMetadataClient client, Map<String, String> filters, EntityInterface<?> entity) {
    final JsonNode entries = get(client, AUDIT_PATH, filters).path("data");
    assertFalse(entries.isEmpty());
    entries.forEach(
        entry -> assertEquals(entity.getId().toString(), entry.path("entityId").asText()));
  }

  private void awaitEntries(Map<String, String> filters) {
    await()
        .atMost(Duration.ofSeconds(60))
        .untilAsserted(
            () ->
                assertFalse(
                    get(SdkClients.adminClient(), AUDIT_PATH, filters).path("data").isEmpty()));
  }

  private static Map<String, String> entityFilters(String type, EntityInterface<?> entity) {
    return Map.of("entityType", type, "entityFQN", entity.getFullyQualifiedName());
  }

  private static String entityPath(String type) {
    return Entity.CONTEXT_MEMORY.equals(type) ? MEMORY_PATH : FILE_PATH;
  }

  private static JsonNode get(OpenMetadataClient client, String path, Map<String, String> filters) {
    final String query =
        filters.entrySet().stream()
            .map(
                entry ->
                    entry.getKey()
                        + "="
                        + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
            .collect(Collectors.joining("&"));
    return JsonUtils.readTree(request(client, HttpMethod.GET, path + "?" + query, null));
  }

  private static <T> T create(OpenMetadataClient client, String path, Object body, Class<T> type) {
    return JsonUtils.readValue(request(client, HttpMethod.POST, path, body), type);
  }

  private static String request(
      OpenMetadataClient client, HttpMethod method, String path, Object body) {
    return client
        .getHttpClient()
        .executeForString(
            method,
            path,
            body == null ? null : JsonUtils.pojoToJson(body),
            RequestOptions.builder().build());
  }
}
