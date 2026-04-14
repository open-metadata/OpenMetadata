package org.openmetadata.service.security.mask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.Authorizer;

class PIIMaskerTest {

  @Test
  void maskSampleDataMasksSensitiveColumnsAndWholeTables() {
    String tableFqn = "service.db.schema.orders";
    TableData sampleData =
        new TableData()
            .withColumns(new ArrayList<>(List.of("email", "city")))
            .withRows(
                new ArrayList<>(
                    List.of(
                        new ArrayList<>(List.of("alice@example.com", "New York")),
                        new ArrayList<>(List.of("bob@example.com", "San Francisco")))));
    List<Column> columns =
        List.of(column(tableFqn, "email", true), column(tableFqn, "city", false));
    Table table = table(tableFqn, columns, false, List.of());

    assertNull(PIIMasker.maskSampleData(null, table, columns));

    TableData masked = PIIMasker.maskSampleData(sampleData, table, columns);

    assertEquals("email [MASKED]", masked.getColumns().get(0));
    assertEquals("city", masked.getColumns().get(1));
    assertEquals(PIIMasker.MASKED_VALUE, masked.getRows().get(0).get(0));
    assertEquals("New York", masked.getRows().get(0).get(1));

    Table piiTable =
        table(
            tableFqn,
            List.of(column(tableFqn, "email", false), column(tableFqn, "city", false)),
            true,
            List.of());
    piiTable.setSampleData(
        new TableData()
            .withColumns(new ArrayList<>(List.of("email", "city")))
            .withRows(new ArrayList<>(List.of(new ArrayList<>(List.of("secret", "Paris"))))));

    Table maskedTable = PIIMasker.getSampleData(piiTable);

    assertEquals("email [MASKED]", maskedTable.getSampleData().getColumns().get(0));
    assertEquals("city [MASKED]", maskedTable.getSampleData().getColumns().get(1));
    assertEquals(PIIMasker.MASKED_VALUE, maskedTable.getSampleData().getRows().get(0).get(0));
    assertEquals(PIIMasker.MASKED_VALUE, maskedTable.getSampleData().getRows().get(0).get(1));
  }

  @Test
  void sampleDataMaskingHandlesTopicsAndSearchIndexes() {
    Topic topic =
        new Topic()
            .withFullyQualifiedName("service.topic.orders")
            .withTags(List.of())
            .withSampleData(new TopicSampleData().withMessages(List.of("secret-message")));
    topic.setMessageSchema(
        new MessageSchema()
            .withSchemaFields(List.of(field("payload", false, List.of(field("ssn", true, null))))));

    Topic maskedTopic = PIIMasker.getSampleData(topic);

    assertEquals(List.of(PIIMasker.MASKED_VALUE), maskedTopic.getSampleData().getMessages());

    SearchIndex searchIndex =
        new SearchIndex()
            .withFullyQualifiedName("service.search.orders")
            .withTags(List.of(piiTag()))
            .withSampleData(new SearchIndexSampleData().withMessages(List.of("secret-document")));

    SearchIndex maskedSearchIndex = PIIMasker.getSampleData(searchIndex);

    assertEquals(List.of(PIIMasker.MASKED_VALUE), maskedSearchIndex.getSampleData().getMessages());

    Topic plainTopic = new Topic().withSampleData(null);
    assertSame(plainTopic, PIIMasker.getSampleData(plainTopic));
  }

  @Test
  void tableAndColumnProfilesRespectPiiAuthorization() {
    String tableFqn = "service.db.schema.orders";
    String columnFqn = tableFqn + ".email";
    EntityReference owner = entityReference(Entity.USER, "owner");
    Table table = table(tableFqn, List.of(column(tableFqn, "email", true)), false, List.of(owner));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);

