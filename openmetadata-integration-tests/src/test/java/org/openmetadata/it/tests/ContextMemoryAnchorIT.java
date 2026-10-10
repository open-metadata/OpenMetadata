package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.sdk.services.search.SearchAPI;
import org.openmetadata.service.Entity;

/** A memory anchored to an asset takes the asset's governance: its domain on create, its readers on read. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ContextMemoryAnchorIT {

  @Test
  void anAnchoredMemoryWithoutDomains_takesTheAnchorsDomain(TestNamespace ns) {
    Domain domain = createDomain(ns, "sales");
    Table anchor = tableInDomain(ns, domain);

    ContextMemory memory =
        adminMemories()
            .create(
                entityMemory(ns, "in-domain").withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));

    assertEquals(List.of(domain.getId()), domainIds(memory));
  }

  @Test
  void explicitDomains_winOverTheAnchors(TestNamespace ns) {
    Table anchor = tableInDomain(ns, createDomain(ns, "sales"));
    Domain own = createDomain(ns, "finance");

    ContextMemory memory =
        adminMemories()
            .create(
                entityMemory(ns, "own-domain")
                    .withPrimaryEntity(ref(Entity.TABLE, anchor.getId()))
                    .withDomains(List.of(own.getFullyQualifiedName())));

    assertEquals(List.of(own.getId()), domainIds(memory));
  }

  @Test
  void aMultiDomainAnchor_isNotCopied(TestNamespace ns) {
    List<String> twoDomains =
        List.of(
            createDomain(ns, "first").getFullyQualifiedName(),
            createDomain(ns, "second").getFullyQualifiedName());
    User anchor = createUser(ns, null, twoDomains);

    ContextMemory memory =
        adminMemories()
            .create(
                entityMemory(ns, "multi-domain")
                    .withPrimaryEntity(ref(Entity.USER, anchor.getId())));

    assertTrue(
        domainIds(memory).isEmpty(),
        "two domains would break 'Multiple Domains are not allowed' on every later PATCH");
  }

  @Test
  void getAndGetByName_hideAMemoryWhoseAnchorTheCallerCannotView(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    ContextMemory anchored =
        adminMemories()
            .create(
                entityMemory(ns, "anchored").withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));
    ContextMemoryService reader = memoriesAs(createUser(ns, null, null));
    ContextMemoryService blocked = memoriesAs(createUser(ns, denyTableView(ns), null));

    assertEquals(anchored.getId(), reader.get(anchored.getId().toString()).getId());
    assertThrows(ForbiddenException.class, () -> blocked.get(anchored.getId().toString()));
    assertThrows(
        ForbiddenException.class, () -> blocked.getByName(anchored.getFullyQualifiedName()));
  }

  @Test
  void listing_dropsMemoriesWhoseAnchorTheCallerCannotView(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    ContextMemory anchored =
        adminMemories()
            .create(
                entityMemory(ns, "listed").withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));
    ListParams byAnchor =
        new ListParams().setLimit(100).addFilter("primaryEntityId", anchor.getId().toString());

    assertEquals(
        List.of(anchored.getId()), ids(memoriesAs(createUser(ns, null, null)).list(byAnchor)));
    assertTrue(ids(memoriesAs(createUser(ns, denyTableView(ns), null)).list(byAnchor)).isEmpty());
  }

  @Test
  void searchOnlyReturnsUnanchoredEntityMemoriesToNonOwners(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    String query = "anchorcheck" + UUID.randomUUID().toString().substring(0, 8);
    ContextMemory anchored =
        adminMemories()
            .create(
                entityMemory(ns, "search-anchored")
                    .withQuestion(query)
                    .withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));
    ContextMemory unanchored =
        adminMemories().create(entityMemory(ns, "search-unanchored").withQuestion(query));
    ListParams params = new ListParams().setLimit(100).addQueryParam("q", query);
    User readerUser = createUser(ns, null, null);
    OpenMetadataClient readerClient =
        SdkClients.createClient(readerUser.getEmail(), readerUser.getEmail(), new String[] {});
    ContextMemoryService reader = new ContextMemoryService(readerClient.getHttpClient());

    Awaitility.await()
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertTrue(
                    ids(adminMemories().list(params))
                        .containsAll(List.of(anchored.getId(), unanchored.getId()))));

    assertEquals(anchored.getId(), reader.get(anchored.getId().toString()).getId());
    assertEquals(List.of(unanchored.getId()), ids(reader.list(params)));
    assertTrue(
        readerClient
            .search()
            .query(query)
            .index("context_memory_search_index")
            .execute()
            .contains(unanchored.getId().toString()));
    assertFalse(
        readerClient
            .search()
            .query(query)
            .index("context_memory_search_index")
            .execute()
            .contains(anchored.getId().toString()));
  }

  /**
   * A search that pins the anchor it asks about returns that anchor's memories to its readers,
   * exactly as REST does (ADR:2026-10-09-search-admits-memories-of-pinned-anchors). Free text that
   * pins nothing keeps the conservative rule above.
   */
  @Test
  void aSearchPinnedToAnAnchor_agreesWithRestOnItsMemories(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    String query = "pinnedanchor" + UUID.randomUUID().toString().substring(0, 8);
    ContextMemory shown =
        adminMemories()
            .create(
                entityMemory(ns, "pinned-shown")
                    .withQuestion(query)
                    .withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));
    ContextMemory privateOne =
        adminMemories()
            .create(
                privateMemory(ns, "pinned-private")
                    .withQuestion(query)
                    .withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));
    User reader = createUser(ns, null, null);
    User blocked = createUser(ns, denyTableView(ns), null);
    String pinned = pinnedTo(anchor.getId());
    ListParams byAnchor =
        new ListParams().setLimit(100).addFilter("primaryEntityId", anchor.getId().toString());

    Awaitility.await()
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertEquals(
                    Set.of(shown.getId(), privateOne.getId()),
                    searchHits(SdkClients.adminClient(), query, pinned)));

    assertEquals(List.of(shown.getId()), ids(memoriesAs(reader).list(byAnchor)));
    assertEquals(Set.of(shown.getId()), searchHits(clientOf(reader), query, pinned));
    assertTrue(ids(memoriesAs(blocked).list(byAnchor)).isEmpty());
    assertTrue(searchHits(clientOf(blocked), query, pinned).isEmpty());
    assertEquals(1, countedHits(clientOf(reader), query, pinned), "counts agree with the hits");
    assertEquals(0, countedHits(clientOf(blocked), query, pinned));
    assertTrue(
        searchHits(clientOf(reader), query, null).isEmpty(),
        "free text that pins no anchor keeps anchored memories owner-only");
  }

  /** A file anchor is read by the file's own sharing too, in a pinned search as in REST. */
  @Test
  void aSearchPinnedToAPrivateFile_showsItsMemoriesToTheFileOwnerOnly(TestNamespace ns) {
    User fileOwner = createUser(ns, null, null);
    ContextFile file = privateFileOwnedBy(ns, fileOwner);
    String query = "privatefile" + UUID.randomUUID().toString().substring(0, 8);
    ContextMemory memory =
        adminMemories()
            .create(
                entityMemory(ns, "private-file-pinned")
                    .withQuestion(query)
                    .withPrimaryEntity(file.getEntityReference()));
    String pinned = pinnedTo(file.getId());

    Awaitility.await()
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertEquals(
                    Set.of(memory.getId()), searchHits(SdkClients.adminClient(), query, pinned)));

    assertEquals(Set.of(memory.getId()), searchHits(clientOf(fileOwner), query, pinned));
    assertTrue(searchHits(clientOf(createUser(ns, null, null)), query, pinned).isEmpty());
  }

  @Test
  void theContextCenterListingFilteredByAnAsset_showsItsReadersItsMemories(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    ContextMemory anchored =
        adminMemories()
            .create(
                entityMemory(ns, "listed-by-asset")
                    .withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));
    ListParams byAsset =
        new ListParams().setLimit(100).addQueryParam("assets", anchor.getId().toString());

    Awaitility.await()
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () -> assertTrue(ids(adminMemories().list(byAsset)).contains(anchored.getId())));

    assertEquals(
        List.of(anchored.getId()), ids(memoriesAs(createUser(ns, null, null)).list(byAsset)));
    assertTrue(ids(memoriesAs(createUser(ns, denyTableView(ns), null)).list(byAsset)).isEmpty());
  }

  @Test
  void fileExtractedMemoriesRemainAnchoredInSearch(TestNamespace ns) {
    ContextFile file =
        ns.trackRoot(
            Entity.CONTEXT_FILE,
            SdkClients.adminClient()
                .contextFiles()
                .create(new CreateContextFile().withName(ns.prefix("source-file"))));
    String query = "fileanchor" + UUID.randomUUID().toString().substring(0, 8);
    ContextMemory extracted =
        adminMemories()
            .create(
                entityMemory(ns, "file-extracted")
                    .withQuestion(query)
                    .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
                    .withSourceEntity(file.getEntityReference())
                    .withPrimaryEntity(file.getEntityReference()));
    User reader = createUser(ns, null, null);
    ContextMemoryService readerMemories = memoriesAs(reader);
    ListParams params = new ListParams().setLimit(100).addQueryParam("q", query);

    assertEquals(extracted.getId(), readerMemories.get(extracted.getId().toString()).getId());
    Awaitility.await()
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () -> assertTrue(ids(adminMemories().list(params)).contains(extracted.getId())));
    assertFalse(ids(readerMemories.list(params)).contains(extracted.getId()));
  }

  @Test
  void aPrivateFileHidesItsAnchoredMemoryFromOtherReaders(TestNamespace ns) {
    User fileOwner = createUser(ns, null, null);
    ContextFile file = privateFileOwnedBy(ns, fileOwner);
    ContextMemory memory =
        adminMemories()
            .create(
                entityMemory(ns, "private-file-memory")
                    .withPrimaryEntity(file.getEntityReference()));

    assertEquals(memory.getId(), memoriesAs(fileOwner).get(memory.getId().toString()).getId());
    assertThrows(
        ForbiddenException.class,
        () -> memoriesAs(createUser(ns, null, null)).get(memory.getId().toString()));
  }

  @Test
  void theOwnerKeepsTheirAnchoredMemory(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    User owner = createUser(ns, denyTableView(ns), null);
    String query = "owneranchor" + UUID.randomUUID().toString().substring(0, 8);
    ContextMemory owned =
        adminMemories()
            .create(
                entityMemory(ns, "owned")
                    .withQuestion(query)
                    .withPrimaryEntity(ref(Entity.TABLE, anchor.getId()))
                    .withOwners(List.of(ref(Entity.USER, owner.getId()))));
    ContextMemoryService ownerMemories = memoriesAs(owner);
    ContextMemoryService anchorViewer = memoriesAs(createUser(ns, null, null));
    ListParams params = new ListParams().setLimit(100).addQueryParam("q", query);
    ListParams invalidatedParams =
        new ListParams()
            .setLimit(100)
            .addQueryParam("q", query)
            .addQueryParam("statuses", "Rejected");

    assertEquals(owned.getId(), ownerMemories.get(owned.getId().toString()).getId());
    Awaitility.await()
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertTrue(ids(ownerMemories.list(params)).contains(owned.getId()));
              assertTrue(ids(adminMemories().list(params)).contains(owned.getId()));
            });

    adminMemories()
        .patch(
            owned.getId().toString(),
            JsonUtils.readTree(
                "[{\"op\":\"replace\",\"path\":\"/entityStatus\",\"value\":\"Rejected\"}]"));
    Awaitility.await()
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertFalse(ids(ownerMemories.list(params)).contains(owned.getId()));
              assertFalse(ids(adminMemories().list(params)).contains(owned.getId()));
              assertTrue(ids(ownerMemories.list(invalidatedParams)).contains(owned.getId()));
              assertTrue(ids(adminMemories().list(invalidatedParams)).contains(owned.getId()));
              assertFalse(ids(anchorViewer.list(invalidatedParams)).contains(owned.getId()));
            });
  }

  @Test
  void anUnanchoredEntityMemory_staysOrgWide(TestNamespace ns) {
    ContextMemory orgWide = adminMemories().create(entityMemory(ns, "org-wide"));
    ContextMemoryService blocked = memoriesAs(createUser(ns, denyTableView(ns), null));

    assertEquals(orgWide.getId(), blocked.get(orgWide.getId().toString()).getId());
  }

  @Test
  void versions_ofAMemoryWhoseAnchorTheCallerCannotView_areForbidden(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    ContextMemory anchored =
        adminMemories()
            .create(
                entityMemory(ns, "anchored-history")
                    .withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));
    ContextMemoryService reader = memoriesAs(createUser(ns, null, null));
    ContextMemoryService blocked = memoriesAs(createUser(ns, denyTableView(ns), null));
    String id = anchored.getId().toString();

    assertEquals(anchored.getId(), reader.getVersion(id, anchored.getVersion()).getId());
    assertThrows(ForbiddenException.class, () -> blocked.getVersionList(anchored.getId()));
    assertThrows(ForbiddenException.class, () -> blocked.getVersion(id, anchored.getVersion()));
  }

  @Test
  void listing_keepsItsCursorsAcrossRowsTheCallerCannotSee(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    EntityReference anchorRef = ref(Entity.TABLE, anchor.getId());
    adminMemories().create(privateMemory(ns, "a-hidden").withPrimaryEntity(anchorRef));
    adminMemories().create(privateMemory(ns, "b-hidden").withPrimaryEntity(anchorRef));
    ContextMemory visible =
        adminMemories().create(entityMemory(ns, "c-visible").withPrimaryEntity(anchorRef));
    ContextMemoryService reader = memoriesAs(createUser(ns, null, null));

    ListResponse<ContextMemory> firstPage = reader.list(pageOf(anchor, null));

    assertTrue(firstPage.getData().isEmpty());
    assertNotNull(firstPage.getPaging());
    assertNotNull(firstPage.getPaging().getAfter());
    assertEquals(List.of(visible.getId()), idsAcrossPages(reader, anchor));
  }

  private static ContextFile privateFileOwnedBy(TestNamespace ns, User owner) {
    ContextFile file =
        ns.trackRoot(
            Entity.CONTEXT_FILE,
            SdkClients.adminClient()
                .contextFiles()
                .create(
                    new CreateContextFile()
                        .withName(ns.prefix("private-source"))
                        .withOwners(List.of(ref(Entity.USER, owner.getId())))));
    SdkClients.adminClient()
        .contextFiles()
        .patch(
            file.getId(),
            JsonUtils.readTree(
                "[{\"op\":\"add\",\"path\":\"/shareConfig\",\"value\":{\"visibility\":\"Private\"}}]"));
    return file;
  }

  private static CreateContextMemory privateMemory(TestNamespace ns, String name) {
    return entityMemory(ns, name)
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
  }

  private static ListParams pageOf(Table anchor, String after) {
    ListParams params =
        new ListParams().setLimit(1).addFilter("primaryEntityId", anchor.getId().toString());
    return after == null ? params : params.setAfter(after);
  }

  private static List<UUID> idsAcrossPages(ContextMemoryService memories, Table anchor) {
    List<UUID> ids = new ArrayList<>();
    String after = null;
    int pages = 0;
    do {
      ListResponse<ContextMemory> page = memories.list(pageOf(anchor, after));
      page.getData().forEach(memory -> ids.add(memory.getId()));
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
      pages++;
    } while (after != null && pages < 10);
    return ids;
  }

  private static Role denyTableView(TestNamespace ns) {
    Rule deny =
        new Rule()
            .withName("DenyTableView")
            .withEffect(Rule.Effect.DENY)
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withResources(List.of(Entity.TABLE));
    Policy policy =
        SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy().withName(ns.prefix("deny-table-view")).withRules(List.of(deny)));
    return SdkClients.adminClient()
        .roles()
        .create(
            new CreateRole()
                .withName(ns.prefix("no-tables"))
                .withPolicies(List.of(policy.getFullyQualifiedName())));
  }

  private static ContextMemoryService memoriesAs(User user) {
    return new ContextMemoryService(clientOf(user).getHttpClient());
  }

  private static OpenMetadataClient clientOf(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private static String pinnedTo(UUID anchorId) {
    return "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"primaryEntity.id\":\""
        + anchorId
        + "\"}}]}}}";
  }

  /** The documents {@code /v1/search/entityTypeCounts} counts for {@code client}. */
  private static long countedHits(OpenMetadataClient client, String query, String queryFilter) {
    String response =
        client
            .search()
            .entityTypeCounts()
            .query(query)
            .index("context_memory_search_index")
            .queryFilter(queryFilter)
            .execute();
    return JsonUtils.readTree(response).path("hits").path("total").path("value").asLong();
  }

  /** The memory ids {@code /v1/search/query} returns to {@code client}. */
  private static Set<UUID> searchHits(OpenMetadataClient client, String query, String queryFilter) {
    SearchAPI.SearchBuilder search =
        client.search().query(query).index("context_memory_search_index").size(100);
    if (queryFilter != null) {
      search.queryFilter(queryFilter);
    }
    Set<UUID> hits = new HashSet<>();
    JsonUtils.readTree(search.execute())
        .path("hits")
        .path("hits")
        .forEach(hit -> hits.add(UUID.fromString(hit.path("_source").path("id").asText())));
    return hits;
  }

  private static List<UUID> ids(ListResponse<ContextMemory> response) {
    return response.getData().stream().map(ContextMemory::getId).toList();
  }

  private static List<UUID> domainIds(ContextMemory memory) {
    ContextMemory withDomains =
        adminMemories().get(memory.getId().toString(), Entity.FIELD_DOMAINS);
    return listOrEmpty(withDomains.getDomains()).stream().map(EntityReference::getId).toList();
  }

  private static Domain createDomain(TestNamespace ns, String name) {
    CreateDomain request =
        new CreateDomain()
            .withName(ns.prefix(name))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Context memory anchor domain");
    return ns.trackRoot(Entity.DOMAIN, SdkClients.adminClient().domains().create(request));
  }

  private static Table tableInDomain(TestNamespace ns, Domain domain) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    CreateTable request =
        new CreateTable()
            .withName(ns.prefix("orders"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .withDomains(List.of(domain.getFullyQualifiedName()));
    return SdkClients.adminClient().tables().create(request);
  }

  private static User createUser(TestNamespace ns, Role role, List<String> domains) {
    String name = "cmanchor_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser request =
        new CreateUser()
            .withName(name)
            .withEmail(name + "@test.openmetadata.org")
            .withDomains(domains);
    if (role != null) {
      request.withRoles(List.of(role.getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private static CreateContextMemory entityMemory(TestNamespace ns, String name) {
    return new CreateContextMemory()
        .withName(ns.prefix(name))
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withQuestion("Which column holds the order total?")
        .withAnswer("orders.amount_usd, in US dollars.")
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
  }

  private static EntityReference ref(String type, UUID id) {
    return new EntityReference().withId(id).withType(type);
  }

  private static ContextMemoryService adminMemories() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }
}
