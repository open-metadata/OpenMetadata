package org.openmetadata.it.knowledge;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.domains.DataProductService;
import org.openmetadata.sdk.services.domains.DomainService;
import org.openmetadata.sdk.services.teams.TeamService;
import org.openmetadata.sdk.services.teams.UserService;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.SdkClients;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;

@ExtendWith(TestNamespaceExtension.class)
public class KnowledgeCenterIT {

  private static final String KC_PATH = "v1/contextCenter/pages";

  private Page createPage(RestClient rest, CreatePage request) throws HttpResponseException {
    return rest.create(KC_PATH, request, Page.class);
  }

  private Page getPage(RestClient rest, UUID id, String fields) throws HttpResponseException {
    return rest.getById(KC_PATH, id, fields, Page.class);
  }

  private Page patchPage(RestClient rest, UUID id, String originalJson, Page updated)
      throws HttpResponseException {
    return rest.patch(KC_PATH, id, originalJson, updated, Page.class);
  }

  private CreatePage buildCreateRequest(String name, EntityReference relatedEntity) {
    return new CreatePage()
        .withName(name)
        .withPageType(PageType.ARTICLE)
        .withDescription("This is a test Description.")
        .withPage(new Article())
        .withRelatedEntities(List.of(relatedEntity));
  }

  private EntityReference getOrganizationRef() {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    TeamService teamService = new TeamService(adminClient.getHttpClient());
    Team org = teamService.getByName("Organization", null);
    return org.getEntityReference();
  }

