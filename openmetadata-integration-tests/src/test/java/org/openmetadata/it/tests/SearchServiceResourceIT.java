package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateSearchService;
import org.openmetadata.schema.api.services.CreateSearchService.SearchServiceType;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.services.connections.database.ConnectionOptions;
import org.openmetadata.schema.services.connections.search.CustomSearchConnection;
import org.openmetadata.schema.services.connections.search.ElasticSearchConnection;
import org.openmetadata.schema.services.connections.search.OpenSearchConnection;
import org.openmetadata.schema.services.connections.search.elasticSearch.ESBasicAuth;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.SearchConnection;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
public class SearchServiceResourceIT extends BaseServiceIT<SearchService, CreateSearchService> {

  {
    supportsListAllVersionsByTimestamp = true;
  }

  @Override
  protected CreateSearchService createMinimalRequest(TestNamespace ns) {
    ElasticSearchConnection conn =
        new ElasticSearchConnection().withHostPort(URI.create("http://localhost:9200"));

    return new CreateSearchService()
        .withName(ns.prefix("searchservice"))
        .withServiceType(SearchServiceType.ElasticSearch)
        .withConnection(new SearchConnection().withConfig(conn))
        .withDescription("Test search service");
  }

  @Override
  protected CreateSearchService createRequest(String name, TestNamespace ns) {
    ElasticSearchConnection conn =
        new ElasticSearchConnection().withHostPort(URI.create("http://localhost:9200"));

    return new CreateSearchService()
        .withName(name)
        .withServiceType(SearchServiceType.ElasticSearch)
        .withConnection(new SearchConnection().withConfig(conn));
  }

  @Override
  protected SearchService createEntity(CreateSearchService createRequest) {
    return SdkClients.adminClient().searchServices().create(createRequest);
  }

  @Override
  protected SearchService getEntity(String id) {
    return SdkClients.adminClient().searchServices().get(id);
  }

  @Override
  protected SearchService getEntityByName(String fqn) {
    return SdkClients.adminClient().searchServices().getByName(fqn);
  }

  @Override
  protected SearchService patchEntity(String id, SearchService entity) {
    return SdkClients.adminClient().searchServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().searchServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().searchServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().searchServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "searchService";
  }

  @Override
  protected void validateCreatedEntity(SearchService entity, CreateSearchService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<SearchService> listEntities(ListParams params) {
    return SdkClients.adminClient().searchServices().list(params);
  }

  @Override
  protected SearchService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().searchServices().get(id, fields);
  }

  @Override
  protected SearchService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().searchServices().getByName(fqn, fields);
  }

  @Override
  protected SearchService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().searchServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().searchServices().getVersionList(id);
  }

  @Override
  protected SearchService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().searchServices().getVersion(id.toString(), version);
  }

  @Test
  void post_searchServiceWithElasticSearchConnection_200_OK(TestNamespace ns) {
    ESBasicAuth auth =
        new ESBasicAuth().withUsername("elastic_user").withPassword("elastic_password");

    ElasticSearchConnection conn =
        new ElasticSearchConnection()
            .withHostPort(URI.create("http://localhost:9200"))
            .withAuthType(auth);

    CreateSearchService request =
        new CreateSearchService()
            .withName(ns.prefix("elasticsearch_service"))
            .withServiceType(SearchServiceType.ElasticSearch)
            .withConnection(new SearchConnection().withConfig(conn))
            .withDescription("Test ElasticSearch service");

    SearchService service = createEntity(request);
    assertNotNull(service);
    assertEquals(SearchServiceType.ElasticSearch, service.getServiceType());
  }

  @Test
  void post_searchServiceWithOpenSearchConnection_200_OK(TestNamespace ns) {
    OpenSearchConnection conn =
        new OpenSearchConnection().withHostPort(URI.create("http://localhost:9200"));

    CreateSearchService request =
        new CreateSearchService()
            .withName(ns.prefix("opensearch_service"))
            .withServiceType(SearchServiceType.OpenSearch)
            .withConnection(new SearchConnection().withConfig(conn))
            .withDescription("Test OpenSearch service");

    SearchService service = createEntity(request);
    assertNotNull(service);
    assertEquals(SearchServiceType.OpenSearch, service.getServiceType());
  }

  @Test
  void post_searchServiceWithCustomSearchConnection_200_OK(TestNamespace ns) {
    CustomSearchConnection conn =
        new CustomSearchConnection()
            .withSourcePythonClass("custom_search.CustomSearchSource")
            .withConnectionOptions(new ConnectionOptions());

    CreateSearchService request =
        new CreateSearchService()
            .withName(ns.prefix("custom_search_service"))
            .withServiceType(SearchServiceType.CustomSearch)
            .withConnection(new SearchConnection().withConfig(conn))
            .withDescription("Test Custom Search service");

    SearchService service = createEntity(request);
    assertNotNull(service);
    assertEquals(SearchServiceType.CustomSearch, service.getServiceType());
  }

  @Test
  void put_searchServiceDescription_200_OK(TestNamespace ns) {
    CreateSearchService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    SearchService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    SearchService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_searchServiceVersionHistory(TestNamespace ns) {
    CreateSearchService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    SearchService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    SearchService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_searchServiceSoftDeleteRestore(TestNamespace ns) {
    CreateSearchService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    SearchService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    SearchService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    SearchService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_searchServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateSearchService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    SearchService service1 = createEntity(request1);
    assertNotNull(service1);

    CreateSearchService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate search service should fail");
  }

  @Test
  void test_listSearchServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateSearchService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<SearchService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }
}
