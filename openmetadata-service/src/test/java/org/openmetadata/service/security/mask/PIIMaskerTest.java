package org.openmetadata.service.security.mask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.searchindex.SearchIndexSampleData;
import org.openmetadata.schema.type.topic.TopicSampleData;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
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
  void maskSampleDataIgnoresSensitiveColumnsTheSampleDoesNotInclude() {
    String tableFqn = "service.db.schema.orders";
    Column customer =
        column(tableFqn, "customer", false)
            .withChildren(List.of(column(tableFqn + ".customer", "email", true)));
    List<Column> columns =
        List.of(
            column(tableFqn, "id", false),
            column(tableFqn, "phone", true),
            column(tableFqn, "amount", false),
            customer);
    TableData sampleData =
        new TableData()
            .withColumns(new ArrayList<>(List.of("amount", "phone")))
            .withRows(new ArrayList<>(List.of(new ArrayList<>(List.of(100, "555-0100")))));

    TableData masked =
        PIIMasker.maskSampleData(sampleData, table(tableFqn, columns, false, List.of()), columns);

    assertEquals(List.of("amount", "phone [MASKED]"), masked.getColumns());
    assertEquals(List.of(100, PIIMasker.MASKED_VALUE), masked.getRows().getFirst());
  }

  @Test
  void maskSampleDataMatchesSensitiveColumnsIgnoringCase() {
    String tableFqn = "service.db.schema.orders";
    List<Column> columns =
        List.of(column(tableFqn, "email", true), column(tableFqn, "city", false));
    TableData sampleData =
        new TableData()
            .withColumns(new ArrayList<>(List.of("EMAIL", "city")))
            .withRows(
                new ArrayList<>(List.of(new ArrayList<>(List.of("alice@example.com", "Paris")))));

    TableData masked =
        PIIMasker.maskSampleData(sampleData, table(tableFqn, columns, false, List.of()), columns);

    assertEquals(List.of("EMAIL [MASKED]", "city"), masked.getColumns());
    assertEquals(List.of(PIIMasker.MASKED_VALUE, "Paris"), masked.getRows().getFirst());
  }

  @Test
  void maskSampleDataMasksEverySampledColumnOfASensitiveTable() {
    String tableFqn = "service.db.schema.orders";
    List<Column> columns = List.of(column(tableFqn, "email", false));
    Table piiTable = table(tableFqn, columns, true, List.of());
    TableData wider =
        new TableData()
            .withColumns(new ArrayList<>(List.of("email", "city")))
            .withRows(new ArrayList<>(List.of(new ArrayList<>(List.of("secret", "Paris")))));

    TableData masked = PIIMasker.maskSampleData(wider, piiTable, columns);

    assertEquals(List.of("email [MASKED]", "city [MASKED]"), masked.getColumns());
    assertEquals(
        List.of(PIIMasker.MASKED_VALUE, PIIMasker.MASKED_VALUE), masked.getRows().getFirst());

    List<Column> moreColumns =
        List.of(column(tableFqn, "email", false), column(tableFqn, "city", false));
    TableData narrower =
        new TableData()
            .withColumns(new ArrayList<>(List.of("email")))
            .withRows(new ArrayList<>(List.of(new ArrayList<>(List.of("secret")))));

    masked =
        PIIMasker.maskSampleData(
            narrower, table(tableFqn, moreColumns, true, List.of()), moreColumns);

    assertEquals(List.of("email [MASKED]"), masked.getColumns());
    assertEquals(List.of(PIIMasker.MASKED_VALUE), masked.getRows().getFirst());
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
  void searchIndexSampleDataMasksWhenOnlyFieldsCarryPii() {
    // Entity has no PII tag at all; masking must be driven by the field/nested-field tags that
    // SearchIndexRepository.getSampleData hydrates for the masker.
    SearchIndex withTopLevelPiiField =
        new SearchIndex()
            .withFullyQualifiedName("service.search.orders")
            .withTags(List.of())
            .withFields(List.of(searchIndexField("ssn", true, null)))
            .withSampleData(new SearchIndexSampleData().withMessages(List.of("secret-document")));

    SearchIndex maskedTopLevel = PIIMasker.getSampleData(withTopLevelPiiField);

    assertEquals(List.of(PIIMasker.MASKED_VALUE), maskedTopLevel.getSampleData().getMessages());

    // Nested child under a non-PII parent field — this is the exact leak reported.
    SearchIndex withNestedPiiField =
        new SearchIndex()
            .withFullyQualifiedName("service.search.orders")
            .withTags(List.of())
            .withFields(
                List.of(
                    searchIndexField(
                        "payload", false, List.of(searchIndexField("ssn", true, null)))))
            .withSampleData(new SearchIndexSampleData().withMessages(List.of("secret-document")));

    SearchIndex maskedNested = PIIMasker.getSampleData(withNestedPiiField);

    assertEquals(List.of(PIIMasker.MASKED_VALUE), maskedNested.getSampleData().getMessages());

    // No PII tags anywhere — sample data must be returned verbatim (no false-positive masking).
    SearchIndex withPlainFields =
        new SearchIndex()
            .withFullyQualifiedName("service.search.orders")
            .withTags(List.of())
            .withFields(
                List.of(
                    searchIndexField(
                        "payload", false, List.of(searchIndexField("name", false, null)))))
            .withSampleData(new SearchIndexSampleData().withMessages(List.of("plain-document")));

    SearchIndex notMasked = PIIMasker.getSampleData(withPlainFields);

    assertEquals(List.of("plain-document"), notMasked.getSampleData().getMessages());

    // Missing fields must not cause an exception or mask plain sample data.
    SearchIndex withNoFields =
        new SearchIndex()
            .withFullyQualifiedName("service.search.orders")
            .withTags(List.of())
            .withSampleData(new SearchIndexSampleData().withMessages(List.of("plain-document")));

    SearchIndex notMaskedNoFields = PIIMasker.getSampleData(withNoFields);

    assertEquals(List.of("plain-document"), notMaskedNoFields.getSampleData().getMessages());

    // Null sample data is returned untouched, mirroring the Topic contract.
    SearchIndex noSampleData =
        new SearchIndex().withFullyQualifiedName("service.search.orders").withTags(List.of());
    assertSame(noSampleData, PIIMasker.getSampleData(noSampleData));
  }

  @Test
  void searchIndexSampleDataMasksTheWholeOpaqueMessageList() {
    SearchIndex searchIndex = searchIndexWithMessages(List.of(piiTag()), null);

    assertSame(searchIndex, PIIMasker.getSampleData(searchIndex));
    assertEquals(List.of(PIIMasker.MASKED_VALUE), searchIndex.getSampleData().getMessages());
  }

  @Test
  void searchIndexSampleDataFindsSensitiveDescendantsAfterPlainSiblings() {
    SearchIndexField leaf = searchIndexField("email", true, null);
    SearchIndexField details = searchIndexField("details", false, List.of(leaf)).withTags(null);
    SearchIndexField contact =
        searchIndexField("contact", false, List.of(searchIndexField("city", false, null), details));
    SearchIndex searchIndex =
        searchIndexWithMessages(
            List.of(),
            List.of(
                searchIndexField("publicId", false, null).withTags(null),
                searchIndexField("payload", false, List.of(contact)).withTags(null)));

    PIIMasker.getSampleData(searchIndex);

    assertEquals(List.of(PIIMasker.MASKED_VALUE), searchIndex.getSampleData().getMessages());
  }

  @Test
  void searchIndexSampleDataRetainsNonSensitiveTreesAndMissingFields() {
    List<String> messages = searchIndexWithMessages(List.of(), null).getSampleData().getMessages();
    SearchIndexField plain =
        searchIndexField("payload", false, List.of(searchIndexField("email", false, null)))
            .withTags(List.of(new TagLabel().withTagFQN("PII.NonSensitive")));
    SearchIndex searchIndex = searchIndexWithMessages(List.of(), List.of(plain));

    assertEquals(messages, PIIMasker.getSampleData(searchIndex).getSampleData().getMessages());
    searchIndex.setFields(null);
    assertEquals(messages, PIIMasker.getSampleData(searchIndex).getSampleData().getMessages());
    searchIndex.setSampleData(null);
    assertSame(searchIndex, PIIMasker.getSampleData(searchIndex));
    assertNull(searchIndex.getSampleData());
  }

  private static SearchIndex searchIndexWithMessages(
      List<TagLabel> tags, List<SearchIndexField> fields) {
    return new SearchIndex()
        .withTags(tags)
        .withFields(fields)
        .withSampleData(
            new SearchIndexSampleData()
                .withMessages(
                    List.of(
                        "{\"publicId\":1,\"payload\":{\"contact\":{\"details\":{\"email\":\"secret-a\"}}}}",
                        "opaque secret-b")));
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
  void tableProfileMaskingReachesNestedColumnChildren() {
    String tableFqn = "service.db.schema.orders";
    EntityReference owner = entityReference(Entity.USER, "owner");
    // The leaf city carries the tag; the contact struct carries it above email; zip is untouched
    List<Column> columns = nestedProfileColumns(tableFqn);
    Table table = table(tableFqn, columns, false, List.of(owner));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false, true);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TABLE, tableFqn, "owners", Include.ALL))
          .thenReturn(table);

      List<Column> masked =
          PIIMasker.getTableProfile(tableFqn, columns, authorizer, securityContext);

      // The tagged leaf and the struct whose subtree holds it lose their profiles
      assertNull(masked.getFirst().getProfile());
      assertEquals("address [MASKED]", masked.getFirst().getName());
      assertNull(masked.getFirst().getChildren().getFirst().getProfile());
      assertEquals("city [MASKED]", masked.getFirst().getChildren().getFirst().getName());

      // A sibling leaf under the same struct keeps its profile: no direct tag covers it
      Column zip = masked.getFirst().getChildren().get(1);
      assertNotNull(zip.getProfile());
      assertEquals("zip", zip.getName());

      // The direct tag on the contact struct covers the untagged email field beneath it
      assertNull(masked.get(1).getProfile());
      assertEquals("contact [MASKED]", masked.get(1).getName());
      assertNull(masked.get(1).getChildren().getFirst().getProfile());
      assertEquals("email [MASKED]", masked.get(1).getChildren().getFirst().getName());

      // Columns with no PII anywhere along their path stay fully intact
      assertNotNull(masked.get(2).getProfile());
      assertEquals("id", masked.get(2).getName());

      // An authorized caller gets every profile back: a fresh list, not the one the unauthorized
      // pass above already mutated in place
      List<Column> authorizedColumns = nestedProfileColumns(tableFqn);
      List<Column> authorized =
          PIIMasker.getTableProfile(tableFqn, authorizedColumns, authorizer, securityContext);

      assertSame(authorizedColumns, authorized);
      assertNotNull(authorized.getFirst().getProfile());
      assertEquals("address", authorized.getFirst().getName());
      assertNotNull(authorized.getFirst().getChildren().getFirst().getProfile());
      assertEquals("city", authorized.getFirst().getChildren().getFirst().getName());
      assertEquals("zip", authorized.getFirst().getChildren().get(1).getName());
      assertEquals("email", authorized.get(1).getChildren().getFirst().getName());
      assertNotNull(authorized.get(1).getChildren().getFirst().getProfile());
      assertEquals("id", authorized.get(2).getName());
    }
  }

  private static List<Column> nestedProfileColumns(String tableFqn) {
    Column address =
        column(tableFqn, "address", false)
            .withChildren(
                List.of(
                    column(tableFqn + ".address", "city", true).withProfile(profile("city")),
                    column(tableFqn + ".address", "zip", false)
                        .withProfile(profile("zip"))
                        .withChildren(
                            List.of(
                                column(tableFqn + ".address.zip", "code", false)
                                    .withProfile(profile("code"))))));
    Column contact =
        column(tableFqn, "contact", true)
            .withChildren(
                List.of(
                    column(tableFqn + ".contact", "email", false).withProfile(profile("email"))));
    return new ArrayList<>(
        List.of(
            address.withProfile(profile("address")),
            contact.withProfile(profile("contact")),
            column(tableFqn, "id", false).withProfile(profile("id"))));
  }

  @Test
  void singleColumnProfileMaskingSeesTagsOnAncestorColumns() {
    String tableFqn = "service.db.schema.orders";
    EntityReference owner = entityReference(Entity.USER, "owner");
    // city carries no tag itself; the struct it nests under is the only PII-tagged column
    Column address =
        column(tableFqn, "address", true)
            .withChildren(List.of(column(tableFqn + ".address", "city", false)));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false, true);

    List<Column> masked =
        PIIMasker.getSingleColumnProfile(
            List.of(owner),
            List.of(address),
            profiledCityColumn(tableFqn),
            authorizer,
            securityContext);
    assertNull(masked.getFirst().getProfile());
    assertEquals("city [MASKED]", masked.getFirst().getName());

    List<Column> untouched =
        PIIMasker.getSingleColumnProfile(
            List.of(owner),
            List.of(address),
            profiledCityColumn(tableFqn),
            authorizer,
            securityContext);
    assertNotNull(untouched.getFirst().getProfile());
    assertEquals("city", untouched.getFirst().getName());
  }

  private static Column profiledCityColumn(String tableFqn) {
    return column(tableFqn + ".address", "city", false).withProfile(profile("city"));
  }

  @Test
  void singleColumnProfileMaskingUnderAncestorCoversRequestedSubtree() {
    String tableFqn = "service.db.schema.orders";
    EntityReference owner = entityReference(Entity.USER, "owner");
    // address (tagged ancestor) > zip (requested struct, untagged) > code (profiled grandchild)
    // zip carries no tag itself; only the ancestor's tag covers its own nested child
    Column address =
        column(tableFqn, "address", true)
            .withChildren(
                List.of(
                    column(tableFqn + ".address", "zip", false)
                        .withProfile(profile("zip"))
                        .withChildren(
                            List.of(
                                column(tableFqn + ".address.zip", "code", false)
                                    .withProfile(profile("code"))))));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false, true);

    List<Column> masked =
        PIIMasker.getSingleColumnProfile(
            List.of(owner),
            List.of(address),
            profiledZipColumn(tableFqn),
            authorizer,
            securityContext);
    assertNull(masked.getFirst().getProfile());
    assertEquals("zip [MASKED]", masked.getFirst().getName());
    assertNull(masked.getFirst().getChildren().getFirst().getProfile());
    assertEquals("code [MASKED]", masked.getFirst().getChildren().getFirst().getName());

    List<Column> untouched =
        PIIMasker.getSingleColumnProfile(
            List.of(owner),
            List.of(address),
            profiledZipColumn(tableFqn),
            authorizer,
            securityContext);
    assertNotNull(untouched.getFirst().getProfile());
    assertEquals("zip", untouched.getFirst().getName());
    assertNotNull(untouched.getFirst().getChildren().getFirst().getProfile());
    assertEquals("code", untouched.getFirst().getChildren().getFirst().getName());
  }

  private static Column profiledZipColumn(String tableFqn) {
    return column(tableFqn + ".address", "zip", false)
        .withProfile(profile("zip"))
        .withChildren(
            List.of(column(tableFqn + ".address.zip", "code", false).withProfile(profile("code"))));
  }

  private static ColumnProfile profile(String name) {
    return new ColumnProfile().withName(name).withNullCount(1.0);
  }

  @Test
  void columnProfileMaskingReachesNestedColumnsThroughTagsOnThePath() {
    String tableFqn = "service.db.schema.orders";
    String nestedFqn = tableFqn + ".address.city";
    EntityReference owner = entityReference(Entity.USER, "owner");
    // The leaf carries the tag itself; the parent struct covers the nested fields beneath it
    Column address =
        column(tableFqn, "address", false)
            .withChildren(List.of(column(tableFqn + ".address", "city", true)));
    Column contact =
        column(tableFqn, "contact", true)
            .withChildren(List.of(column(tableFqn + ".contact", "email", false)));
    Table table = table(tableFqn, List.of(address, contact), false, List.of(owner));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false, true);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TABLE, tableFqn, "columns,tags,owners", Include.ALL))
          .thenReturn(table);
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TABLE, tableFqn, "columns,tags", Include.ALL))
          .thenReturn(table);

      List<ColumnProfile> profiles =
          List.of(new ColumnProfile().withName("city").withNullCount(1.0));

      List<ColumnProfile> masked =
          PIIMasker.getColumnProfile(nestedFqn, profiles, authorizer, securityContext);
      assertEquals(1, masked.size());
      assertNull(masked.getFirst().getName());
      assertNull(masked.getFirst().getNullCount());

      assertSame(
          profiles, PIIMasker.getColumnProfile(nestedFqn, profiles, authorizer, securityContext));

      ColumnProfile sensitiveProfile =
          new ColumnProfile().withName("address.city").withNullCount(1.0);
      ColumnProfile maskedProfile = PIIMasker.maskColumnProfile(tableFqn, sensitiveProfile);
      assertEquals("address.city", maskedProfile.getName());
      assertNull(maskedProfile.getNullCount());

      // The same walk reaches a tag on the parent struct above the profiled field
      ColumnProfile parentTaggedProfile =
          new ColumnProfile().withName("contact.email").withNullCount(1.0);
      ColumnProfile maskedViaParent = PIIMasker.maskColumnProfile(tableFqn, parentTaggedProfile);
      assertEquals("contact.email", maskedViaParent.getName());
      assertNull(maskedViaParent.getNullCount());
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
  void maskColumnProfileFailsClosedForProfileRowsWhoseColumnNoLongerResolves() {
    String tableFqn = "service.db.schema.orders";
    Table table =
        table(
            tableFqn,
            List.of(column(tableFqn, "email", true), column(tableFqn, "city", false)),
            false,
            List.of());

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TABLE, tableFqn, "columns,tags", Include.ALL))
          .thenReturn(table);

      // A profile row outliving its column must not come back with its statistics attached
      ColumnProfile dropped = new ColumnProfile().withName("phone").withNullCount(1.0);
      ColumnProfile masked = PIIMasker.maskColumnProfile(tableFqn, dropped);
      assertEquals("phone", masked.getName());
      assertNull(masked.getNullCount());

      ColumnProfile staleNested = new ColumnProfile().withName("address.zip").withNullCount(2.0);
      ColumnProfile maskedNested = PIIMasker.maskColumnProfile(tableFqn, staleNested);
      assertEquals("address.zip", maskedNested.getName());
      assertNull(maskedNested.getNullCount());
    }
  }

  @Test
  void maskColumnProfileCoversSensitiveLiteralColumnsShadowedByNestedPaths() {
    String tableFqn = "service.db.schema.orders";
    // A top-level column literally named address.city, and an untagged address struct with a city
    // field: the nested path walk would otherwise hide the sensitive literal column
    Column literal =
        new Column()
            .withName("address.city")
            .withFullyQualifiedName(tableFqn + ".\"address.city\"")
            .withTags(List.of(piiTag()));
    Column address =
        column(tableFqn, "address", false)
            .withChildren(List.of(column(tableFqn + ".address", "city", false)));
    Table table = table(tableFqn, List.of(literal, address), false, List.of());

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TABLE, tableFqn, "columns,tags", Include.ALL))
          .thenReturn(table);

      ColumnProfile profile = new ColumnProfile().withName("address.city").withNullCount(1.0);
      ColumnProfile masked = PIIMasker.maskColumnProfile(tableFqn, profile);
      assertEquals("address.city", masked.getName());
      assertNull(masked.getNullCount());

      // The same name on a table whose literal column is not sensitive stays untouched
      Column untaggedLiteral =
          new Column()
              .withName("address.city")
              .withFullyQualifiedName(tableFqn + ".\"address.city\"")
              .withTags(List.of());
      Table untaggedTable = table(tableFqn, List.of(untaggedLiteral, address), false, List.of());
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TABLE, tableFqn, "columns,tags", Include.ALL))
          .thenReturn(untaggedTable);
      ColumnProfile plainProfile = new ColumnProfile().withName("address.city").withNullCount(1.0);
      assertSame(plainProfile, PIIMasker.maskColumnProfile(tableFqn, plainProfile));
    }
  }

  @Test
  void getColumnProfileFailsClosedForStaleColumnFqns() {
    String tableFqn = "service.db.schema.orders";
    String staleFqn = tableFqn + ".phone";
    EntityReference owner = entityReference(Entity.USER, "owner");
    Table table =
        table(
            tableFqn,
            List.of(column(tableFqn, "email", true), column(tableFqn, "city", false)),
            false,
            List.of(owner));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false, true);

    List<ColumnProfile> profiles =
        List.of(new ColumnProfile().withName("phone").withNullCount(1.0));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TABLE, tableFqn, "columns,tags,owners", Include.ALL))
          .thenReturn(table);

      List<ColumnProfile> masked =
          PIIMasker.getColumnProfile(staleFqn, profiles, authorizer, securityContext);
      assertEquals(1, masked.size());
      assertNull(masked.getFirst().getName());
      assertNull(masked.getFirst().getNullCount());

      assertSame(
          profiles, PIIMasker.getColumnProfile(staleFqn, profiles, authorizer, securityContext));
    }
  }

  @Test
  void getColumnProfileResolvesNonNormalizedColumnFqnsAgainstTheRealColumn() {
    String tableFqn = "service.db.schema.orders";
    // Redundant quotes on the service segment: the table and the profile rows are looked up with
    // the normalized hash, so masking must resolve the path through the same normalization — a
    // character offset taken against the normalized table FQN would slice the raw string mid-word
    String quotedServiceFqn = "\"service\".db.schema.orders.city";
    EntityReference owner = entityReference(Entity.USER, "owner");
    Table table =
        table(
            tableFqn,
            List.of(column(tableFqn, "email", true), column(tableFqn, "city", false)),
            false,
            List.of(owner));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false, true);

    List<ColumnProfile> plainProfiles =
        List.of(new ColumnProfile().withName("city").withNullCount(1.0));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TABLE, tableFqn, "columns,tags,owners", Include.ALL))
          .thenReturn(table);

      // An untagged column arriving under a redundantly quoted FQN keeps its statistics
      List<ColumnProfile> unmasked =
          PIIMasker.getColumnProfile(quotedServiceFqn, plainProfiles, authorizer, securityContext);
      assertEquals(1, unmasked.size());
      assertEquals("city", unmasked.getFirst().getName());
      assertEquals(1.0, unmasked.getFirst().getNullCount());

      // The PII-tagged column next to it is still masked under the same quoted FQN
      List<ColumnProfile> piiProfiles =
          List.of(new ColumnProfile().withName("email").withNullCount(2.0));
      List<ColumnProfile> masked =
          PIIMasker.getColumnProfile(quotedServiceFqn, piiProfiles, authorizer, securityContext);
      assertEquals(1, masked.size());
      assertNull(masked.getFirst().getName());
      assertNull(masked.getFirst().getNullCount());

      assertSame(
          plainProfiles,
          PIIMasker.getColumnProfile(quotedServiceFqn, plainProfiles, authorizer, securityContext));
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
  void getTestCasesMasksNestedColumnCasesThroughTagsOnThePath() {
    String tableFqn = "service.db.schema.orders";
    EntityReference owner = entityReference(Entity.USER, "owner");
    // city carries the PII tag itself, contact carries it above the linked field
    Column address =
        column(tableFqn, "address", false)
            .withChildren(List.of(column(tableFqn + ".address", "city", true)));
    Column contact =
        column(tableFqn, "contact", true)
            .withChildren(List.of(column(tableFqn + ".contact", "email", false)));
    Table table = table(tableFqn, List.of(address, contact), false, List.of(owner));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    // authorizePII is consulted per test case: the unauthorized page asks twice, the authorized
    // page twice
    when(authorizer.authorizePII(securityContext, List.of(owner)))
        .thenReturn(false, false, true, true);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TABLE, tableFqn, "owners,tags,columns", Include.ALL))
          .thenReturn(table);

      ResultList<TestCase> unauthorized =
          PIIMasker.getTestCases(
              new ResultList<>(nestedCasesOn(tableFqn)), authorizer, securityContext);

      assertEquals("city_not_null [MASKED]", unauthorized.getData().get(0).getName());
      assertNull(unauthorized.getData().get(0).getParameterValues());
      assertNull(unauthorized.getData().get(0).getTestCaseResult());
      assertEquals("email_not_null [MASKED]", unauthorized.getData().get(1).getName());

      ResultList<TestCase> authorized =
          PIIMasker.getTestCases(
              new ResultList<>(nestedCasesOn(tableFqn)), authorizer, securityContext);

      assertEquals("city_not_null", authorized.getData().get(0).getName());
      assertEquals("email_not_null", authorized.getData().get(1).getName());
    }
  }

  private static List<TestCase> nestedCasesOn(String tableFqn) {
    TestCase cityCase =
        new TestCase()
            .withName("city_not_null")
            .withEntityLink(
                new MessageParser.EntityLink(
                        Entity.TABLE, tableFqn, "columns", "address.city", null)
                    .getLinkString())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withName("min").withValue("1")))
            .withTestCaseResult(new TestCaseResult());
    TestCase emailCase =
        new TestCase()
            .withName("email_not_null")
            .withEntityLink(
                new MessageParser.EntityLink(
                        Entity.TABLE, tableFqn, "columns", "contact.email", null)
                    .getLinkString());
    return new ArrayList<>(List.of(cityCase, emailCase));
  }

  @Test
  void getTestCasesTolerateTestCasesWhoseTableWasHardDeleted() {
    String liveFqn = "service.db.schema.orders";
    String orphanFqn = "service.db.schema.deleted_orders";
    EntityReference owner = entityReference(Entity.USER, "owner");
    Table live = table(liveFqn, List.of(column(liveFqn, "email", false)), false, List.of(owner));
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    when(authorizer.authorizePII(securityContext, null)).thenReturn(false);

    TestCase orphan =
        new TestCase()
            .withName("email_not_null")
            .withDescription("Should not leak sensitive details")
            .withEntityLink(
                new MessageParser.EntityLink(Entity.TABLE, orphanFqn, "columns", "email", null)
                    .getLinkString())
            .withParameterValues(
                List.of(new TestCaseParameterValue().withName("min").withValue("1")))
            .withTestCaseResult(new TestCaseResult());
    TestCase liveCase =
        new TestCase()
            .withName("row_count")
            .withEntityLink(new MessageParser.EntityLink(Entity.TABLE, liveFqn).getLinkString());
    ResultList<TestCase> testCases = new ResultList<>(new ArrayList<>(List.of(orphan, liveCase)));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TABLE, orphanFqn, "owners,tags,columns", Include.ALL))
          .thenThrow(new EntityNotFoundException("Entity not found: table " + orphanFqn));
      mockedEntity
          .when(
              () ->
                  Entity.getEntityByName(Entity.TABLE, liveFqn, "owners,tags,columns", Include.ALL))
          .thenReturn(live);

      ResultList<TestCase> masked = PIIMasker.getTestCases(testCases, authorizer, securityContext);

      // The orphan is masked rather than dropped or thrown on, and the rest of the page survives.
      assertEquals("email_not_null [MASKED]", masked.getData().get(0).getName());
      assertNull(masked.getData().get(0).getTestCaseResult());
      assertEquals("row_count", masked.getData().get(1).getName());
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
  void getQueriesHandlesNullTagsForUnauthorizedUsers() {
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);

    EntityReference owner = entityReference(Entity.USER, "owner");

    Query query = new Query().withQuery("select email from customer").withOwners(List.of(owner));

    query.setTags(null);

    ResultList<Query> queries = new ResultList<>(new ArrayList<>(List.of(query)));

    when(authorizer.authorizePII(securityContext, List.of(owner))).thenReturn(false);

    ResultList<Query> result = PIIMasker.getQueries(queries, authorizer, securityContext);

    assertEquals("select email from customer", result.getData().get(0).getQuery());
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

  private static SearchIndexField searchIndexField(
      String name, boolean pii, List<SearchIndexField> children) {
    SearchIndexField field = new SearchIndexField().withName(name).withFullyQualifiedName(name);
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
