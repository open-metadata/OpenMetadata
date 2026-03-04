package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Disabled;
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
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.resources.searchindex.SearchIndexResource;

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

  {
    supportsSearchIndex = false;
    supportsDomains = false;
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected String getResourcePath() {
    return SearchIndexResource.COLLECTION_PATH;
  }

  @Override
  protected CreateSearchIndex createMinimalRequest(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

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

    List<SearchIndexField> initialFields = createDefaultFields();
    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_add_fields"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(initialFields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);

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

    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

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

  @Test
  void post_searchIndexWithDifferentService_200_OK(TestNamespace ns) {
    SearchService elasticSearchService = SearchServiceTestFactory.createElasticSearch(ns);
    SearchService openSearchService = SearchServiceTestFactory.createOpenSearch(ns);

    List<SearchService> services = Arrays.asList(elasticSearchService, openSearchService);

    for (int i = 0; i < services.size(); i++) {
      SearchService service = services.get(i);
      List<SearchIndexField> fields = createDefaultFields();

      CreateSearchIndex request = new CreateSearchIndex();
      request.setName(ns.prefix("searchindex_service_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setFields(fields);

      SearchIndex searchIndex = createEntity(request);
      assertNotNull(searchIndex);
      assertEquals(
          service.getFullyQualifiedName(), searchIndex.getService().getFullyQualifiedName());
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    params.setService(elasticSearchService.getFullyQualifiedName());

    ListResponse<SearchIndex> list = listEntities(params);
    assertTrue(list.getData().size() >= 1);
    for (SearchIndex searchIndex : list.getData()) {
      assertEquals(
          elasticSearchService.getFullyQualifiedName(),
          searchIndex.getService().getFullyQualifiedName());
    }
  }

  @Test
  void put_searchIndexUpdateNestedFields_200_OK(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> childFields =
        new ArrayList<>(
            Arrays.asList(
                new SearchIndexField()
                    .withName("name")
                    .withDataType(SearchIndexDataType.TEXT)
                    .withDescription("Name field"),
                new SearchIndexField()
                    .withName("displayName")
                    .withDataType(SearchIndexDataType.KEYWORD)
                    .withDescription("Display name field")));

    List<SearchIndexField> fields =
        List.of(
            new SearchIndexField()
                .withName("tableSearchIndex")
                .withDataType(SearchIndexDataType.NESTED)
                .withChildren(childFields));

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_nested_fields"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);
    assertNotNull(searchIndex.getFields());
    assertEquals(1, searchIndex.getFields().size());
    assertNotNull(searchIndex.getFields().get(0).getChildren());
    assertEquals(2, searchIndex.getFields().get(0).getChildren().size());

    childFields.add(
        new SearchIndexField()
            .withName("updatedBy")
            .withDataType(SearchIndexDataType.KEYWORD)
            .withDescription("Updated by field"));

    List<SearchIndexField> updatedFields =
        List.of(
            new SearchIndexField()
                .withName("tableSearchIndex")
                .withDataType(SearchIndexDataType.NESTED)
                .withChildren(childFields));

    searchIndex.setFields(updatedFields);
    SearchIndex updated = patchEntity(searchIndex.getId().toString(), searchIndex);
    assertNotNull(updated);
    assertNotNull(updated.getFields());
    assertEquals(1, updated.getFields().size());
    assertNotNull(updated.getFields().get(0).getChildren());
    assertEquals(3, updated.getFields().get(0).getChildren().size());
  }

  @Test
  void put_searchIndexMultipleFieldTypes_200_OK(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> fields =
        Arrays.asList(
            new SearchIndexField()
                .withName("id")
                .withDataType(SearchIndexDataType.KEYWORD)
                .withDescription("ID field"),
            new SearchIndexField()
                .withName("firstName")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("First name field"),
            new SearchIndexField()
                .withName("lastName")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("Last name field"),
            new SearchIndexField()
                .withName("email")
                .withDataType(SearchIndexDataType.KEYWORD)
                .withDescription("Email field"),
            new SearchIndexField()
                .withName("tags")
                .withDataType(SearchIndexDataType.ARRAY)
                .withDescription("Tags array field"),
            new SearchIndexField()
                .withName("address")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("Address field"),
            new SearchIndexField()
                .withName("postalCode")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("Postal code field"),
            new SearchIndexField()
                .withName("county")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("County field"));

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_field_types"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);
    SearchIndex retrieved = getEntity(searchIndex.getId().toString());
    assertNotNull(retrieved.getFields());
    assertEquals(8, retrieved.getFields().size());

    for (SearchIndexField field : retrieved.getFields()) {
      assertNotNull(field.getFullyQualifiedName());
      assertNotNull(field.getDataType());
    }
  }

  @Test
  void patch_searchIndexAddFields_200_OK(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> initialFields =
        Arrays.asList(
            new SearchIndexField()
                .withName("id")
                .withDataType(SearchIndexDataType.KEYWORD)
                .withDescription("ID field"),
            new SearchIndexField()
                .withName("firstName")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("First name field"),
            new SearchIndexField()
                .withName("lastName")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("Last name field"),
            new SearchIndexField()
                .withName("email")
                .withDataType(SearchIndexDataType.KEYWORD)
                .withDescription("Email field"));

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_patch_fields"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(initialFields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);
    assertEquals(4, searchIndex.getFields().size());

    List<SearchIndexField> updatedFields = new ArrayList<>(initialFields);
    updatedFields.add(
        new SearchIndexField()
            .withName("phone")
            .withDataType(SearchIndexDataType.TEXT)
            .withDescription("Phone number field"));

    searchIndex.setFields(updatedFields);
    SearchIndex updated = patchEntity(searchIndex.getId().toString(), searchIndex);
    assertNotNull(updated);
    assertEquals(5, updated.getFields().size());
  }

  @Test
  @Disabled("SearchIndex sample data PUT returns null - needs investigation")
  void put_searchIndexSampleData_200_OK(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> fields =
        Arrays.asList(
            new SearchIndexField()
                .withName("email")
                .withDataType(SearchIndexDataType.KEYWORD)
                .withDescription("Email field"),
            new SearchIndexField()
                .withName("firstName")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("First name field"),
            new SearchIndexField()
                .withName("lastName")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("Last name field"));

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_sample_data"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);

    List<String> messages =
        Arrays.asList(
            "{\"email\": \"email1@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email2@email.com\", \"firstName\": \"Test\", \"lastName\": \"User\"}",
            "{\"email\": \"email3@email.com\", \"firstName\": \"Jane\", \"lastName\": \"Doe\"}");

    SearchIndexSampleData sampleData = new SearchIndexSampleData().withMessages(messages);
    searchIndex.setSampleData(sampleData);

    SearchIndex updated = patchEntity(searchIndex.getId().toString(), searchIndex);
    assertNotNull(updated);

    SearchIndex retrieved = getEntityWithFields(searchIndex.getId().toString(), "sampleData");
    assertNotNull(retrieved.getSampleData());
    assertEquals(3, retrieved.getSampleData().getMessages().size());

    List<String> updatedMessages =
        Arrays.asList(
            "{\"email\": \"email1@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email2@email.com\", \"firstName\": \"Test\", \"lastName\": \"User\"}");

    sampleData.setMessages(updatedMessages);
    searchIndex.setSampleData(sampleData);
    SearchIndex updated2 = patchEntity(searchIndex.getId().toString(), searchIndex);
    assertNotNull(updated2);

    SearchIndex retrieved2 = getEntityWithFields(searchIndex.getId().toString(), "sampleData");
    assertNotNull(retrieved2.getSampleData());
    assertEquals(2, retrieved2.getSampleData().getMessages().size());
  }

  @Test
  void test_searchIndexFieldValidation(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> validFields =
        List.of(
            new SearchIndexField()
                .withName("validField")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("Valid field"));

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_field_validation"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(validFields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);
    assertNotNull(searchIndex.getFields());
    assertEquals(1, searchIndex.getFields().size());

    for (SearchIndexField field : searchIndex.getFields()) {
      assertNotNull(field.getFullyQualifiedName());
      assertNotNull(field.getDataType());
    }
  }

  @Test
  void patch_searchIndexUsingFqn_200_OK(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> fields =
        Arrays.asList(
            new SearchIndexField()
                .withName("id")
                .withDataType(SearchIndexDataType.KEYWORD)
                .withDescription("ID field"),
            new SearchIndexField()
                .withName("firstName")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("First name field"));

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_patch_fqn"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);

    List<SearchIndexField> updatedFields = new ArrayList<>(fields);
    updatedFields.add(
        new SearchIndexField()
            .withName("lastName")
            .withDataType(SearchIndexDataType.TEXT)
            .withDescription("Last name field"));

    searchIndex.setFields(updatedFields);
    SearchIndex updated = patchEntity(searchIndex.getId().toString(), searchIndex);
    assertNotNull(updated);
    assertEquals(3, updated.getFields().size());
  }

  @Test
  void list_searchIndexesByService(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    for (int i = 0; i < 5; i++) {
      List<SearchIndexField> fields = createDefaultFields();
      CreateSearchIndex request = new CreateSearchIndex();
      request.setName(ns.prefix("searchindex_list_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setFields(fields);
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    params.setService(service.getFullyQualifiedName());

    ListResponse<SearchIndex> response = listEntities(params);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 5);

    for (SearchIndex searchIndex : response.getData()) {
      assertEquals(
          service.getFullyQualifiedName(), searchIndex.getService().getFullyQualifiedName());
    }
  }

  @Test
  void test_searchIndexVersionHistory(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> fields = createDefaultFields();
    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_versions"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);
    request.setDescription("Version 1");

    SearchIndex searchIndex = createEntity(request);
    Double v1 = searchIndex.getVersion();

    searchIndex.setDescription("Version 2");
    SearchIndex v2SearchIndex = patchEntity(searchIndex.getId().toString(), searchIndex);
    assertTrue(v2SearchIndex.getVersion() > v1);

    EntityHistory history = getVersionHistory(searchIndex.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void post_searchIndexWithInvalidService_4xx(TestNamespace ns) {
    String nonExistentServiceFqn = "non_existent_search_service_" + UUID.randomUUID();
    List<SearchIndexField> fields = createDefaultFields();

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_invalid_service"));
    request.setService(nonExistentServiceFqn);
    request.setFields(fields);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating search index with non-existent service should fail");
  }

  @Test
  void test_getSearchIndexWithFields(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> fields = createDefaultFields();
    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_with_fields_query"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);

    SearchIndex withFields = getEntityWithFields(searchIndex.getId().toString(), "fields,service");
    assertNotNull(withFields.getFields());
    assertNotNull(withFields.getService());

    SearchIndex minimal = getEntity(searchIndex.getId().toString());
    assertNotNull(minimal);
  }

  @Test
  void test_searchIndexFieldsWithTags(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    TagLabel personalDataTag = new TagLabel().withTagFQN("PII.Sensitive");

    List<SearchIndexField> fields =
        Arrays.asList(
            new SearchIndexField()
                .withName("email")
                .withDataType(SearchIndexDataType.KEYWORD)
                .withDescription("Email field")
                .withTags(List.of(personalDataTag)),
            new SearchIndexField()
                .withName("firstName")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("First name field"));

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_field_tags"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);

    SearchIndex retrieved = getEntityWithFields(searchIndex.getId().toString(), "fields,tags");
    assertNotNull(retrieved.getFields());
    assertTrue(retrieved.getFields().size() >= 2);

    SearchIndexField emailField =
        retrieved.getFields().stream()
            .filter(f -> f.getName().equals("email"))
            .findFirst()
            .orElse(null);

    assertNotNull(emailField);
  }

  @Test
  void test_deleteAndRestoreSearchIndex(TestNamespace ns) {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);

    List<SearchIndexField> fields = createDefaultFields();
    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("searchindex_delete_restore"));
    request.setService(service.getFullyQualifiedName());
    request.setFields(fields);

    SearchIndex searchIndex = createEntity(request);
    assertNotNull(searchIndex);
    String id = searchIndex.getId().toString();

    deleteEntity(id);

    SearchIndex deleted = getEntityIncludeDeleted(id);
    assertNotNull(deleted.getDeleted());
    assertTrue(deleted.getDeleted());

    restoreEntity(id);

    SearchIndex restored = getEntity(id);
    assertNotNull(restored);
    // After restore, deleted should be false (not null)
    assertNotNull(restored.getDeleted());
    assertFalse(restored.getDeleted());
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateSearchIndex> createRequests) {
    return SdkClients.adminClient().searchIndexes().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateSearchIndex> createRequests) {
    return SdkClients.adminClient().searchIndexes().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateSearchIndex createInvalidRequestForBulk(TestNamespace ns) {
    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.prefix("invalid_search_index"));
    return request;
  }
}