    Column sensitiveColumn = column(tableFqn, "email", true);
    sensitiveColumn.setProfile(new ColumnProfile().withName("email"));
    Column plainColumn = column(tableFqn, "city", false);
    plainColumn.setProfile(new ColumnProfile().withName("city"));
    List<Column> profileColumns = new ArrayList<>(List.of(sensitiveColumn, plainColumn));

    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false, false, true);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TABLE, tableFqn, "owners", Include.ALL))
          .thenReturn(table);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TABLE, tableFqn, "columns,tags,owners", Include.ALL))
          .thenReturn(table);

      List<Column> maskedColumns =
          PIIMasker.getTableProfile(tableFqn, profileColumns, authorizer, securityContext);
      assertNull(maskedColumns.get(0).getProfile());
      assertEquals("email [MASKED]", maskedColumns.get(0).getName());
      assertEquals("city", maskedColumns.get(1).getName());

      List<ColumnProfile> columnProfiles =
          List.of(new ColumnProfile().withName("email"), new ColumnProfile().withName("email"));
      List<ColumnProfile> maskedProfiles =
          PIIMasker.getColumnProfile(columnFqn, columnProfiles, authorizer, securityContext);
      assertEquals(2, maskedProfiles.size());
      assertNull(maskedProfiles.get(0).getName());
      assertNull(maskedProfiles.get(1).getName());

      List<ColumnProfile> authorizedProfiles =
          PIIMasker.getColumnProfile(columnFqn, columnProfiles, authorizer, securityContext);
      assertSame(columnProfiles, authorizedProfiles);
    }
  }

  @Test
  void maskColumnProfileReturnsOnlyTheColumnNameForSensitiveColumns() {
    String tableFqn = "service.db.schema.orders";
    Table table =
        table(
            tableFqn,
            List.of(column(tableFqn, "email", true), column(tableFqn, "city", false)),
            false,
            List.of());
    ColumnProfile sensitiveProfile = new ColumnProfile().withName("email").withNullCount(2.0);
    ColumnProfile plainProfile = new ColumnProfile().withName("city").withNullCount(1.0);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TABLE, tableFqn, "columns,tags", Include.ALL))
          .thenReturn(table);

      ColumnProfile masked = PIIMasker.maskColumnProfile(tableFqn, sensitiveProfile);
      ColumnProfile plain = PIIMasker.maskColumnProfile(tableFqn, plainProfile);

      assertEquals("email", masked.getName());
      assertNull(masked.getNullCount());
      assertSame(plainProfile, plain);
    }
  }

  @Test
  void getTestCasesMasksSensitiveColumnCasesAndCachesTableLookups() {
    String tableFqn = "service.db.schema.orders";
    EntityReference owner = entityReference(Entity.USER, "owner");
    Table table = table(tableFqn, List.of(column(tableFqn, "email", true)), false, List.of(owner));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false);

    TestCase columnTestCase =
        new TestCase()
            .withName("email_not_null")
            .withDescription("Should not leak sensitive details")
            .withEntityLink(
                new MessageParser.EntityLink(Entity.TABLE, tableFqn, "columns", "email", null)
                    .getLinkString())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withName("min").withValue("1")))
            .withTestCaseResult(new TestCaseResult());
    TestCase tableTestCase =
        new TestCase()
            .withName("row_count")
            .withEntityLink(new MessageParser.EntityLink(Entity.TABLE, tableFqn).getLinkString());
    ResultList<TestCase> testCases =
        new ResultList<>(new ArrayList<>(List.of(columnTestCase, tableTestCase)));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TABLE, tableFqn, "owners,tags,columns", Include.ALL))
          .thenReturn(table);

      ResultList<TestCase> masked = PIIMasker.getTestCases(testCases, authorizer, securityContext);

      TestCase maskedColumnCase = masked.getData().get(0);
      assertEquals("email_not_null [MASKED]", maskedColumnCase.getName());
      assertNull(maskedColumnCase.getDescription());
      assertNull(maskedColumnCase.getParameterValues());
      assertNull(maskedColumnCase.getTestCaseResult());
      assertEquals("row_count", masked.getData().get(1).getName());

      mockedEntity.verify(
          () -> Entity.getEntityByName(Entity.TABLE, tableFqn, "owners,tags,columns", Include.ALL),
          times(1));
    }
  }

  @Test
  void getQueriesAndMaskUserHideSensitiveValuesForUnauthorizedUsers() {
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    EntityReference owner = entityReference(Entity.USER, "owner");
    Query sensitiveQuery =
        new Query()
            .withQuery("select email from customer")
            .withTags(List.of(piiTag()))
            .withOwners(List.of(owner));
    Query plainQuery =
        new Query()
            .withQuery("select city from customer")
            .withTags(List.of())
            .withOwners(List.of(owner));
    ResultList<Query> queries =
        new ResultList<>(new ArrayList<>(List.of(sensitiveQuery, plainQuery)));

    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false, false, false);

    ResultList<Query> maskedQueries = PIIMasker.getQueries(queries, authorizer, securityContext);
    User maskedUser =
        PIIMasker.maskUser(authorizer, securityContext, new User().withEmail("user@example.com"));

    assertEquals(PIIMasker.MASKED_VALUE, maskedQueries.getData().get(0).getQuery());
    assertEquals("select city from customer", maskedQueries.getData().get(1).getQuery());
    assertEquals(PIIMasker.MASKED_MAIL, maskedUser.getEmail());
  }

  @Test
  void getQueriesAndMaskUserLeaveAuthorizedValuesUntouched() {
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    EntityReference owner = entityReference(Entity.USER, "owner");
    Query query =
        new Query()
            .withQuery("select email from customer")
            .withTags(List.of(piiTag()))
            .withOwners(List.of(owner));
    ResultList<Query> queries = new ResultList<>(new ArrayList<>(List.of(query)));
    User user = new User().withEmail("user@example.com");

    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(true);
    when(authorizer.authorizePII(securityContext, null)).thenReturn(true);

    ResultList<Query> untouchedQueries = PIIMasker.getQueries(queries, authorizer, securityContext);
    User untouchedUser = PIIMasker.maskUser(authorizer, securityContext, user);

    assertSame(query, untouchedQueries.getData().get(0));
    assertSame(user, untouchedUser);
    assertEquals("user@example.com", untouchedUser.getEmail());
  }

  private static Table table(
      String fqn, List<Column> columns, boolean pii, List<EntityReference> owners) {
    Table table = new Table().withFullyQualifiedName(fqn).withColumns(columns).withOwners(owners);
    table.setTags(pii ? List.of(piiTag()) : List.of());
    return table;
  }

  private static Column column(String tableFqn, String name, boolean pii) {
    Column column = new Column().withName(name).withFullyQualifiedName(tableFqn + "." + name);
    column.setTags(pii ? List.of(piiTag()) : List.of());
    return column;
  }

  private static Field field(String name, boolean pii, List<Field> children) {
    Field field = new Field().withName(name).withFullyQualifiedName(name);
    field.setTags(pii ? List.of(piiTag()) : List.of());
    field.setChildren(children);
    return field;
  }

  private static TagLabel piiTag() {
    return new TagLabel().withTagFQN(PIIMasker.SENSITIVE_PII_TAG);
  }

  private static EntityReference entityReference(String type, String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(name)
        .withFullyQualifiedName(name);
  }
}
