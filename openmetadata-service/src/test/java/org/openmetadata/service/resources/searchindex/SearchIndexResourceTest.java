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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static java.util.Collections.singletonList;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import es.org.elasticsearch.script.Script;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.BaseAggregationBuilder;
import es.org.elasticsearch.search.aggregations.PipelineAggregatorBuilders;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import es.org.elasticsearch.search.aggregations.bucket.terms.IncludeExclude;
import es.org.elasticsearch.search.sort.SortOrder;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.services.CreateSearchService;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.type.DataQualityReportMetadata;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.SearchServiceResourceTest;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchAggregationNode;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.aggregations.ElasticAggregations;
import org.openmetadata.service.search.elasticsearch.aggregations.ElasticAggregationsBuilder;
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
        "[query param service must not be null]");

    // Partitions is required field
    assertResponse(
        () -> createEntity(createRequest(test).withFields(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param fields must not be null]");
  }

  @Test
  void post_searchIndexWithDifferentService_200_ok(TestInfo test) throws IOException {
    String[] differentServices = {
      ELASTICSEARCH_SEARCH_SERVICE_REFERENCE.getName(),
      OPENSEARCH_SEARCH_SERVICE_REFERENCE.getName()
    };

    // Create searchIndex for each service and test APIs
    for (String service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List searchIndexes by filtering on service name and ensure right searchIndexes in the
      // response
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
                new SearchIndexField()
                    .withName("displayName")
                    .withDataType(SearchIndexDataType.KEYWORD)));
    List<SearchIndexField> searchIndexFields =
        List.of(
            new SearchIndexField()
                .withName("tableSearchIndex")
                .withDataType(SearchIndexDataType.NESTED)
                .withChildren(fields));
    CreateSearchIndex createSearchIndex =
        createRequest(test).withOwners(List.of(USER1_REF)).withFields(searchIndexFields);

    SearchIndex searchIndex = createEntity(createSearchIndex, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(searchIndex, MINOR_UPDATE);

    // Patch and update the searchIndex
    fields.add(
        new SearchIndexField().withName("updatedBy").withDataType(SearchIndexDataType.KEYWORD));
    List<SearchIndexField> updatedSearchIndexFields =
        List.of(
            new SearchIndexField()
                .withName("tableSearchIndex")
                .withChildren(fields)
                .withDataType(SearchIndexDataType.NESTED));
    createSearchIndex
        .withOwners(List.of(TEAM11_REF))
        .withDescription("searchIndex")
        .withFields(updatedSearchIndexFields);
    SearchIndexField addedField = fields.get(2);
    addedField.setFullyQualifiedName(
        searchIndex.getFields().get(0).getFullyQualifiedName() + "." + addedField.getName());
    fieldDeleted(change, FIELD_OWNERS, List.of(USER1_REF));
    fieldAdded(change, FIELD_OWNERS, List.of(TEAM11_REF));
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

    CreateSearchIndex createSearchIndex =
        createRequest(test).withOwners(List.of(USER1_REF)).withFields(fields);

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
    CreateSearchIndex createSearchIndex =
        createRequest(test).withOwners(List.of(USER1_REF)).withFields(fields);

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

    searchIndex.withOwners(List.of(TEAM11_REF)).withFields(updatedFields);

    SearchIndexField addedField = updatedFields.get(updatedFields.size() - 1);
    addedField.setFullyQualifiedName(
        searchIndex.getFullyQualifiedName() + "." + addedField.getName());

    ChangeDescription change = getChangeDescription(searchIndex, MINOR_UPDATE);
    fieldDeleted(change, FIELD_OWNERS, List.of(USER1_REF));
    fieldAdded(change, FIELD_OWNERS, List.of(TEAM11_REF));
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
            .withOwners(List.of(USER1_REF))
            .withFields(fields);

    // Apply mutually exclusive tags to a searchIndex
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a searchIndex field
    CreateSearchIndex create1 = createRequest(testInfo, 1).withOwners(List.of(USER1_REF));
    SearchIndexField field =
        getField("first_name", SearchIndexDataType.TEXT, null)
            .withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    create1.withFields(List.of(field));
    assertResponse(
        () -> createEntity(create1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a searchIndexes's nested field
    CreateSearchIndex create2 = createRequest(testInfo, 1).withOwners(List.of(USER1_REF));
    SearchIndexField nestedField =
        getField("testNested", SearchIndexDataType.TEXT, null)
            .withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    SearchIndexField field1 =
        getField("test", SearchIndexDataType.NESTED, null).withChildren(List.of(nestedField));
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
    SearchIndex searchIndex =
        createAndCheckEntity(createRequest(test).withFields(fields), ADMIN_AUTH_HEADERS);
    List<String> messages =
        Arrays.asList(
            "{\"email\": \"email1@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email2@email.com\", \"firstName\": \"Test\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email3@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}");
    SearchIndexSampleData searchIndexSampleData =
        new SearchIndexSampleData().withMessages(messages);
    SearchIndex searchIndex1 =
        putSampleData(searchIndex.getId(), searchIndexSampleData, ADMIN_AUTH_HEADERS);
    assertEquals(searchIndexSampleData, searchIndex1.getSampleData());

    SearchIndex searchIndex2 = getSampleData(searchIndex.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(searchIndex2.getSampleData(), searchIndex1.getSampleData());
    messages =
        Arrays.asList(
            "{\"email\": \"email1@email.com\", \"firstName\": \"Bob\", \"lastName\": \"Jones\"}",
            "{\"email\": \"email2@email.com\", \"firstName\": \"Test\", \"lastName\": \"Jones\"}");
    searchIndexSampleData.withMessages(messages);
    SearchIndex putResponse =
        putSampleData(searchIndex2.getId(), searchIndexSampleData, ADMIN_AUTH_HEADERS);
    assertEquals(searchIndexSampleData, putResponse.getSampleData());
    searchIndex2 = getSampleData(searchIndex.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(searchIndexSampleData, searchIndex2.getSampleData());
  }

  @Test
  void patch_usingFqn_searchIndexAttributes_200_ok(TestInfo test) throws IOException {
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
    CreateSearchIndex createSearchIndex =
        createRequest(test).withOwners(List.of(USER1_REF)).withFields(fields);

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

    searchIndex.withOwners(List.of(TEAM11_REF)).withFields(updatedFields);

    SearchIndexField addedField = updatedFields.get(updatedFields.size() - 1);
    addedField.setFullyQualifiedName(
        searchIndex.getFullyQualifiedName() + "." + addedField.getName());

    ChangeDescription change = getChangeDescription(searchIndex, MINOR_UPDATE);
    fieldAdded(change, FIELD_OWNERS, List.of(TEAM11_REF));
    fieldDeleted(change, FIELD_OWNERS, List.of(USER1_REF));
    fieldAdded(change, "fields", JsonUtils.pojoToJson(List.of(addedField)));
    patchEntityUsingFqnAndCheck(searchIndex, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a searchIndex, carry it forward from the search service
    SearchServiceResourceTest serviceTest = new SearchServiceResourceTest();
    CreateSearchService createService =
        serviceTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    SearchService service = serviceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a searchIndex without domain and ensure it inherits domain from the parent
    CreateSearchIndex create = createRequest("user").withService(service.getFullyQualifiedName());
    assertSingleDomainInheritance(create, DOMAIN.getEntityReference());
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

  @Test
  void testNewAggregation(TestInfo testInfo) throws IOException {
    DataQualityReport dataQualityReport = new DataQualityReport();
    SearchRepository searchRepository = Entity.getSearchRepository();
    String query =
        "{\"query\":{\"bool\":{\"should\":[{\"wildcard\":{\"fullyQualifiedName\":{\"value\":\"*tableForExecutableTestSuite\"}}},{\"wildcard\":{\"fullyQualifiedName\":{\"value\":\"*tableForExecutableTestSuiteTwo\"}}}]}}}";

    String aggregationQuery =
        "bucketName=fqn:aggType=terms:field=fullyQualifiedName,bucketName=avgTime:aggType=avg:field=updatedAt";
    SearchAggregation aggregation = SearchIndexUtils.buildAggregationTree(aggregationQuery);
    dataQualityReport = searchRepository.genericAggregation(query, "table", aggregation);
    dataQualityReport
        .getData()
        .forEach(
            (datum) -> {
              Map<String, String> m = datum.getAdditionalProperties();
              assertTrue(m.keySet().containsAll(List.of("fullyQualifiedName", "updatedAt")));
            });

    aggregationQuery =
        "bucketName=fqn:aggType=terms:field=fullyQualifiedName,bucketName=owner:aggType=terms:field=owner.name";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationQuery);
    dataQualityReport = searchRepository.genericAggregation(query, "table", aggregation);
    dataQualityReport
        .getData()
        .forEach(
            (datum) -> {
              Map<String, String> m = datum.getAdditionalProperties();
              assertTrue(m.keySet().containsAll(List.of("fullyQualifiedName", "owner.name")));
            });

    aggregationQuery =
        "bucketName=fqn:aggType=terms:field=fullyQualifiedName,bucketName=owner:aggType=terms:field=owner.name,bucketName=avgTime:aggType=avg:field=updatedAt";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationQuery);
    dataQualityReport = searchRepository.genericAggregation(query, "table", aggregation);
    dataQualityReport
        .getData()
        .forEach(
            (datum) -> {
              Map<String, String> m = datum.getAdditionalProperties();
              assertTrue(
                  m.keySet().containsAll(List.of("fullyQualifiedName", "owner.name", "updatedAt")));
            });

    aggregationQuery = "bucketName=avgTime:aggType=avg:field=updatedAt";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationQuery);
    dataQualityReport = searchRepository.genericAggregation(query, "table", aggregation);
    dataQualityReport
        .getData()
        .forEach(
            (datum) -> {
              Map<String, String> m = datum.getAdditionalProperties();
              assertTrue(m.containsKey("updatedAt"));
            });

    aggregationQuery = "bucketName=fqn:aggType=terms:field=fullyQualifiedName";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationQuery);
    dataQualityReport = searchRepository.genericAggregation(query, "table", aggregation);
    dataQualityReport
        .getData()
        .forEach(
            (datum) -> {
              Map<String, String> m = datum.getAdditionalProperties();
              assertTrue(m.containsKey("fullyQualifiedName"));
            });

    aggregationQuery =
        "bucketName=dates:aggType=date_histogram:field=timestamp&calendar_interval=1d,bucketName=dimesion:aggType=terms:field=testDefinition.dataQualityDimension";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationQuery);
    searchRepository.genericAggregation(null, "testCaseResult", aggregation);
  }

  @Test
  void testAggregationGraph() {
    // 1. Test aggregation with no children
    List<BaseAggregationBuilder> expectedAggregations = new ArrayList<>();
    String aggregationString = "bucketName=my-agg-name:aggType=terms:field=my-field";
    SearchAggregation aggregation = SearchIndexUtils.buildAggregationTree(aggregationString);

    SearchAggregationNode expectedTree = new SearchAggregationNode("root", "root", null);
    expectedTree.addChild(
        new SearchAggregationNode("terms", "my-agg-name", Map.of("field", "my-field")));
    assertThat(aggregation.getAggregationTree()).usingRecursiveComparison().isEqualTo(expectedTree);

    DataQualityReportMetadata actualMetadata = aggregation.getAggregationMetadata();
    DataQualityReportMetadata expectedMetadata =
        new DataQualityReportMetadata()
            .withDimensions(List.of("my-field"))
            .withKeys(List.of("sterms#my-agg-name"))
            .withMetrics(List.of("document_count"));
    assertThat(actualMetadata).usingRecursiveComparison().isEqualTo(expectedMetadata);

    expectedAggregations.add(AggregationBuilders.terms("my-agg-name").field("my-field"));
    List<ElasticAggregations> actualElasticAggregations =
        ElasticAggregationsBuilder.buildAggregation(
            aggregation.getAggregationTree(), null, new ArrayList<>());

    validateAggregation(actualElasticAggregations, expectedAggregations);

    // 2. Test aggregation with 1 nested aggregation
    expectedAggregations = new ArrayList<>();
    aggregationString =
        "bucketName=entityLinks:aggType=terms:field=entityLinks.nonNormalized,"
            + "bucketName=status_counts:aggType=terms:field=testCaseResults.testCaseStatus";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationString);

    expectedTree = new SearchAggregationNode("root", "root", null);
    SearchAggregationNode node1 =
        new SearchAggregationNode(
            "terms", "entityLinks", Map.of("field", "entityLinks.nonNormalized"));
    node1.addChild(
        new SearchAggregationNode(
            "terms", "status_counts", Map.of("field", "testCaseResults.testCaseStatus")));
    expectedTree.addChild(node1);
    assertThat(aggregation.getAggregationTree()).usingRecursiveComparison().isEqualTo(expectedTree);

    actualMetadata = aggregation.getAggregationMetadata();
    expectedMetadata =
        new DataQualityReportMetadata()
            .withDimensions(List.of("entityLinks.nonNormalized", "testCaseResults.testCaseStatus"))
            .withKeys(List.of("sterms#entityLinks", "sterms#status_counts"))
            .withMetrics(List.of("document_count"));
    assertThat(actualMetadata).usingRecursiveComparison().isEqualTo(expectedMetadata);

    expectedAggregations.add(
        AggregationBuilders.terms("entityLinks")
            .field("entityLinks.nonNormalized")
            .subAggregation(
                AggregationBuilders.terms("status_counts")
                    .field("testCaseResults.testCaseStatus")));
    actualElasticAggregations =
        ElasticAggregationsBuilder.buildAggregation(
            aggregation.getAggregationTree(), null, new ArrayList<>());

    validateAggregation(actualElasticAggregations, expectedAggregations);

    // 3. Test aggregation with 2 nested aggregation
    expectedAggregations = new ArrayList<>();
    aggregationString =
        "bucketName=entityLinks:aggType=terms:field=entityLinks.nonNormalized,"
            + "bucketName=statusCount:aggType=terms:field=testCaseResults.testCaseStatus,"
            + "bucketName=owner:aggType=terms:field=testSuite.owner";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationString);

    expectedTree = new SearchAggregationNode("root", "root", null);
    node1 =
        new SearchAggregationNode(
            "terms", "entityLinks", Map.of("field", "entityLinks.nonNormalized"));
    SearchAggregationNode node2 =
        new SearchAggregationNode(
            "terms", "statusCount", Map.of("field", "testCaseResults.testCaseStatus"));
    node2.addChild(new SearchAggregationNode("terms", "owner", Map.of("field", "testSuite.owner")));
    node1.addChild(node2);
    expectedTree.addChild(node1);
    assertThat(aggregation.getAggregationTree()).usingRecursiveComparison().isEqualTo(expectedTree);

    actualMetadata = aggregation.getAggregationMetadata();
    expectedMetadata =
        new DataQualityReportMetadata()
            .withDimensions(
                List.of(
                    "entityLinks.nonNormalized",
                    "testCaseResults.testCaseStatus",
                    "testSuite.owner"))
            .withKeys(List.of("sterms#entityLinks", "sterms#statusCount", "sterms#owner"))
            .withMetrics(List.of("document_count"));
    assertThat(actualMetadata).usingRecursiveComparison().isEqualTo(expectedMetadata);

    expectedAggregations.add(
        AggregationBuilders.terms("entityLinks")
            .field("entityLinks.nonNormalized")
            .subAggregation(
                AggregationBuilders.terms("statusCount")
                    .field("testCaseResults.testCaseStatus")
                    .subAggregation(AggregationBuilders.terms("owner").field("testSuite.owner"))));
    actualElasticAggregations =
        ElasticAggregationsBuilder.buildAggregation(
            aggregation.getAggregationTree(), null, new ArrayList<>());

    validateAggregation(actualElasticAggregations, expectedAggregations);

    // 4. Metric aggregation
    expectedAggregations = new ArrayList<>();
    aggregationString =
        "bucketName=entityLinks:aggType=terms:field=entityLinks.nonNormalized,"
            + "bucketName=minPrice:aggType=min:field=price.adjusted";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationString);

    expectedTree = new SearchAggregationNode("root", "root", null);
    node1 =
        new SearchAggregationNode(
            "terms", "entityLinks", Map.of("field", "entityLinks.nonNormalized"));
    node2 = new SearchAggregationNode("min", "minPrice", Map.of("field", "price.adjusted"));
    node1.addChild(node2);
    expectedTree.addChild(node1);
    assertThat(aggregation.getAggregationTree()).usingRecursiveComparison().isEqualTo(expectedTree);

    actualMetadata = aggregation.getAggregationMetadata();
    expectedMetadata =
        new DataQualityReportMetadata()
            .withDimensions(List.of("entityLinks.nonNormalized"))
            .withKeys(List.of("sterms#entityLinks", "min#minPrice"))
            .withMetrics(List.of("price.adjusted"));
    assertThat(actualMetadata).usingRecursiveComparison().isEqualTo(expectedMetadata);

    expectedAggregations.add(
        AggregationBuilders.terms("entityLinks")
            .field("entityLinks.nonNormalized")
            .subAggregation(AggregationBuilders.min("minPrice").field("price.adjusted")));
    actualElasticAggregations =
        ElasticAggregationsBuilder.buildAggregation(
            aggregation.getAggregationTree(), null, new ArrayList<>());

    validateAggregation(actualElasticAggregations, expectedAggregations);

    // 6. Date histogram aggregation
    expectedAggregations = new ArrayList<>();
    aggregationString =
        "bucketName=dates:aggType=date_histogram:field=timestamp&calendar_interval=day";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationString);

    expectedTree = new SearchAggregationNode("root", "root", null);
    node1 =
        new SearchAggregationNode(
            "date_histogram", "dates", Map.of("field", "timestamp", "calendar_interval", "day"));
    expectedTree.addChild(node1);
    assertThat(aggregation.getAggregationTree()).usingRecursiveComparison().isEqualTo(expectedTree);

    actualMetadata = aggregation.getAggregationMetadata();
    expectedMetadata =
        new DataQualityReportMetadata()
            .withDimensions(new ArrayList<>())
            .withKeys(List.of("date_histogram#dates"))
            .withMetrics(List.of("timestamp"));
    assertThat(actualMetadata).usingRecursiveComparison().isEqualTo(expectedMetadata);

    expectedAggregations.add(
        AggregationBuilders.dateHistogram("dates")
            .field("timestamp")
            .calendarInterval(new DateHistogramInterval("day")));
    actualElasticAggregations =
        ElasticAggregationsBuilder.buildAggregation(
            aggregation.getAggregationTree(), null, new ArrayList<>());

    validateAggregation(actualElasticAggregations, expectedAggregations);

    // 7. Date histogram aggregation
    expectedAggregations = new ArrayList<>();
    aggregationString =
        "bucketName=dates:aggType=date_histogram:field=timestamp&calendar_interval=day,"
            + "bucketName=minPrice:aggType=min:field=price.adjusted";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationString);

    expectedTree = new SearchAggregationNode("root", "root", null);
    node1 =
        new SearchAggregationNode(
            "date_histogram", "dates", Map.of("field", "timestamp", "calendar_interval", "day"));
    node2 = new SearchAggregationNode("min", "minPrice", Map.of("field", "price.adjusted"));
    node1.addChild(node2);
    expectedTree.addChild(node1);
    assertThat(aggregation.getAggregationTree()).usingRecursiveComparison().isEqualTo(expectedTree);

    actualMetadata = aggregation.getAggregationMetadata();
    expectedMetadata =
        new DataQualityReportMetadata()
            .withDimensions(List.of("timestamp"))
            .withKeys(List.of("date_histogram#dates", "min#minPrice"))
            .withMetrics(List.of("price.adjusted"));
    assertThat(actualMetadata).usingRecursiveComparison().isEqualTo(expectedMetadata);

    expectedAggregations.add(
        AggregationBuilders.dateHistogram("dates")
            .field("timestamp")
            .calendarInterval(new DateHistogramInterval("day"))
            .subAggregation(AggregationBuilders.min("minPrice").field("price.adjusted")));
    actualElasticAggregations =
        ElasticAggregationsBuilder.buildAggregation(
            aggregation.getAggregationTree(), null, new ArrayList<>());

    validateAggregation(actualElasticAggregations, expectedAggregations);

    // 8. Nested aggregation with selector sibling
    expectedAggregations = new ArrayList<>();
    aggregationString =
        "bucketName=entityFQN:aggType=terms:field=originEntityFQN&size=1000,"
            + "bucketName=status:aggType=terms:field=testCaseStatus.keyword&include=\"Failed,Aborted\"::"
            + "bucketName=statusFilter:aggType=bucket_selector:pathValues=status._bucket_count&pathKeys=status&script=\"params.status==0\"";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationString);

    expectedTree = new SearchAggregationNode("root", "root", null);
    node1 =
        new SearchAggregationNode(
            "terms", "entityFQN", Map.of("field", "originEntityFQN", "size", "1000"));
    node2 =
        new SearchAggregationNode(
            "terms",
            "status",
            Map.of("field", "testCaseStatus.keyword", "include", "Failed,Aborted"));
    SearchAggregationNode node3 =
        new SearchAggregationNode(
            "bucket_selector",
            "statusFilter",
            Map.of(
                "pathValues",
                "status._bucket_count",
                "pathKeys",
                "status",
                "script",
                "params.status==0"));
    node1.addChild(node2);
    node1.addChild(node3);
    expectedTree.addChild(node1);
    assertThat(aggregation.getAggregationTree()).usingRecursiveComparison().isEqualTo(expectedTree);

    actualMetadata = aggregation.getAggregationMetadata();
    expectedMetadata =
        new DataQualityReportMetadata()
            .withDimensions(List.of("originEntityFQN", "testCaseStatus.keyword"))
            .withKeys(List.of("sterms#entityFQN", "sterms#status"))
            .withMetrics(List.of("document_count"));
    assertThat(actualMetadata).usingRecursiveComparison().isEqualTo(expectedMetadata);

    String[] include = {"Aborted", "Failed"};
    expectedAggregations.add(
        AggregationBuilders.terms("entityFQN")
            .field("originEntityFQN")
            .size(1000)
            .subAggregation(
                AggregationBuilders.terms("status")
                    .field("testCaseStatus.keyword")
                    .includeExclude(new IncludeExclude(include, null)))
            .subAggregation(
                PipelineAggregatorBuilders.bucketSelector(
                    "statusFilter",
                    Map.of("status", "status._bucket_count"),
                    new Script("params.status==0"))));
    actualElasticAggregations =
        ElasticAggregationsBuilder.buildAggregation(
            aggregation.getAggregationTree(), null, new ArrayList<>());

    validateAggregation(actualElasticAggregations, expectedAggregations);

    // 9. top hits query
    expectedAggregations = new ArrayList<>();
    aggregationString =
        "bucketName=byTerms:aggType=terms:field=entityFqn&size=100,"
            + "bucketName=latest:aggType=top_hits:size=1&sort_field=timestamp&sort_order=desc";
    aggregation = SearchIndexUtils.buildAggregationTree(aggregationString);
    expectedTree = new SearchAggregationNode("root", "root", null);
    node1 =
        new SearchAggregationNode("terms", "byTerms", Map.of("field", "entityFqn", "size", "100"));
    node2 =
        new SearchAggregationNode(
            "top_hits",
            "latest",
            Map.of("size", "1", "sort_field", "timestamp", "sort_order", "desc"));
    node1.addChild(node2);
    expectedTree.addChild(node1);

    assertThat(aggregation.getAggregationTree()).usingRecursiveComparison().isEqualTo(expectedTree);

    expectedAggregations.add(
        AggregationBuilders.terms("byTerms")
            .field("entityFqn")
            .size(100)
            .subAggregation(
                AggregationBuilders.topHits("latest").size(1).sort("timestamp", SortOrder.DESC)));
    actualElasticAggregations =
        ElasticAggregationsBuilder.buildAggregation(
            aggregation.getAggregationTree(), null, new ArrayList<>());

    validateAggregation(actualElasticAggregations, expectedAggregations);
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
    assertListNull(searchIndex.getOwners(), searchIndex.getFollowers(), searchIndex.getFollowers());

    fields = "owners, followers, tags";
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

  public SearchIndex getSearchIndexByName(
      String fqn, String fields, Map<String, String> authHeaders) throws HttpResponseException {
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
  public void compareEntities(
      SearchIndex expected, SearchIndex updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(expected.getService(), expected.getService());
    // TODO add other fields
    TestUtils.validateTags(expected.getTags(), updated.getTags());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  public SearchIndex putSampleData(
      UUID searchIndexId, SearchIndexSampleData data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(searchIndexId).path("/sampleData");
    return TestUtils.put(target, data, SearchIndex.class, OK, authHeaders);
  }

  public SearchIndex getSampleData(UUID searchIndexId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(searchIndexId).path("/sampleData");
    return TestUtils.get(target, SearchIndex.class, authHeaders);
  }

  private static SearchIndexField getField(
      String name, SearchIndexDataType fieldDataType, TagLabel tag) {
    List<TagLabel> tags = tag == null ? new ArrayList<>() : singletonList(tag);
    return new SearchIndexField()
        .withName(name)
        .withDataType(fieldDataType)
        .withDescription(name)
        .withTags(tags);
  }

  private static void assertFields(
      List<SearchIndexField> expectedFields, List<SearchIndexField> actualFields)
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

  private void validateAggregation(
      List<ElasticAggregations> actualElasticAggregations,
      List<BaseAggregationBuilder> expectedAggregations) {
    for (int i = 0; i < actualElasticAggregations.size(); i++) {
      ElasticAggregations actualElasticAggregation = actualElasticAggregations.get(i);
      if (actualElasticAggregation.isPipelineAggregation()) {
        assertEquals(
            expectedAggregations.get(i),
            actualElasticAggregation.getElasticPipelineAggregationBuilder());
      } else {
        assertEquals(
            expectedAggregations.get(i), actualElasticAggregation.getElasticAggregationBuilder());
      }
    }
  }

  @Test
  void test_paginationFetchesTagsAtBothEntityAndFieldLevels(TestInfo test) throws IOException {
    TagLabel searchIndexTagLabel = USER_ADDRESS_TAG_LABEL;
    TagLabel fieldTagLabel = GLOSSARY1_TERM1_LABEL;

    List<SearchIndex> createdSearchIndexes = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      List<SearchIndexField> fields =
          Arrays.asList(
              getField("field1_" + i, SearchIndexDataType.KEYWORD, fieldTagLabel),
              getField("field2_" + i, SearchIndexDataType.TEXT, null));

      CreateSearchIndex createSearchIndex =
          createRequest(test.getDisplayName() + "_pagination_" + i)
              .withFields(fields)
              .withTags(List.of(searchIndexTagLabel));

      SearchIndex searchIndex = createEntity(createSearchIndex, ADMIN_AUTH_HEADERS);
      createdSearchIndexes.add(searchIndex);
    }

    WebTarget target =
        getResource("searchIndexes").queryParam("fields", "tags").queryParam("limit", "50");

    SearchIndexResource.SearchIndexList searchIndexList =
        TestUtils.get(target, SearchIndexResource.SearchIndexList.class, ADMIN_AUTH_HEADERS);
    assertNotNull(searchIndexList.getData());

    List<SearchIndex> ourSearchIndexes =
        searchIndexList.getData().stream()
            .filter(
                si -> createdSearchIndexes.stream().anyMatch(csi -> csi.getId().equals(si.getId())))
            .collect(Collectors.toList());

    assertFalse(
        ourSearchIndexes.isEmpty(),
        "Should find at least one of our created search indexes in pagination");

    for (SearchIndex searchIndex : ourSearchIndexes) {
      assertNotNull(
          searchIndex.getTags(),
          "SearchIndex-level tags should not be null when fields=tags in pagination");
      assertEquals(
          1, searchIndex.getTags().size(), "Should have exactly one search index-level tag");
      assertEquals(searchIndexTagLabel.getTagFQN(), searchIndex.getTags().get(0).getTagFQN());

      // Fields should not have tags when only fields=tags is specified
      if (searchIndex.getFields() != null) {
        for (SearchIndexField field : searchIndex.getFields()) {
          assertTrue(
              field.getTags() == null || field.getTags().isEmpty(),
              "Field tags should not be populated when only fields=tags is specified in pagination");
        }
      }
    }

    target =
        getResource("searchIndexes").queryParam("fields", "fields,tags").queryParam("limit", "50");

    searchIndexList =
        TestUtils.get(target, SearchIndexResource.SearchIndexList.class, ADMIN_AUTH_HEADERS);
    assertNotNull(searchIndexList.getData());

    // Verify at least one of our created search indexes is in the response
    ourSearchIndexes =
        searchIndexList.getData().stream()
            .filter(
                si -> createdSearchIndexes.stream().anyMatch(csi -> csi.getId().equals(si.getId())))
            .collect(Collectors.toList());

    assertFalse(
        ourSearchIndexes.isEmpty(),
        "Should find at least one of our created search indexes in pagination");

    // Verify both search index-level and field-level tags are fetched
    for (SearchIndex searchIndex : ourSearchIndexes) {
      // Verify search index-level tags
      assertNotNull(
          searchIndex.getTags(),
          "SearchIndex-level tags should not be null in pagination with fields,tags");
      assertEquals(
          1, searchIndex.getTags().size(), "Should have exactly one search index-level tag");
      assertEquals(searchIndexTagLabel.getTagFQN(), searchIndex.getTags().get(0).getTagFQN());

      // Verify field-level tags
      assertNotNull(
          searchIndex.getFields(), "Fields should not be null when fields includes fields");

      SearchIndexField field1 =
          searchIndex.getFields().stream()
              .filter(f -> f.getName().startsWith("field1_"))
              .findFirst()
              .orElseThrow(() -> new AssertionError("Should find field1 field"));

      assertNotNull(
          field1.getTags(), "Field tags should not be null when fields=fields,tags in pagination");
      assertTrue(field1.getTags().size() >= 1, "Field should have at least one tag");
      boolean hasExpectedTag =
          field1.getTags().stream()
              .anyMatch(tag -> tag.getTagFQN().equals(fieldTagLabel.getTagFQN()));
      assertTrue(
          hasExpectedTag, "Field should have the expected tag: " + fieldTagLabel.getTagFQN());

      SearchIndexField field2 =
          searchIndex.getFields().stream()
              .filter(f -> f.getName().startsWith("field2_"))
              .findFirst()
              .orElseThrow(() -> new AssertionError("Should find field2 field"));

      assertTrue(
          field2.getTags() == null || field2.getTags().isEmpty(), "field2 should not have tags");
    }
  }
}
