package org.openmetadata.service.resources.query;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.Map;
import javax.ws.rs.core.Response;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.TestUtils;

public class QueryResourceTest extends EntityResourceTest<Query, CreateQuery> {

  public QueryResourceTest() {
    super(Entity.QUERY, Query.class, QueryResource.queryList.class, "query", QueryResource.FIELDS);
  }

  /**
   * @param name
   * @return
   */
  @Override
  public CreateQuery createRequest(String name) {
    return new CreateQuery()
        .withName(name)
        .withEntityName(name)
        .withQuery("select * from sales")
        .withDuration(0.0)
        .withQueryDate("2022-11-12")
        .withVote(1.0);
  }

  /**
   * @param createdEntity
   * @param request
   * @param authHeaders
   * @throws HttpResponseException
   */
  @Override
  public void validateCreatedEntity(Query createdEntity, CreateQuery request, Map<String, String> authHeaders)
      throws HttpResponseException {}

  /**
   * @param expected
   * @param updated
   * @param authHeaders
   * @throws HttpResponseException
   */
  @Override
  public void compareEntities(Query expected, Query updated, Map<String, String> authHeaders)
      throws HttpResponseException {}

  /**
   * @param entity
   * @param byName
   * @return
   * @throws HttpResponseException
   */
  @Override
  public Query validateGetWithDifferentFields(Query entity, boolean byName) throws HttpResponseException {
    return null;
  }

  /**
   * @param fieldName
   * @param expected
   * @param actual
   * @throws IOException
   */
  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {}

  @Test
  public void post_valid_query_test_created(TestInfo test) throws IOException {
    CreateQuery create = createRequest(getEntityName(test));
    createEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(create);
  }

  @Test
  public void post_without_entityName_400(TestInfo test) throws IOException {
    CreateQuery create =
        new CreateQuery().withQuery("select * from sales").withDuration(0.0).withQueryDate("2022-11-12").withVote(1.0);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), Response.Status.BAD_REQUEST, "[entityName must not be null]");
  }

  @Test
  public void post_without_query_400(TestInfo test) throws IOException {
    CreateQuery create =
        new CreateQuery()
            .withDuration(0.0)
            .withQueryDate("2022-11-12")
            .withVote(1.0)
            .withEntityName(getEntityName(test));
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), Response.Status.BAD_REQUEST, "[query must not be null]");
  }

  @Test
  void post_same_query_forSameEntityType_409(TestInfo test) throws HttpResponseException {
    CreateQuery create = createRequest(getEntityName(test));
    createEntity(create, ADMIN_AUTH_HEADERS);

    CreateQuery create1 = createRequest(getEntityName(test));

    assertResponse(() -> createEntity(create1, ADMIN_AUTH_HEADERS), Response.Status.CONFLICT, "Entity already exists");
  }

  @Override
  @Test
  protected void post_entityCreateWithInvalidName_400() {
    // Create an entity with mandatory name field null
    final CreateQuery request = createRequest(null, "description", "displayName", null);
    assertResponse(() -> createEntity(request, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[entityName must not be null]");

    // Create an entity with mandatory name field empty
    final CreateQuery request1 = createRequest("", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request1, ADMIN_AUTH_HEADERS), BAD_REQUEST, TestUtils.getEntityNameLengthError(entityClass));

    // Create an entity with mandatory name field too long
    final CreateQuery request2 = createRequest(LONG_ENTITY_NAME, "description", "displayName", null);
    assertResponse(
        () -> createEntity(request2, ADMIN_AUTH_HEADERS), BAD_REQUEST, TestUtils.getEntityNameLengthError(entityClass));
  }
}
