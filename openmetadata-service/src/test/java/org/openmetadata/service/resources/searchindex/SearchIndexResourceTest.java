/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.searchindex;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.services.CreateSearchService;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.SearchServiceResourceTest;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class SearchIndexResourceTest extends EntityResourceTest<SearchIndex, CreateSearchIndex> {
  public static final List<SearchIndexField> SEARCH_INDEX_FIELDS =
      Arrays.asList(
          getField("id", SearchIndexDataType.KEYWORD, null),
          getField("name", SearchIndexDataType.KEYWORD, null),
          getField("address", SearchIndexDataType.TEXT, null));

  public SearchIndexResourceTest() {
    super(
        Entity.SEARCH_INDEX,
        SearchIndex.class,
        SearchIndexResource.SearchIndexList.class,
        "searchIndexes",
        SearchIndexResource.FIELDS);
    supportsSearchIndex = true;
  }

  @Test
  void post_searchIndexWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    assertResponse(
        () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[service must not be null]");

    // Partitions is required field
    assertResponse(
        () -> createEntity(createRequest(test).withFields(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[fields must not be null]");
  }

  @Test
  void post_searchIndexWithDifferentService_200_ok(TestInfo test) throws IOException {
    String[] differentServices = {
      ELASTICSEARCH_SEARCH_SERVICE_REFERENCE.getName(), OPENSEARCH_SEARCH_SERVICE_REFERENCE.getName()
    };

    // Create searchIndex for each service and test APIs
    for (String service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List searchIndexes by filtering on service name and ensure right searchIndexes in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service);

      ResultList<SearchIndex> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (SearchIndex searchIndex : list.getData()) {
        assertEquals(service, searchIndex.getService().getName());
      }
    }
  }

  @Test
  void put_searchIndexAttributes_200_ok(TestInfo test) throws IOException {
    ArrayList<SearchIndexField> fields =
        new ArrayList<>(
            Arrays.asList(
                new SearchIndexField().withName("name").withDataType(SearchIndexDataType.TEXT),
                new SearchIndexField().withName("displayName").withDataType(SearchIndexDataType.KEYWORD)));
    List<SearchIndexField> searchIndexFields =
        Arrays.asList(
            new SearchIndexField()
                .withName("tableSearchIndex")
                .withDataType(SearchIndexDataType.NESTED)
                .withChildren(fields));
    CreateSearchIndex createSearchIndex = createRequest(test).withOwner(USER1_REF).withFields(searchIndexFields);

    SearchIndex searchIndex = createEntity(createSearchIndex, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(searchIndex, MINOR_UPDATE);

    // Patch and update the searchIndex
    fields.add(new SearchIndexField().withName("updatedBy").withDataType(SearchIndexDataType.KEYWORD));
    List<SearchIndexField> updatedSearchIndexFields =
        List.of(
            new SearchIndexField()
                .withName("tableSearchIndex")
                .withChildren(fields)
                .withDataType(SearchIndexDataType.NESTED));
    createSearchIndex.withOwner(TEAM11_REF).withDescription("searchIndex").withFields(updatedSearchIndexFields);
    SearchIndexField addedField = fields.get(2);
    addedField.setFullyQualifiedName(
        searchIndex.getFields().get(0).getFullyQualifiedName() + "." + addedField.getName());
    fieldUpdated(change, FIELD_OWNER, USER1_REF, TEAM11_REF);
    fieldUpdated(change, "description", "", "searchIndex");
    fieldAdded(change, "fields.tableSearchIndex", JsonUtils.pojoToJson(List.of(addedField)));
    updateAndCheckEntity(createSearchIndex, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_searchIndexFields_200_ok(TestInfo test) throws IOException {
    List<SearchIndexField> fields =
        Arrays.asList(
            getField("id", SearchIndexDataType.KEYWORD, null),
            getField("first_name", SearchIndexDataType.KEYWORD, null),
            getField("last_name", SearchIndexDataType.TEXT, null),
            getField("email", SearchIndexDataType.KEYWORD, null),
            getField("address_line_1", SearchIndexDataType.ARRAY, null),
            getField("address_line_2", SearchIndexDataType.TEXT, null),
            getField("post_code", SearchIndexDataType.TEXT, null),
            getField("county", SearchIndexDataType.TEXT, PERSONAL_DATA_TAG_LABEL));

    CreateSearchIndex createSearchIndex = createRequest(test).withOwner(USER1_REF).withFields(fields);

    //  update the searchIndex
    SearchIndex searchIndex = createEntity(createSearchIndex, ADMIN_AUTH_HEADERS);
    searchIndex = getEntity(searchIndex.getId(), ADMIN_AUTH_HEADERS);
    assertFields(fields, searchIndex.getFields());
  }

  @Test
  void patch_searchIndexAttributes_200_ok(TestInfo test) throws IOException {
    List<SearchIndexField> fields =
        Arrays.asList(
            getField("id", SearchIndexDataType.KEYWORD, null),
            getField("first_name", SearchIndexDataType.KEYWORD, null),
            getField("last_name", SearchIndexDataType.TEXT, null),
            getField("email", SearchIndexDataType.KEYWORD, null),
            getField("address_line_1", SearchIndexDataType.ARRAY, null),
            getField("address_line_2", SearchIndexDataType.TEXT, null),
            getField("post_code", SearchIndexDataType.TEXT, null),
            getField("county", SearchIndexDataType.TEXT, PERSONAL_DATA_TAG_LABEL));
    CreateSearchIndex createSearchIndex = createRequest(test).withOwner(USER1_REF).withFields(fields);

    SearchIndex searchIndex = createEntity(createSearchIndex, ADMIN_AUTH_HEADERS);
    String origJson = JsonUtils.pojoToJson(searchIndex);

    List<SearchIndexField> updatedFields =
        Arrays.asList(
            getField("id", SearchIndexDataType.KEYWORD, null),
            getField("first_name", SearchIndexDataType.KEYWORD, null),
            getField("last_name", SearchIndexDataType.TEXT, null),
            getField("email", SearchIndexDataType.KEYWORD, null),
            getField("address_line_1", SearchIndexDataType.ARRAY, null),
            getField("address_line_2", SearchIndexDataType.TEXT, null),
            getField("post_code", SearchIndexDataType.TEXT, null),
            getField("county", SearchIndexDataType.TEXT, PERSONAL_DATA_TAG_LABEL),
            getField("phone", SearchIndexDataType.TEXT, PERSONAL_DATA_TAG_LABEL));

    searchIndex.withOwner(TEAM11_REF).withFields(updatedFields);

    SearchIndexField addedField = updatedFields.get(updatedFields.size() - 1);
    addedField.setFullyQualifiedName(searchIndex.getFullyQualifiedName() + "." + addedField.getName());

    ChangeDescription change = getChangeDescription(searchIndex, MINOR_UPDATE);
    fieldUpdated(change, FIELD_OWNER, USER1_REF, TEAM11_REF);
    fieldAdded(change, "fields", JsonUtils.pojoToJson(List.of(addedField)));
    patchEntityAndCheck(searchIndex, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void test_mutuallyExclusiveTags(TestInfo testInfo) {
    // Apply mutually exclusive tags to a table
    List<SearchIndexField> fields =
        Arrays.asList(
            getField("id", SearchIndexDataType.KEYWORD, null),
            getField("first_name", SearchIndexDataType.KEYWORD, null),
            getField("last_name", SearchIndexDataType.TEXT, null),
            getField("email", SearchIndexDataType.KEYWORD, null));

    CreateSearchIndex create =
        createRequest(testInfo)
            .withTags(List.of(TIER1_TAG_LABEL, TIER2_TAG_LABEL))
            .withOwner(USER1_REF)
            .withFields(fields);

    // Apply mutually exclusive tags to a searchIndex
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a searchIndex field
    CreateSearchIndex create1 = createRequest(testInfo, 1).withOwner(USER1_REF);
    SearchIndexField field =
        getField("first_name", SearchIndexDataType.TEXT, null).withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    create1.withFields(List.of(field));
    assertResponse(
        () -> createEntity(create1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a searchIndexes's nested field
    CreateSearchIndex create2 = createRequest(testInfo, 1).withOwner(USER1_REF);
    SearchIndexField nestedField =
        getField("testNested", SearchIndexDataType.TEXT, null).withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    SearchIndexField field1 = getField("test", SearchIndexDataType.NESTED, null).withChildren(List.of(nestedField));
    create2.withFields(List.of(field1));
    assertResponse(
        () -> createEntity(create2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));
  }

  @Test
  void put_searchIndexSampleData_200(TestInfo test) throws IOException {
    List<SearchIndexField> fields =
        Arrays.asList(
            getField("email", SearchIndexDataType.KEYWORD, null),
            getField("firstName", SearchIndexDataType.KEYWORD, null),
            getField("lastName", SearchIndexDataType.TEXT, null));
    SearchIndex searchIndex = createAndCheckEntity(createRequest(test).withFields(fields), ADMIN_AUTH_HEADERS);
    List<String> messages =
        Arrays.asList(
            "{\"email\": \"email1@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email2@email.com\", \"firstName\": \"Test\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email3@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}");
    SearchIndexSampleData searchIndexSampleData = new SearchIndexSampleData().withMessages(messages);
    SearchIndex searchIndex1 = putSampleData(searchIndex.getId(), searchIndexSampleData, ADMIN_AUTH_HEADERS);
    assertEquals(searchIndexSampleData, searchIndex1.getSampleData());

    SearchIndex searchIndex2 = getSampleData(searchIndex.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(searchIndex2.getSampleData(), searchIndex1.getSampleData());
    messages =
        Arrays.asList(
            "{\"email\": \"email1@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email2@email.com\", \"firstName\": \"Test\", \"lastName\": \"Jones\"}");
    searchIndexSampleData.withMessages(messages);
    SearchIndex putResponse = putSampleData(searchIndex2.getId(), searchIndexSampleData, ADMIN_AUTH_HEADERS);
    assertEquals(searchIndexSampleData, putResponse.getSampleData());
    searchIndex2 = getSampleData(searchIndex.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(searchIndexSampleData, searchIndex2.getSampleData());
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a searchIndex, carry it forward from the search service
    SearchServiceResourceTest serviceTest = new SearchServiceResourceTest();
    CreateSearchService createService = serviceTest.createRequest(test).withDomain(DOMAIN.getFullyQualifiedName());
    SearchService service = serviceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a searchIndex without domain and ensure it inherits domain from the parent
    CreateSearchIndex create = createRequest("user").withService(service.getFullyQualifiedName());
    assertDomainInheritance(create, DOMAIN.getEntityReference());
  }

  @Test
  void test_fieldWithInvalidTag(TestInfo test) throws HttpResponseException {
    // Add an entity with invalid tag
    TagLabel invalidTag = new TagLabel().withTagFQN("invalidTag");
    List<SearchIndexField> invalidFields =
        List.of(
            new SearchIndexField()
                .withName("field")
                .withDataType(SearchIndexDataType.TEXT)
                .withTags(listOf(invalidTag)));
    CreateSearchIndex create = createRequest(getEntityName(test)).withFields(invalidFields);

    // Entity can't be created with PUT or POST
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // Create an entity and update the columns with PUT and PATCH with an invalid tag
    List<SearchIndexField> validFields =
        List.of(new SearchIndexField().withName("field").withDataType(SearchIndexDataType.TEXT));
    create.setFields(validFields);
    SearchIndex entity = createEntity(create, ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);

    create.setFields(invalidFields);
    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    entity.setTags(listOf(invalidTag));
    assertResponse(
        () -> patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // No lingering relationships should cause error in listing the entity
    listEntities(null, ADMIN_AUTH_HEADERS);
  }

  @Override
  public SearchIndex validateGetWithDifferentFields(SearchIndex searchIndex, boolean byName)
      throws HttpResponseException {
    // .../searchIndex?fields=owner
    String fields = "";
    searchIndex =
        byName
            ? getSearchIndexByName(searchIndex.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getSearchIndex(searchIndex.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(searchIndex.getOwner(), searchIndex.getFollowers(), searchIndex.getFollowers());

    fields = "owner, followers, tags";
    searchIndex =
        byName
            ? getSearchIndexByName(searchIndex.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getSearchIndex(searchIndex.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(searchIndex.getService(), searchIndex.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return searchIndex;
  }

  public SearchIndex getSearchIndex(UUID id, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, SearchIndex.class, authHeaders);
  }

  public SearchIndex getSearchIndexByName(String fqn, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResourceByName(fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, SearchIndex.class, authHeaders);
  }

  @Override
  public CreateSearchIndex createRequest(String name) {
    return new CreateSearchIndex()
        .withName(name)
        .withService(getContainer().getFullyQualifiedName())
        .withFields(SEARCH_INDEX_FIELDS);
  }

  @Override
  public EntityReference getContainer() {
    return ELASTICSEARCH_SEARCH_SERVICE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(SearchIndex entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      SearchIndex searchIndex, CreateSearchIndex createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(createRequest.getService(), searchIndex.getService());
    // TODO add other fields
    TestUtils.validateTags(createRequest.getTags(), searchIndex.getTags());
  }

  @Override
  public void compareEntities(SearchIndex expected, SearchIndex updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(expected.getService(), expected.getService());
    // TODO add other fields
    TestUtils.validateTags(expected.getTags(), updated.getTags());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  public SearchIndex putSampleData(UUID searchIndexId, SearchIndexSampleData data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(searchIndexId).path("/sampleData");
    return TestUtils.put(target, data, SearchIndex.class, OK, authHeaders);
  }

  public SearchIndex getSampleData(UUID searchIndexId, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(searchIndexId).path("/sampleData");
    return TestUtils.get(target, SearchIndex.class, authHeaders);
  }

  private static SearchIndexField getField(String name, SearchIndexDataType fieldDataType, TagLabel tag) {
    List<TagLabel> tags = tag == null ? new ArrayList<>() : singletonList(tag);
    return new SearchIndexField().withName(name).withDataType(fieldDataType).withDescription(name).withTags(tags);
  }

  private static void assertFields(List<SearchIndexField> expectedFields, List<SearchIndexField> actualFields)
      throws HttpResponseException {
    if (expectedFields == actualFields) {
      return;
    }
    // Sort columns by name
    assertEquals(expectedFields.size(), actualFields.size());

    // Make a copy before sorting in case the lists are immutable
    List<SearchIndexField> expected = new ArrayList<>(expectedFields);
    List<SearchIndexField> actual = new ArrayList<>(actualFields);
    expected.sort(Comparator.comparing(SearchIndexField::getName));
    actual.sort(Comparator.comparing(SearchIndexField::getName));
    for (int i = 0; i < expected.size(); i++) {
      assertField(expected.get(i), actual.get(i));
    }
  }

  private static void assertField(SearchIndexField expectedField, SearchIndexField actualField)
      throws HttpResponseException {
    assertNotNull(actualField.getFullyQualifiedName());
    assertTrue(
        expectedField.getName().equals(actualField.getName())
            || expectedField.getName().equals(actualField.getDisplayName()));
    assertEquals(expectedField.getDescription(), actualField.getDescription());
    assertEquals(expectedField.getDataType(), actualField.getDataType());
    TestUtils.validateTags(expectedField.getTags(), actualField.getTags());

    // Check the nested columns
    assertFields(expectedField.getChildren(), actualField.getChildren());
  }
}