  @Test
  void testRelatedEntitiesExcludesDomainsAndDataProducts(TestNamespace ns)
      throws HttpResponseException {
    RestClient rest = RestClient.admin();
    OpenMetadataClient adminClient = SdkClients.adminClient();
    DomainService domainSvc = new DomainService(adminClient.getHttpClient());

    EntityReference orgRef = getOrganizationRef();
    CreatePage createPageReq = buildCreateRequest(ns.prefix("pageExcludesDomains"), orgRef);
    Page page = createPage(rest, createPageReq);

    CreateDomain createDomain =
        new CreateDomain()
            .withName(ns.prefix("testDomain"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain");
    Domain domain = domainSvc.create(createDomain);

    String original = JsonUtils.pojoToJson(page);
    page.withDomains(List.of(domain.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    Page fetchedPage = getPage(rest, page.getId(), "relatedEntities,domains,dataProducts");

    assertEquals(1, fetchedPage.getDomains().size());
    assertEquals(domain.getName(), fetchedPage.getDomains().get(0).getName());

    boolean domainInRelatedEntities =
        fetchedPage.getRelatedEntities().stream().anyMatch(ref -> "domain".equals(ref.getType()));
    assertEquals(false, domainInRelatedEntities, "Domains should not appear in relatedEntities");

    boolean dataProductInRelatedEntities =
        fetchedPage.getRelatedEntities().stream()
            .anyMatch(ref -> "dataProduct".equals(ref.getType()));
    assertEquals(
        false, dataProductInRelatedEntities, "DataProducts should not appear in relatedEntities");
  }

  @Test
  void testDomainAddUpdateRemove(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    OpenMetadataClient adminClient = SdkClients.adminClient();
    DomainService domainSvc = new DomainService(adminClient.getHttpClient());

    EntityReference orgRef = getOrganizationRef();
    CreatePage createPageReq = buildCreateRequest(ns.prefix("pageDomainCrud"), orgRef);
    Page page = createPage(rest, createPageReq);

    CreateDomain createDomain1 =
        new CreateDomain()
            .withName(ns.prefix("testDomain1"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain 1");
    Domain domain1 = domainSvc.create(createDomain1);

    CreateDomain createDomain2 =
        new CreateDomain()
            .withName(ns.prefix("testDomain2"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain 2");
    Domain domain2 = domainSvc.create(createDomain2);

    String original = JsonUtils.pojoToJson(page);
    page.withDomains(List.of(domain1.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    Page fetchedPage = getPage(rest, page.getId(), "domains,relatedEntities");
    assertEquals(1, fetchedPage.getDomains().size());
    assertEquals(domain1.getName(), fetchedPage.getDomains().get(0).getName());

    original = JsonUtils.pojoToJson(page);
    page.withDomains(List.of(domain2.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    fetchedPage = getPage(rest, page.getId(), "domains,relatedEntities");
    assertEquals(1, fetchedPage.getDomains().size());
    assertEquals(domain2.getName(), fetchedPage.getDomains().get(0).getName());

    boolean domain1InDomains =
        fetchedPage.getDomains().stream().anyMatch(ref -> domain1.getName().equals(ref.getName()));
    assertEquals(false, domain1InDomains, "Old domain should be removed after update");

    original = JsonUtils.pojoToJson(page);
    page.withDomains(null);
    page = patchPage(rest, page.getId(), original, page);

    fetchedPage = getPage(rest, page.getId(), "domains,relatedEntities");
    int domainCount = fetchedPage.getDomains() == null ? 0 : fetchedPage.getDomains().size();
    assertEquals(0, domainCount, "Domain should be removed");

    boolean anyDomainInRelatedEntities =
        fetchedPage.getRelatedEntities().stream().anyMatch(ref -> "domain".equals(ref.getType()));
    assertEquals(
        false, anyDomainInRelatedEntities, "No domains should ever appear in relatedEntities");
  }

  @Test
  void testDataProductAddUpdateRemove(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    OpenMetadataClient adminClient = SdkClients.adminClient();
    DomainService domainSvc = new DomainService(adminClient.getHttpClient());
    DataProductService dpSvc = new DataProductService(adminClient.getHttpClient());

    EntityReference orgRef = getOrganizationRef();
    CreatePage createPageReq = buildCreateRequest(ns.prefix("pageDpCrud"), orgRef);
    Page page = createPage(rest, createPageReq);

    CreateDomain createDomain =
        new CreateDomain()
            .withName(ns.prefix("testDomainDP"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain for data products");
    Domain domain = domainSvc.create(createDomain);

    String original = JsonUtils.pojoToJson(page);
    page.withDomains(List.of(domain.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    page = getPage(rest, page.getId(), "domains,relatedEntities");

    CreateDataProduct createDataProduct1 =
        new CreateDataProduct()
            .withName(ns.prefix("testDP1"))
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withDescription("Test data product 1");
    DataProduct dataProduct1 = dpSvc.create(createDataProduct1);

    CreateDataProduct createDataProduct2 =
        new CreateDataProduct()
            .withName(ns.prefix("testDP2"))
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withDescription("Test data product 2");
    DataProduct dataProduct2 = dpSvc.create(createDataProduct2);

    original = JsonUtils.pojoToJson(page);
    page.withDataProducts(List.of(dataProduct1.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    Page fetchedPage = getPage(rest, page.getId(), "dataProducts,relatedEntities,domains");
    assertEquals(1, fetchedPage.getDataProducts().size());
    assertEquals(dataProduct1.getName(), fetchedPage.getDataProducts().get(0).getName());

    original = JsonUtils.pojoToJson(page);
    page.withDataProducts(List.of(dataProduct2.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    fetchedPage = getPage(rest, page.getId(), "dataProducts,relatedEntities,domains");
    assertEquals(1, fetchedPage.getDataProducts().size());
    assertEquals(dataProduct2.getName(), fetchedPage.getDataProducts().get(0).getName());

    boolean dataProduct1InDataProducts =
        fetchedPage.getDataProducts().stream()
            .anyMatch(ref -> dataProduct1.getName().equals(ref.getName()));
    assertEquals(
        false, dataProduct1InDataProducts, "Old dataProduct should be removed after update");

    original = JsonUtils.pojoToJson(page);
    page.withDataProducts(null);
    page = patchPage(rest, page.getId(), original, page);

    fetchedPage = getPage(rest, page.getId(), "dataProducts,relatedEntities,domains");
    int dataProductCount =
        fetchedPage.getDataProducts() == null ? 0 : fetchedPage.getDataProducts().size();
    assertEquals(0, dataProductCount, "DataProduct should be removed");

    boolean anyDataProductInRelatedEntities =
        fetchedPage.getRelatedEntities().stream()
            .anyMatch(ref -> "dataProduct".equals(ref.getType()));
    assertEquals(
        false,
        anyDataProductInRelatedEntities,
        "No dataProducts should ever appear in relatedEntities");
  }

  // --- SortBy ---

  private ResultList<Page> listPagesSorted(
      RestClient rest, String sortBy, String sortOrder, int limit) {
    String path = KC_PATH + "?sortBy=" + sortBy + "&sortOrder=" + sortOrder + "&limit=" + limit;
    try (Response response = rest.rawGet(path)) {
      assertEquals(200, response.getStatus(), "List call failed: " + response.getStatus());
      String body = response.readEntity(String.class);
      return JsonUtils.readValue(body, new TypeReference<ResultList<Page>>() {});
    }
  }

  private static void awaitClockPast(long timestamp) {
    await()
        .pollInterval(Duration.ofMillis(2))
        .atMost(Duration.ofSeconds(2))
        .until(() -> System.currentTimeMillis() > timestamp);
  }

  private void awaitPageIndexed(RestClient rest, UUID id) {
    await()
        .pollDelay(Duration.ZERO)
        .pollInterval(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(60))
        .untilAsserted(
            () -> {
              try (Response getResp =
                  rest.rawGet("v1/search/get/knowledge_page_search_index/doc/" + id)) {
                assertEquals(
                    200,
                    getResp.getStatus(),
                    "Page " + id + " not yet indexed: " + getResp.readEntity(String.class));
              }
            });
  }

  @Test
  void testListPagesSortByUpdatedAtDesc(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    EntityReference orgRef = getOrganizationRef();

    Page older = createPage(rest, buildCreateRequest(ns.prefix("sort-older"), orgRef));
    awaitClockPast(older.getUpdatedAt());
    Page middle = createPage(rest, buildCreateRequest(ns.prefix("sort-middle"), orgRef));
    awaitClockPast(middle.getUpdatedAt());
    Page newer = createPage(rest, buildCreateRequest(ns.prefix("sort-newer"), orgRef));

    awaitPageIndexed(rest, older.getId());
    awaitPageIndexed(rest, middle.getId());
    awaitPageIndexed(rest, newer.getId());

    List<UUID> ourIds = List.of(older.getId(), middle.getId(), newer.getId());
    await()
        .pollInterval(Duration.ofMillis(250))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<Page> result = listPagesSorted(rest, "updatedAt", "desc", 1000);
              List<UUID> ordered =
                  result.getData().stream().map(Page::getId).filter(ourIds::contains).toList();
              assertEquals(
                  List.of(newer.getId(), middle.getId(), older.getId()),
                  ordered,
                  "Expected newest-first ordering for our test pages");
            });
  }

  @Test
  void testListPagesSortByNameAsc(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    EntityReference orgRef = getOrganizationRef();

    Page zebra = createPage(rest, buildCreateRequest(ns.prefix("zzz-name"), orgRef));
    Page apple = createPage(rest, buildCreateRequest(ns.prefix("aaa-name"), orgRef));

    awaitPageIndexed(rest, zebra.getId());
    awaitPageIndexed(rest, apple.getId());

    List<UUID> ourIds = List.of(zebra.getId(), apple.getId());
    await()
        .pollInterval(Duration.ofMillis(250))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<Page> result = listPagesSorted(rest, "name", "asc", 1000);
              List<UUID> ordered =
                  result.getData().stream().map(Page::getId).filter(ourIds::contains).toList();
              assertEquals(
                  List.of(apple.getId(), zebra.getId()),
                  ordered,
                  "Expected ascending name ordering, apple before zebra");
            });
  }

  @Test
  void testListPagesSortByCreatedAtAliasesUpdatedAt(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    EntityReference orgRef = getOrganizationRef();

    Page first = createPage(rest, buildCreateRequest(ns.prefix("created-first"), orgRef));
    awaitClockPast(first.getUpdatedAt());
    Page second = createPage(rest, buildCreateRequest(ns.prefix("created-second"), orgRef));

    awaitPageIndexed(rest, first.getId());
    awaitPageIndexed(rest, second.getId());

    List<UUID> ourIds = List.of(first.getId(), second.getId());
    await()
        .pollInterval(Duration.ofMillis(250))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<Page> result = listPagesSorted(rest, "createdAt", "desc", 1000);
              List<UUID> ordered =
                  result.getData().stream().map(Page::getId).filter(ourIds::contains).toList();
              assertEquals(
                  List.of(second.getId(), first.getId()),
                  ordered,
                  "createdAt sort should return newest first (currently aliased to updatedAt)");
            });
  }

  @Test
  void testListPagesSortByRejectsCursorCombo() {
    RestClient rest = RestClient.admin();
    try (Response response =
        rest.rawGet(KC_PATH + "?sortBy=updatedAt&sortOrder=desc&after=anything")) {
      assertEquals(
          400,
          response.getStatus(),
          "sortBy combined with cursor should be 400, got " + response.getStatus());
    }
  }

  // Regression: the search index stores `followers` as a flat UUID-string list (see
  // SearchIndexUtils.parseFollowers), while the Page schema types it as
  // List<EntityReference>. Without excluding the field from `_source`, listing pages
  // through the sort-by-search path 400s on Jackson deserialization.
  @Test
  void testListPagesSortByDoesNotFailWhenPageHasFollowers(TestNamespace ns)
      throws HttpResponseException {
    RestClient rest = RestClient.admin();
    OpenMetadataClient adminClient = SdkClients.adminClient();
    UserService userSvc = new UserService(adminClient.getHttpClient());
    User admin = userSvc.getByName("admin", null);
    EntityReference orgRef = getOrganizationRef();

    Page page = createPage(rest, buildCreateRequest(ns.prefix("followed-sort"), orgRef));
    try (Response addResp =
        rest.rawPut(KC_PATH + "/" + page.getId() + "/followers", admin.getId())) {
      assertEquals(200, addResp.getStatus(), "Adding follower failed: " + addResp.getStatus());
    }

    awaitPageIndexed(rest, page.getId());

    await()
        .pollInterval(Duration.ofMillis(250))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<Page> result = listPagesSorted(rest, "updatedAt", "desc", 1000);
              boolean found =
                  result.getData().stream().anyMatch(p -> page.getId().equals(p.getId()));
              assertTrue(found, "Followed page should appear in sorted list");
            });
  }
}
