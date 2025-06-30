package org.openmetadata.service.resources.query;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.RandomStringUtils;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.*;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class QueryResourceTest extends EntityResourceTest<Query, CreateQuery> {
  private EntityReference TABLE_REF;
  private String QUERY;
  private String QUERY_CHECKSUM;

  public QueryResourceTest() {
    super(
        Entity.QUERY, Query.class, QueryResource.QueryList.class, "queries", QueryResource.FIELDS);
    supportsSearchIndex = true;
    EVENT_SUBSCRIPTION_TEST_CONTROL_FLAG = false;
  }

  @BeforeAll
  @SneakyThrows
  public void setupQuery(TestInfo test) {
    TableResourceTest tableResourceTest = new TableResourceTest();
    // Create Table Entity
    List<Column> columns = List.of(TableResourceTest.getColumn(C1, ColumnDataType.INT, null));
    CreateTable create =
        tableResourceTest
            .createRequest(test)
            .withName(getEntityName(test))
            .withColumns(columns)
            .withOwners(List.of(EntityResourceTest.USER1_REF));
    Table createdTable = tableResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    TABLE_REF = createdTable.getEntityReference();
    QUERY = "select * from %s";
    QUERY_CHECKSUM = EntityUtil.hash(QUERY);
  }

  @Override
  public CreateQuery createRequest(String type) {
    return new CreateQuery()
        .withName(type)
        .withOwners(List.of(USER1_REF))
        .withUsers(List.of(USER2.getName()))
        .withQueryUsedIn(List.of(TABLE_REF))
        .withQuery(String.format(QUERY, RandomStringUtils.random(10, true, false)))
        .withDuration(0.0)
        .withQueryDate(1673857635064L)
        .withService(SNOWFLAKE_REFERENCE.getFullyQualifiedName());
  }

  @Override
  public void validateCreatedEntity(
      Query createdEntity, CreateQuery request, Map<String, String> authHeaders) {
    assertEquals(request.getQuery(), createdEntity.getQuery());
    assertEquals(request.getQueryDate(), createdEntity.getQueryDate());
    assertEntityReferences(request.getQueryUsedIn(), createdEntity.getQueryUsedIn());
  }

  @Override
  public void compareEntities(Query expected, Query updated, Map<String, String> authHeaders) {}

  @Override
  public Query validateGetWithDifferentFields(Query entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners(), entity.getUsers(), entity.getQueryUsedIn());
    fields = "owners,tags,followers,users,queryUsedIn"; // Not testing for kpiResult field
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners(), entity.getUsers(), entity.getQueryUsedIn());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("queryUsedIn")) {
      assertEntityReferencesFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Test
  void post_valid_query_test_created(TestInfo test) throws IOException {
    CreateQuery create = createRequest(getEntityName(test));
    createEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(create);
  }

  @Test
  void post_without_query_400() {
    CreateQuery create =
        new CreateQuery()
            .withDuration(0.0)
            .withQueryDate(1673857635064L)
            .withService(SNOWFLAKE_REFERENCE.getFullyQualifiedName());
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        "[query param query must not be null]");
  }

  @Test
  void post_same_query_forSameEntityType_409(TestInfo test) throws HttpResponseException {
    CreateQuery create = createRequest(getEntityName(test));
    Query query = createEntity(create, ADMIN_AUTH_HEADERS);

    CreateQuery create1 = createRequest(query.getName());

    assertResponse(
        () -> createEntity(create1, ADMIN_AUTH_HEADERS),
        Response.Status.CONFLICT,
        "Entity already exists");
  }

  @Test
  void put_vote_queryUsage_update(TestInfo test) throws IOException {
    // create query with vote 1
    CreateQuery create = createRequest(getEntityName(test));
    Query createdEntity = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    // 1
    VoteRequest request = new VoteRequest().withUpdatedVoteType(VoteRequest.VoteType.VOTED_UP);
    WebTarget target =
        getResource(String.format("%s/%s/vote", collectionName, createdEntity.getId().toString()));
    ChangeEvent changeEvent =
        TestUtils.put(target, request, ChangeEvent.class, OK, ADMIN_AUTH_HEADERS);
    Query updatedEntity = JsonUtils.convertValue(changeEvent.getEntity(), Query.class);
    assertEquals(1, updatedEntity.getVotes().getUpVotes());
    assertEquals(0, updatedEntity.getVotes().getDownVotes());

    // 2
    VoteRequest request2 = new VoteRequest().withUpdatedVoteType(VoteRequest.VoteType.VOTED_DOWN);
    ChangeEvent changeEvent2 =
        TestUtils.put(target, request2, ChangeEvent.class, OK, ADMIN_AUTH_HEADERS);
    Query updatedEntity2 = JsonUtils.convertValue(changeEvent2.getEntity(), Query.class);
    assertEquals(0, updatedEntity2.getVotes().getUpVotes());
    assertEquals(1, updatedEntity2.getVotes().getDownVotes());
  }

  @Test
  void patch_queryAttributes_200_ok(TestInfo test) throws IOException {
    CreateQuery create = createRequest(getEntityName(test));
    Query query = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add queryUsedIn as TEST_TABLE2
    String origJson = JsonUtils.pojoToJson(query);
    query.setQueryUsedIn(List.of(TEST_TABLE2.getEntityReference()));
    ChangeDescription change = getChangeDescription(query, MINOR_UPDATE);
    fieldAdded(change, "queryUsedIn", List.of(TEST_TABLE2.getEntityReference()));
    fieldDeleted(change, "queryUsedIn", List.of(TABLE_REF));
    patchEntityAndCheck(query, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    Query updatedQuery = getEntity(query.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(List.of(TEST_TABLE2.getEntityReference()), updatedQuery.getQueryUsedIn());
    updatedQuery.setQuery("select * from table1");
    updatedQuery.setQueryUsedIn(List.of(TABLE_REF, TEST_TABLE2.getEntityReference()));
  }

  @Test
  @SneakyThrows
  @Override
  protected void post_entityCreateWithInvalidName_400() {
    // Note: in case of Query empty name works fine since we internally use Checksum
    // Create an entity with mandatory name field null
    final CreateQuery request =
        createRequest(null, "description", "displayName", null)
            .withQuery(String.format(QUERY, RandomStringUtils.random(10, true, false)));
    Query entity = createEntity(request, ADMIN_AUTH_HEADERS);
    assertEquals(EntityUtil.hash(request.getQuery()), entity.getChecksum());

    // Create an entity with mandatory name field empty
    final CreateQuery request1 = createRequest("TestQueryName", "description", "displayName", null);
    entity = createEntity(request1, ADMIN_AUTH_HEADERS);
    assertEquals("TestQueryName", entity.getName());

    // Create an entity with mandatory name field too long
    final CreateQuery request2 =
        createRequest(LONG_ENTITY_NAME, "description", "displayName", null);
    assertResponse(
        () -> createEntity(request2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));
  }

  @Test
  @Order(1)
  void test_sensitivePIIQuery() throws IOException {
    CreateQuery create = createRequest("sensitiveQuery");
    create.withTags(List.of(PII_SENSITIVE_TAG_LABEL));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    String createQuery = create.getQuery();
    // Owner (USER1_REF) can see the results
    ResultList<Query> queries = getQueries(1, "*", false, authHeaders(USER1_REF.getName()));
    queries.getData().forEach(query -> assertEquals(query.getQuery(), createQuery));
    // Another user won't see the PII query body
    ResultList<Query> maskedQueries = getQueries(1, "*", false, authHeaders(USER2_REF.getName()));
    maskedQueries
        .getData()
        .forEach(
            query -> {
              if (query.getTags().stream()
                  .map(TagLabel::getTagFQN)
                  .anyMatch("PII.Sensitive"::equals)) {
                assertEquals("********", query.getQuery());
              } else {
                assertEquals(query.getQuery(), QUERY);
              }
            });
  }

  @Test
  void patch_usingFqn_queryAttributes_200_ok(TestInfo test) throws IOException {
    CreateQuery create = createRequest(getEntityName(test));
    Query query = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add queryUsedIn as TEST_TABLE2
    String origJson = JsonUtils.pojoToJson(query);
    query.setQueryUsedIn(List.of(TEST_TABLE2.getEntityReference()));
    ChangeDescription change = getChangeDescription(query, MINOR_UPDATE);
    fieldAdded(change, "queryUsedIn", List.of(TEST_TABLE2.getEntityReference()));
    fieldDeleted(change, "queryUsedIn", List.of(TABLE_REF));
    patchEntityUsingFqnAndCheck(query, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    Query updatedQuery = getEntity(query.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(List.of(TEST_TABLE2.getEntityReference()), updatedQuery.getQueryUsedIn());
    updatedQuery.setQuery("select * from table1");
    updatedQuery.setQueryUsedIn(List.of(TABLE_REF, TEST_TABLE2.getEntityReference()));
  }

  @Test
  void test_usingFqn_patchQueryMustUpdateChecksum(TestInfo test) throws IOException {
    CreateQuery create = createRequest(getEntityName(test));
    Query query = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add queryUsedIn as TEST_TABLE2
    String origJson = JsonUtils.pojoToJson(query);
    String queryText = String.format(QUERY, "test3");
    query.setQuery(queryText);
    ChangeDescription change = getChangeDescription(query, MINOR_UPDATE);
    fieldUpdated(change, "query", create.getQuery(), queryText);
    fieldUpdated(
        change, "checksum", EntityUtil.hash(create.getQuery()), EntityUtil.hash(queryText));
    patchEntityUsingFqnAndCheck(query, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    Query updatedQuery = getEntity(query.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(updatedQuery.getQuery(), queryText);
    assertEquals(updatedQuery.getChecksum(), EntityUtil.hash(updatedQuery.getQuery()));
  }

  @Test
  void test_duplicateQueryFail() throws IOException {
    String query = "select * from test";
    CreateQuery create = createRequest("duplicateQuery");
    create.setQuery(query);
    Query createdQuery = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    CreateQuery create1 = createRequest("query2");
    create.setQuery("select * from dim_address");
    Query createdQuery2 = createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);
    CreateQuery postDuplicateCreate = createRequest("duplicateQuery1");
    postDuplicateCreate.setQuery(query);
    String origJson = JsonUtils.pojoToJson(query);
    Query updatedQuery = getEntity(createdQuery.getId(), ADMIN_AUTH_HEADERS);
    updatedQuery.setQuery("select * from dim_address");
    assertResponse(
        () -> createEntity(postDuplicateCreate, ADMIN_AUTH_HEADERS),
        Response.Status.CONFLICT,
        "Entity already exists");
  }

  @Test
  void test_patchQueryMustUpdateChecksum(TestInfo test) throws IOException {
    CreateQuery create = createRequest(getEntityName(test));
    Query query = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add queryUsedIn as TEST_TABLE2
    String origJson = JsonUtils.pojoToJson(query);
    String queryText = String.format(QUERY, "test2");
    query.setQuery(queryText);
    ChangeDescription change = getChangeDescription(query, MINOR_UPDATE);
    fieldUpdated(change, "query", create.getQuery(), queryText);
    fieldUpdated(
        change, "checksum", EntityUtil.hash(create.getQuery()), EntityUtil.hash(queryText));
    patchEntityAndCheck(query, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    Query updatedQuery = getEntity(query.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(updatedQuery.getQuery(), queryText);
    assertEquals(updatedQuery.getChecksum(), EntityUtil.hash(updatedQuery.getQuery()));
  }

  public ResultList<Query> getQueries(
      Integer limit, String fields, Boolean includeAll, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection();
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = target.queryParam("fields", fields);
    if (includeAll) {
      target = target.queryParam("include", "all");
    }
    return TestUtils.get(target, QueryResource.QueryList.class, authHeaders);
  }
}
