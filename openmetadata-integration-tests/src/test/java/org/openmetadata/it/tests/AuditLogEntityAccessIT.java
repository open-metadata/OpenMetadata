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
import java.util.stream.StreamSupport;
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
import org.openmetadata.schema.api.feed.CreateAnnouncement;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.LineageRepository;

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

    hardDeleteAndAwait(type, entity);
    assertEquals(
        404,
        assertThrows(ApiException.class, () -> get(SdkClients.user1Client(), AUDIT_PATH, filters))
            .getStatusCode());
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
    assertTrue(
        get(SdkClients.user1Client(), AUDIT_PATH, filters).toString().contains(file.getName()));
  }

  @ParameterizedTest
  @ValueSource(strings = {Entity.CONTEXT_MEMORY, Entity.CONTEXT_FILE})
  void reusingANameKeepsThePreviousEntitysEntriesSeparate(String type, TestNamespace ns) {
    final EntityInterface<?> previous = createPrivateEntity(type, ns);
    final Map<String, String> filters = entityFilters(type, previous);
    awaitEntries(filters);
    hardDeleteAndAwait(type, previous);
    final EntityInterface<?> current = createPrivateEntity(type, ns);
    request(
        SdkClients.adminClient(),
        HttpMethod.PATCH,
        entityPath(type) + "/" + current.getId(),
        sharingPatch(MemoryVisibility.ENTITY));
    await()
        .atMost(Duration.ofSeconds(60))
        .untilAsserted(
            () -> {
              final JsonNode admin = get(SdkClients.adminClient(), AUDIT_PATH, filters);
              final JsonNode reader = get(SdkClients.user2Client(), AUDIT_PATH, filters);
              assertFalse(reader.path("data").isEmpty());
              assertFalse(
                  reader.toString().contains(previous.getId().toString()), reader.toString());
              final long currentCount =
                  StreamSupport.stream(admin.path("data").spliterator(), false)
                      .filter(
                          entry ->
                              current.getId().toString().equals(entry.path("entityId").asText()))
                      .count();
              assertEquals(currentCount, reader.path("paging").path("total").asLong());
              assertEntriesFor(SdkClients.user2Client(), filters, current);
            });
  }

  @ParameterizedTest
  @ValueSource(strings = {"CONTEXTMEMORY", "CONTEXTFILE", "ANNOUNCEMENT", "contextMémory"})
  void collectionTypesUseTheirRegisteredSpelling(String type) {
    assertThrows(
        InvalidRequestException.class,
        () -> get(SdkClients.user2Client(), AUDIT_PATH, Map.of("entityType", type)));
  }

  @Test
  void lineageAuditFiltersRemainAvailable() {
    assertTrue(
        get(
                SdkClients.adminClient(),
                AUDIT_PATH,
                Map.of("entityType", LineageRepository.LINEAGE_ENTITY_TYPE))
            .path("data")
            .isArray());
  }

  @Test
  void aFilePolicyAlsoAppliesToMemoryAuditReferences(TestNamespace ns) {
    final ContextFile file =
        ns.trackRoot(
            Entity.CONTEXT_FILE,
            create(
                SdkClients.adminClient(),
                FILE_PATH,
                new CreateContextFile().withName(ns.prefix("policy-file")),
                ContextFile.class));
    final ContextMemory memory =
        ns.trackRoot(
            Entity.CONTEXT_MEMORY,
            create(
                SdkClients.adminClient(),
                MEMORY_PATH,
                memoryRequest(ns, MemoryVisibility.ENTITY)
                    .withSourceEntity(file.getEntityReference()),
                ContextMemory.class));
    final OpenMetadataClient reader = filePolicyReader(ns);
    final Map<String, String> filters = entityFilters(Entity.CONTEXT_MEMORY, memory);
    awaitEntries(filters);
    assertThrows(
        ForbiddenException.class, () -> get(reader, FILE_PATH + "/" + file.getId(), Map.of()));
    assertEquals(
        memory.getId().toString(),
        get(reader, MEMORY_PATH + "/" + memory.getId(), Map.of()).path("id").asText());
    final String audit = get(reader, AUDIT_PATH, filters).toString();
    assertFalse(audit.contains(file.getName()), audit);
    assertTrue(audit.contains(file.getId().toString()), audit);
  }

  @Test
  void anAnnouncementAuditRequiresViewOnItsLinkedEntity(TestNamespace ns) {
    final ContextFile file =
        ns.trackRoot(
            Entity.CONTEXT_FILE,
            create(
                SdkClients.adminClient(),
                FILE_PATH,
                new CreateContextFile().withName(ns.prefix("announced-file")),
                ContextFile.class));
    final long now = System.currentTimeMillis();
    final Announcement announcement =
        ns.trackRoot(
            Entity.ANNOUNCEMENT,
            create(
                SdkClients.adminClient(),
                "/v1/announcements",
                new CreateAnnouncement()
                    .withName(ns.prefix("file-announcement"))
                    .withDescription("Updated retention policy")
                    .withEntityLink(
                        "<#E::" + Entity.CONTEXT_FILE + "::" + file.getFullyQualifiedName() + ">")
                    .withStartTime(now)
                    .withEndTime(now + Duration.ofDays(1).toMillis()),
                Announcement.class));
    final OpenMetadataClient reader = filePolicyReader(ns);
    final Map<String, String> filters = entityFilters(Entity.ANNOUNCEMENT, announcement);
    awaitEntries(filters);
    assertThrows(
        ForbiddenException.class,
        () -> get(reader, "/v1/announcements/" + announcement.getId(), Map.of()));
    assertThrows(ForbiddenException.class, () -> get(reader, AUDIT_PATH, filters));
    assertEntriesFor(SdkClients.adminClient(), filters, announcement);
  }

  private OpenMetadataClient filePolicyReader(TestNamespace ns) {
    final Policy policy =
        ns.trackRoot(
            Entity.POLICY,
            SdkClients.adminClient()
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(ns.prefix("audit-file-policy"))
                        .withRules(
                            List.of(
                                new Rule()
                                    .withName("DenyFileView")
                                    .withEffect(Rule.Effect.DENY)
                                    .withOperations(List.of(MetadataOperation.VIEW_ALL))
                                    .withResources(List.of(Entity.CONTEXT_FILE))))));
    final Role role =
        ns.trackRoot(
            Entity.ROLE,
            SdkClients.adminClient()
                .roles()
                .create(
                    new CreateRole()
                        .withName(ns.prefix("audit-file-role"))
                        .withPolicies(List.of(policy.getFullyQualifiedName()))));
    final String name = ns.shortPrefix("audit-reader");
    final User user =
        ns.trackRoot(
            Entity.USER,
            SdkClients.adminClient()
                .users()
                .create(
                    new CreateUser()
                        .withName(name)
                        .withEmail(name + "@test.openmetadata.org")
                        .withRoles(List.of(role.getId()))));
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private static Object sharingPatch(MemoryVisibility visibility) {
    return List.of(
        Map.of(
            "op",
            "add",
            "path",
            "/shareConfig",
            "value",
            new MemoryShareConfig().withVisibility(visibility)));
  }

  private EntityInterface<?> createPrivateEntity(String type, TestNamespace ns) {
    return Entity.CONTEXT_MEMORY.equals(type)
        ? createMemory(ns, MemoryVisibility.PRIVATE)
        : createPrivateFile(ns);
  }

  private ContextFile createPrivateFile(TestNamespace ns) {
    final ContextFile file =
        ns.trackRoot(
            Entity.CONTEXT_FILE,
            create(
                SdkClients.adminClient(),
                FILE_PATH,
                new CreateContextFile()
                    .withName(ns.prefix("audit-file"))
                    .withOwners(List.of(SharedEntities.get().USER1_REF)),
                ContextFile.class));
    return JsonUtils.readValue(
        request(
            SdkClients.adminClient(),
            HttpMethod.PATCH,
            FILE_PATH + "/" + file.getId(),
            sharingPatch(MemoryVisibility.PRIVATE)),
        ContextFile.class);
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
                            .withPrincipal(SharedEntities.get().USER2.getEntityReference()))));
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

  private void hardDeleteAndAwait(String type, EntityInterface<?> entity) {
    final String path = entityPath(type) + "/" + entity.getId();
    request(SdkClients.adminClient(), HttpMethod.DELETE, path + "?hardDelete=true", null);
    await()
        .atMost(Duration.ofSeconds(60))
        .untilAsserted(
            () ->
                assertEquals(
                    404,
                    assertThrows(
                            ApiException.class,
                            () -> get(SdkClients.adminClient(), path, Map.of("include", "all")))
                        .getStatusCode()));
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
    final RequestOptions.Builder options = RequestOptions.builder();
    if (method == HttpMethod.PATCH) {
      options.header("Content-Type", "application/json-patch+json");
    }
    return client
        .getHttpClient()
        .executeForString(
            method, path, body == null ? null : JsonUtils.pojoToJson(body), options.build());
  }
}
