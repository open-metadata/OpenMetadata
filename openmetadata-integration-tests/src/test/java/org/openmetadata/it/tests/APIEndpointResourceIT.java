package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for APIEndpoint entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds API endpoint-specific tests for
 * request/response schemas and HTTP methods.
 *
 * <p>Migrated from: org.openmetadata.service.resources.apis.APIEndpointResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class APIEndpointResourceIT extends BaseEntityIT<APIEndpoint, CreateAPIEndpoint> {

  {
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateAPIEndpoint createMinimalRequest(TestNamespace ns) {
    APICollection collection = getOrCreateAPICollection(ns);

    return new CreateAPIEndpoint()
        .withName(ns.prefix("apiendpoint"))
        .withDescription("Test API endpoint created by integration test")
        .withApiCollection(collection.getFullyQualifiedName())
        .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
        .withRequestMethod(APIRequestMethod.GET);
  }

  @Override
  protected CreateAPIEndpoint createRequest(String name, TestNamespace ns) {
    APICollection collection = getOrCreateAPICollection(ns);

    // Use a safe URL - don't embed the name in the URL as it may contain invalid characters
    String safeId = java.util.UUID.randomUUID().toString().substring(0, 8);
    return new CreateAPIEndpoint()
        .withName(name)
        .withDescription("Test API endpoint")
        .withApiCollection(collection.getFullyQualifiedName())
        .withEndpointURL(URI.create("https://localhost:8585/api/v1/endpoint-" + safeId))
        .withRequestMethod(APIRequestMethod.GET);
  }

  private APICollection getOrCreateAPICollection(TestNamespace ns) {
    String shortId = ns.shortPrefix();
    String collectionName = "apicol_" + shortId;

    // Always create a new API service and collection for isolation
    ApiService service = APIServiceTestFactory.createRest(ns);

    CreateAPICollection collectionRequest =
        new CreateAPICollection()
            .withName(collectionName)
            .withDescription("Test API collection for endpoints")
            .withService(service.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1"));

    return SdkClients.adminClient().apiCollections().create(collectionRequest);
  }

  @Override
  protected APIEndpoint createEntity(CreateAPIEndpoint createRequest) {
    return SdkClients.adminClient().apiEndpoints().create(createRequest);
  }

  @Override
  protected APIEndpoint getEntity(String id) {
    return SdkClients.adminClient().apiEndpoints().get(id);
  }

  @Override
  protected APIEndpoint getEntityByName(String fqn) {
    return SdkClients.adminClient().apiEndpoints().getByName(fqn);
  }

  @Override
  protected APIEndpoint patchEntity(String id, APIEndpoint entity) {
    return SdkClients.adminClient().apiEndpoints().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().apiEndpoints().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().apiEndpoints().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().apiEndpoints().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "apiEndpoint";
  }

  @Override
  protected void validateCreatedEntity(APIEndpoint entity, CreateAPIEndpoint createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getApiCollection(), "APIEndpoint must have an API collection");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain API endpoint name");
  }

  @Override
  protected ListResponse<APIEndpoint> listEntities(ListParams params) {
    return SdkClients.adminClient().apiEndpoints().list(params);
  }

  @Override
  protected APIEndpoint getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().apiEndpoints().get(id, fields);
  }

  @Override
  protected APIEndpoint getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().apiEndpoints().getByName(fqn, fields);
  }

  @Override
  protected APIEndpoint getEntityIncludeDeleted(String id) {
    // APIEndpoint supports: owners,followers,tags,extension,domains,dataProducts,sourceHash
    return SdkClients.adminClient()
        .apiEndpoints()
        .get(id, "owners,followers,tags,domains", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().apiEndpoints().getVersionList(id);
  }

  @Override
  protected APIEndpoint getVersion(UUID id, Double version) {
    return SdkClients.adminClient().apiEndpoints().getVersion(id.toString(), version);
  }

  // ===================================================================
  // API ENDPOINT-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_apiEndpointWithRequestMethod_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_get"))
            .withDescription("GET endpoint")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
            .withRequestMethod(APIRequestMethod.GET);

    APIEndpoint endpoint = createEntity(request);
    assertNotNull(endpoint);
    assertEquals(APIRequestMethod.GET, endpoint.getRequestMethod());
  }

  @Test
  void post_apiEndpointWithResponseSchema_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    List<Field> responseFields =
        Arrays.asList(
            new Field().withName("id").withDataType(FieldDataType.STRING),
            new Field().withName("name").withDataType(FieldDataType.STRING),
            new Field().withName("email").withDataType(FieldDataType.STRING));

    APISchema responseSchema = new APISchema().withSchemaFields(responseFields);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_schema"))
            .withDescription("Endpoint with response schema")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
            .withRequestMethod(APIRequestMethod.GET)
            .withResponseSchema(responseSchema);

    APIEndpoint endpoint = createEntity(request);
    assertNotNull(endpoint);
    assertNotNull(endpoint.getResponseSchema());
    assertEquals(3, endpoint.getResponseSchema().getSchemaFields().size());
  }

  @Test
  void put_apiEndpointDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_update_desc"))
            .withDescription("Initial description")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/test"))
            .withRequestMethod(APIRequestMethod.POST);

    APIEndpoint endpoint = createEntity(request);
    assertEquals("Initial description", endpoint.getDescription());

    // Update description
    endpoint.setDescription("Updated description");
    APIEndpoint updated = patchEntity(endpoint.getId().toString(), endpoint);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void patch_apiEndpointRequestMethod_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    CreateAPIEndpoint request =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_patch_method"))
            .withDescription("Endpoint for method patching")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/resources"))
            .withRequestMethod(APIRequestMethod.GET);

    APIEndpoint endpoint = createEntity(request);
    assertEquals(APIRequestMethod.GET, endpoint.getRequestMethod());

    // Update request method
    endpoint.setRequestMethod(APIRequestMethod.POST);
    APIEndpoint updated = patchEntity(endpoint.getId().toString(), endpoint);
    assertEquals(APIRequestMethod.POST, updated.getRequestMethod());
  }

  @Test
  void test_apiEndpointNameUniquenessWithinCollection(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);

    String endpointName = ns.prefix("unique_endpoint");
    CreateAPIEndpoint request1 =
        new CreateAPIEndpoint()
            .withName(endpointName)
            .withDescription("First endpoint")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/first"))
            .withRequestMethod(APIRequestMethod.GET);

    APIEndpoint endpoint1 = createEntity(request1);
    assertNotNull(endpoint1);

    // Attempt to create duplicate within same collection
    CreateAPIEndpoint request2 =
        new CreateAPIEndpoint()
            .withName(endpointName)
            .withDescription("Duplicate endpoint")
            .withApiCollection(collection.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/second"))
            .withRequestMethod(APIRequestMethod.POST);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate API endpoint in same collection should fail");
  }

  // ===================================================================
  // MIGRATED TESTS FROM APIEndpointResourceTest
  // ===================================================================

  @Test
  void post_apiEndpointWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateAPIEndpoint requestWithoutCollection = new CreateAPIEndpoint();
    requestWithoutCollection.setName(ns.prefix("endpoint_no_collection"));
    requestWithoutCollection.setEndpointURL(URI.create("https://localhost:8585/api/v1/test"));
    requestWithoutCollection.setRequestMethod(APIRequestMethod.GET);

    InvalidRequestException exception1 =
        assertThrows(
            InvalidRequestException.class,
            () -> createEntity(requestWithoutCollection),
            "Creating API endpoint without collection should fail");
    assertEquals(400, exception1.getStatusCode());
  }

  @Test
  void post_apiEndpointWithDifferentService_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    ApiService service1 = APIServiceTestFactory.createRest(ns);
    ApiService service2 = APIServiceTestFactory.createRest(ns);

    CreateAPICollection collection1Request =
        new CreateAPICollection()
            .withName(ns.prefix("collection1"))
            .withDescription("First API collection")
            .withService(service1.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v1"));
    APICollection collection1 = client.apiCollections().create(collection1Request);

    CreateAPICollection collection2Request =
        new CreateAPICollection()
            .withName(ns.prefix("collection2"))
            .withDescription("Second API collection")
            .withService(service2.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://localhost:8585/api/v2"));
    APICollection collection2 = client.apiCollections().create(collection2Request);

    List<APIEndpoint> collection1Endpoints = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      CreateAPIEndpoint request =
          new CreateAPIEndpoint()
              .withName(ns.prefix("endpoint_col1_" + i))
              .withApiCollection(collection1.getFullyQualifiedName())
              .withEndpointURL(URI.create("https://localhost:8585/api/v1/resource" + i))
              .withRequestMethod(APIRequestMethod.GET);
      collection1Endpoints.add(createEntity(request));
    }

    List<APIEndpoint> collection2Endpoints = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateAPIEndpoint request =
          new CreateAPIEndpoint()
              .withName(ns.prefix("endpoint_col2_" + i))
              .withApiCollection(collection2.getFullyQualifiedName())
              .withEndpointURL(URI.create("https://localhost:8585/api/v2/resource" + i))
              .withRequestMethod(APIRequestMethod.POST);
      collection2Endpoints.add(createEntity(request));
    }

    ListParams params1 = new ListParams();
    params1.addFilter("apiCollection", collection1.getFullyQualifiedName());
    params1.setLimit(100);
    ListResponse<APIEndpoint> list1 = client.apiEndpoints().list(params1);
    assertTrue(
        list1.getData().size() >= collection1Endpoints.size(),
        "Should have at least " + collection1Endpoints.size() + " endpoints in collection1");

    for (APIEndpoint endpoint : list1.getData()) {
      if (endpoint.getApiCollection() != null) {
        assertTrue(
            endpoint.getApiCollection().getFullyQualifiedName().contains(collection1.getName()));
      }
    }

    ListParams params2 = new ListParams();
    params2.addFilter("apiCollection", collection2.getFullyQualifiedName());
    params2.setLimit(100);
    ListResponse<APIEndpoint> list2 = client.apiEndpoints().list(params2);
    assertTrue(
        list2.getData().size() >= collection2Endpoints.size(),
        "Should have at least " + collection2Endpoints.size() + " endpoints in collection2");

    for (APIEndpoint endpoint : list2.getData()) {
      if (endpoint.getApiCollection() != null) {
        assertTrue(
            endpoint.getApiCollection().getFullyQualifiedName().contains(collection2.getName()));
      }
    }
  }

  @Test
  void put_endPointAttributes_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);
    SharedEntities shared = SharedEntities.get();

    List<Field> responseFields =
        Arrays.asList(
            getField("id", FieldDataType.STRING, null),
            getField("name", FieldDataType.STRING, null),
            getField("email", FieldDataType.STRING, null));
    APISchema responseSchema = new APISchema().withSchemaFields(responseFields);

    CreateAPIEndpoint createRequest =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_attrs"))
            .withApiCollection(collection.getFullyQualifiedName())
            .withOwners(List.of(shared.USER1_REF))
            .withRequestMethod(APIRequestMethod.GET)
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
            .withResponseSchema(responseSchema);

    APIEndpoint endpoint = createEntity(createRequest);
    assertNotNull(endpoint);
    assertEquals(APIRequestMethod.GET, endpoint.getRequestMethod());
    assertNotNull(endpoint.getOwners());
    assertEquals(1, endpoint.getOwners().size());
    assertEquals(shared.USER1_REF.getId(), endpoint.getOwners().get(0).getId());

    endpoint.setRequestMethod(APIRequestMethod.POST);
    endpoint.setOwners(List.of(shared.TEAM11.getEntityReference()));
    APIEndpoint updated = client.apiEndpoints().update(endpoint.getId().toString(), endpoint);

    assertEquals(APIRequestMethod.POST, updated.getRequestMethod());
    assertNotNull(updated.getOwners());
    assertEquals(1, updated.getOwners().size());
    assertEquals(shared.TEAM11.getId(), updated.getOwners().get(0).getId());
  }

  @Test
  void put_patch_endPointTags_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);
    SharedEntities shared = SharedEntities.get();

    List<Field> responseFields =
        Arrays.asList(
            getField("id", FieldDataType.STRING, null),
            getField("first_name", FieldDataType.STRING, null),
            getField("last_name", FieldDataType.STRING, null),
            getField("email", FieldDataType.STRING, null));
    APISchema responseSchema = new APISchema().withSchemaFields(responseFields);

    CreateAPIEndpoint createRequest =
        new CreateAPIEndpoint()
            .withName(ns.prefix("endpoint_tags"))
            .withApiCollection(collection.getFullyQualifiedName())
            .withRequestMethod(APIRequestMethod.GET)
            .withEndpointURL(URI.create("https://localhost:8585/api/v1/users"))
            .withResponseSchema(responseSchema);

    APIEndpoint endpoint = createEntity(createRequest);
    assertNotNull(endpoint);

    APIEndpoint fetched = client.apiEndpoints().get(endpoint.getId().toString(), "tags");
    List<Field> fields = new ArrayList<>(fetched.getResponseSchema().getSchemaFields());
    fields.get(0).setTags(new ArrayList<>());
    fields.get(0).getTags().add(shared.PERSONAL_DATA_TAG_LABEL);
    fields.get(0).getTags().add(shared.PII_SENSITIVE_TAG_LABEL);
    fetched.getResponseSchema().setSchemaFields(fields);

    APIEndpoint updated = client.apiEndpoints().update(fetched.getId().toString(), fetched);
    APIEndpoint withTags = client.apiEndpoints().get(updated.getId().toString(), "tags");
    fields = withTags.getResponseSchema().getSchemaFields();
    List<TagLabel> tags = fields.get(0).getTags();
    assertNotNull(tags);
    assertEquals(2, tags.size());
    assertTrue(
        tags.stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.PERSONAL_DATA_TAG_LABEL.getTagFQN())));
    assertTrue(
        tags.stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.PII_SENSITIVE_TAG_LABEL.getTagFQN())));

    fetched = client.apiEndpoints().get(endpoint.getId().toString(), "tags");
    fields = new ArrayList<>(fetched.getResponseSchema().getSchemaFields());
    fields
        .get(0)
        .setTags(
            fields.get(0).getTags().stream()
                .filter(t -> !t.getTagFQN().equals(shared.PERSONAL_DATA_TAG_LABEL.getTagFQN()))
                .collect(Collectors.toList()));
    fetched.getResponseSchema().setSchemaFields(fields);

    updated = client.apiEndpoints().update(fetched.getId().toString(), fetched);
    withTags = client.apiEndpoints().get(updated.getId().toString(), "tags");
    fields = withTags.getResponseSchema().getSchemaFields();
    tags = fields.get(0).getTags();
    assertEquals(1, tags.size());
    assertEquals(shared.PII_SENSITIVE_TAG_LABEL.getTagFQN(), tags.get(0).getTagFQN());
  }

  @Test
  void test_paginationFetchesTagsAtBothEntityAndFieldLevels(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    APICollection collection = getOrCreateAPICollection(ns);
    SharedEntities shared = SharedEntities.get();

    TagLabel endpointTagLabel = shared.PERSONAL_DATA_TAG_LABEL;
    TagLabel fieldTagLabel = shared.PII_SENSITIVE_TAG_LABEL;

    List<APIEndpoint> createdEndpoints = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      List<Field> requestFields =
          Arrays.asList(
              getField("requestField1_" + i, FieldDataType.STRING, fieldTagLabel),
              getField("requestField2_" + i, FieldDataType.STRING, null));

      List<Field> responseFields =
          Arrays.asList(
              getField("responseField1_" + i, FieldDataType.STRING, fieldTagLabel),
              getField("responseField2_" + i, FieldDataType.STRING, null));

      APISchema requestSchema = new APISchema().withSchemaFields(requestFields);
      APISchema responseSchema = new APISchema().withSchemaFields(responseFields);

      CreateAPIEndpoint createRequest =
          new CreateAPIEndpoint()
              .withName(ns.prefix("endpoint_pagination_" + i))
              .withApiCollection(collection.getFullyQualifiedName())
              .withEndpointURL(URI.create("https://localhost:8585/api/v1/pagination_test_" + i))
              .withRequestMethod(APIRequestMethod.GET)
              .withRequestSchema(requestSchema)
              .withResponseSchema(responseSchema)
              .withTags(List.of(endpointTagLabel));

      APIEndpoint endpoint = createEntity(createRequest);
      createdEndpoints.add(endpoint);
    }

    ListParams paramsTagsOnly = new ListParams();
    paramsTagsOnly.setFields("tags");
    paramsTagsOnly.setLimit(50);
    ListResponse<APIEndpoint> listWithTagsOnly = client.apiEndpoints().list(paramsTagsOnly);
    assertNotNull(listWithTagsOnly.getData());

    List<APIEndpoint> ourEndpoints =
        listWithTagsOnly.getData().stream()
            .filter(e -> createdEndpoints.stream().anyMatch(ce -> ce.getId().equals(e.getId())))
            .collect(Collectors.toList());

    assertFalse(ourEndpoints.isEmpty(), "Should find at least one of our created endpoints");

    for (APIEndpoint endpoint : ourEndpoints) {
      assertNotNull(endpoint.getTags(), "Endpoint-level tags should not be null");
      assertTrue(
          endpoint.getTags().stream()
              .anyMatch(t -> t.getTagFQN().equals(endpointTagLabel.getTagFQN())));

      if (endpoint.getRequestSchema() != null
          && endpoint.getRequestSchema().getSchemaFields() != null) {
        for (Field field : endpoint.getRequestSchema().getSchemaFields()) {
          assertTrue(
              field.getTags() == null || field.getTags().isEmpty(),
              "Request field tags should not be populated when only fields=tags");
        }
      }
      if (endpoint.getResponseSchema() != null
          && endpoint.getResponseSchema().getSchemaFields() != null) {
        for (Field field : endpoint.getResponseSchema().getSchemaFields()) {
          assertTrue(
              field.getTags() == null || field.getTags().isEmpty(),
              "Response field tags should not be populated when only fields=tags");
        }
      }
    }

    ListParams paramsWithSchemas = new ListParams();
    paramsWithSchemas.setFields("requestSchema,responseSchema,tags");
    paramsWithSchemas.setLimit(50);
    ListResponse<APIEndpoint> listWithSchemas = client.apiEndpoints().list(paramsWithSchemas);
    assertNotNull(listWithSchemas.getData());

    ourEndpoints =
        listWithSchemas.getData().stream()
            .filter(e -> createdEndpoints.stream().anyMatch(ce -> ce.getId().equals(e.getId())))
            .collect(Collectors.toList());

    assertFalse(ourEndpoints.isEmpty(), "Should find at least one of our created endpoints");

    for (APIEndpoint endpoint : ourEndpoints) {
      assertNotNull(endpoint.getTags(), "Endpoint-level tags should not be null");
      assertTrue(
          endpoint.getTags().stream()
              .anyMatch(t -> t.getTagFQN().equals(endpointTagLabel.getTagFQN())));

      assertNotNull(endpoint.getRequestSchema(), "RequestSchema should not be null");
      assertNotNull(
          endpoint.getRequestSchema().getSchemaFields(),
          "Request schema fields should not be null");

      Field requestField1 =
          endpoint.getRequestSchema().getSchemaFields().stream()
              .filter(f -> f.getName().startsWith("requestField1_"))
              .findFirst()
              .orElseThrow(() -> new AssertionError("Should find requestField1 field"));

      assertNotNull(
          requestField1.getTags(),
          "Request field tags should not be null when fields=requestSchema,responseSchema,tags");
      assertTrue(requestField1.getTags().size() >= 1, "Request field should have at least one tag");
      assertTrue(
          requestField1.getTags().stream()
              .anyMatch(t -> t.getTagFQN().equals(fieldTagLabel.getTagFQN())));

      assertNotNull(endpoint.getResponseSchema(), "ResponseSchema should not be null");
      assertNotNull(
          endpoint.getResponseSchema().getSchemaFields(),
          "Response schema fields should not be null");

      Field responseField1 =
          endpoint.getResponseSchema().getSchemaFields().stream()
              .filter(f -> f.getName().startsWith("responseField1_"))
              .findFirst()
              .orElseThrow(() -> new AssertionError("Should find responseField1 field"));

      assertNotNull(
          responseField1.getTags(),
          "Response field tags should not be null when fields=requestSchema,responseSchema,tags");
      assertTrue(
          responseField1.getTags().size() >= 1, "Response field should have at least one tag");
      assertTrue(
          responseField1.getTags().stream()
              .anyMatch(t -> t.getTagFQN().equals(fieldTagLabel.getTagFQN())));
    }
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private static Field getField(String name, FieldDataType fieldDataType, TagLabel tag) {
    List<TagLabel> tags = tag == null ? new ArrayList<>() : List.of(tag);
    return new Field()
        .withName(name)
        .withDataType(fieldDataType)
        .withDescription(name)
        .withTags(tags);
  }

  private static void assertFields(List<Field> expectedFields, List<Field> actualFields) {
    if (expectedFields == actualFields) {
      return;
    }
    assertEquals(expectedFields.size(), actualFields.size());

    List<Field> expected = new ArrayList<>(expectedFields);
    List<Field> actual = new ArrayList<>(actualFields);
    expected.sort(Comparator.comparing(Field::getName));
    actual.sort(Comparator.comparing(Field::getName));
    for (int i = 0; i < expected.size(); i++) {
      assertField(expected.get(i), actual.get(i));
    }
  }

  private static void assertField(Field expectedField, Field actualField) {
    assertNotNull(actualField.getFullyQualifiedName());
    assertTrue(
        expectedField.getName().equals(actualField.getName())
            || expectedField.getName().equals(actualField.getDisplayName()));
    assertEquals(expectedField.getDescription(), actualField.getDescription());
    assertEquals(expectedField.getDataType(), actualField.getDataType());

    if (expectedField.getTags() != null && actualField.getTags() != null) {
      assertEquals(expectedField.getTags().size(), actualField.getTags().size());
    }

    if (expectedField.getChildren() != null && actualField.getChildren() != null) {
      assertFields(expectedField.getChildren(), actualField.getChildren());
    }
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateAPIEndpoint> createRequests) {
    return SdkClients.adminClient().apiEndpoints().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateAPIEndpoint> createRequests) {
    return SdkClients.adminClient().apiEndpoints().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateAPIEndpoint createInvalidRequestForBulk(TestNamespace ns) {
    CreateAPIEndpoint request = new CreateAPIEndpoint();
    request.setName(ns.prefix("invalid_api_endpoint"));
    return request;
  }
}
