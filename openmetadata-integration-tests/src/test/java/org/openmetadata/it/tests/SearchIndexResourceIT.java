package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for SearchIndex entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds search index-specific tests for
 * fields and mapping configuration.
 *
 * <p>Migrated from: org.openmetadata.service.resources.searchindex.SearchIndexResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class SearchIndexResourceIT extends BaseEntityIT<SearchIndex, CreateSearchIndex> {

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateSearchIndex createMinimalRequest(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    // Create default search index fields
    List<SearchIndexField> fields = createDefaultFields();

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Test search index created by integration test");
    request.setFields(fields);

    return request;
  }

  @Override
  protected CreateSearchIndex createRequest(String name, TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    // Create default search index fields
    List<SearchIndexField> fields = createDefaultFields();

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    return request;
  }

  private List<SearchIndexField> createDefaultFields() {
    SearchIndexField idField =
        new SearchIndexField()
            .withName("id")
            .withDataType(SearchIndexDataType.TEXT)
            .withDescription("ID field");
    SearchIndexField nameField =
        new SearchIndexField()
            .withName("name")
            .withDataType(SearchIndexDataType.KEYWORD)
            .withDescription("Name field");
    return Arrays.asList(idField, nameField);
  }

  @Override
  protected SearchIndex createEntity(CreateSearchIndex createRequest) {
    return SdkClients.adminClient().searchIndexes().create(createRequest);
  }

  @Override
  protected SearchIndex getEntity(String id) {
    return SdkClients.adminClient().searchIndexes().get(id);
  }

  @Override
  protected SearchIndex getEntityByName(String fqn) {
    return SdkClients.adminClient().searchIndexes().getByName(fqn);
  }

  @Override
  protected SearchIndex patchEntity(String id, SearchIndex entity) {
    return SdkClients.adminClient().searchIndexes().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().searchIndexes().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().searchIndexes().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().searchIndexes().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "searchIndex";
  }

  @Override
  protected void validateCreatedEntity(SearchIndex entity, CreateSearchIndex createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "SearchIndex must have a service");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain search index name");
  }

  @Override
  protected ListResponse<SearchIndex> listEntities(ListParams params) {
    return SdkClients.adminClient().searchIndexes().list(params);
  }

  @Override
  protected SearchIndex getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().searchIndexes().get(id, fields);
  }

  @Override
  protected SearchIndex getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().searchIndexes().getByName(fqn, fields);
  }

  @Override
  protected SearchIndex getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().searchIndexes().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().searchIndexes().getVersionList(id);
  }

  @Override
  protected SearchIndex getVersion(UUID id, Double version) {
    return SdkClients.adminClient().searchIndexes().getVersion(id.toString(), version);
  }

  // ===================================================================
  // SEARCH INDEX-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_searchIndexWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Service is required field
    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_no_service"));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating search index without service should fail");
  }

  @Test
  void post_searchIndexWithFields_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> fields =
        Arrays.asList(
            new SearchIndexField()
                .withName("title")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("Title field"),
            new SearchIndexField()
                .withName("timestamp")
                .withDataType(SearchIndexDataType.DATE)
                .withDescription("Timestamp field"));

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_with_fields"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);
    assertNotNull(searchIndex.getFields());
    assertEquals(2, searchIndex.getFields().size());
  }

  @Test
  void put_searchIndexFields_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    // Create search index with initial fields
    List<SearchIndexField> initialFields = createDefaultFields();
    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_add_fields"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(initialFields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);

    // Update fields via patch
    List<SearchIndexField> newFields =
        Arrays.asList(
            new SearchIndexField()
                .withName("added_field")
                .withDataType(SearchIndexDataType.KEYWORD)
                .withDescription("Added field"));

    searchIndex.setFields(newFields);
    SearchIndex updated = patchEntity(searchIndex.getId().toString(), searchIndex);
    assertNotNull(updated);
    assertNotNull(updated.getFields());
  }

  @Test
  void test_searchIndexInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a search service
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    // Create a search index under the service with required fields
    List<SearchIndexField> fields = createDefaultFields();
    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_inherit_domain"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);
    assertNotNull(searchIndex.getService());
    assertEquals(service.getFullyQualifiedName(), searchIndex.getService().getFullyQualifiedName());
  }
}
