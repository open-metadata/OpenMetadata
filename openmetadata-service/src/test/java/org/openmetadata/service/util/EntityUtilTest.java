package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.RoleRepository.DOMAIN_ONLY_ACCESS_ROLE;
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqn;
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqnSafe;

import jakarta.ws.rs.core.SecurityContext;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.schema.type.UsageStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.UsageDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.UsageDAO.UsageDetailsWithId;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class EntityUtilTest {
  @Test
  void test_isDescriptionRequired() {
    assertFalse(
        EntityUtil.isDescriptionRequired(Table.class)); // Table entity does not require description
    assertTrue(
        EntityUtil.isDescriptionRequired(
            GlossaryTerm.class)); // GlossaryTerm entity requires description
  }

  @Test
  void test_entityLinkParser() {

    // Valid entity links
    Map<String, String> expected = new HashMap<>();
    expected.put("entityLink", "<#E::table::users>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "users");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "users");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::users.foo.\"bar.baz\">");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "users.foo.\"bar.baz\"");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "users.foo.\"bar.baz\"");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::db::customers>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "customers");
    expected.put("entityType", "db");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "db");
    expected.put("fullyQualifiedFieldValue", "customers");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::users::column::id>");
    expected.put("arrayFieldName", "id");
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", "column");
    expected.put("entityFQN", "users");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY_ARRAY_FIELD");
    expected.put("fullyQualifiedFieldType", "table.column.member");
    expected.put("fullyQualifiedFieldValue", "users.id");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::orders::column::status::type::enum>");
    expected.put("arrayFieldName", "status");
    expected.put("arrayFieldValue", "type::enum");
    expected.put("fieldName", "column");
    expected.put("entityFQN", "orders");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY_ARRAY_FIELD");
    expected.put("fullyQualifiedFieldType", "table.column.member");
    expected.put("fullyQualifiedFieldValue", "orders.status.type::enum");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::db::schema::table::view::column>");
    expected.put("arrayFieldName", "view");
    expected.put("arrayFieldValue", "column");
    expected.put("fieldName", "table");
    expected.put("entityFQN", "schema");
    expected.put("entityType", "db");
    expected.put("linkType", "ENTITY_ARRAY_FIELD");
    expected.put("fullyQualifiedFieldType", "db.table.member");
    expected.put("fullyQualifiedFieldValue", "schema.view.column");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::foo@bar>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "foo@bar");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "foo@bar");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::foo[bar]>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "foo[bar]");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "foo[bar]");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::special!@#$%^&*()_+[]{};:\\'\",./?>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "special!@#$%^&*()_+[]{};:\\'\",./?");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "special!@#$%^&*()_+[]{};:\\'\",./?");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::special!@#$%^&*()_+[]{}|;\\'\",./?>");
    expected.put("entityType", "table");
    expected.put("entityFQN", "special!@#$%^&*()_+[]{}|;\\'\",./?");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "special!@#$%^&*()_+[]{}|;\\'\",./?");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::special!@:#$%^&*()_+[]{}|;\\'\",./?>");
    expected.put("entityType", "table");
    expected.put("entityFQN", "special!@:#$%^&*()_+[]{}|;\\'\",./?");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "special!@:#$%^&*()_+[]{}|;\\'\",./?");
    verifyEntityLinkParser(expected);
    expected.clear();

    expected.put("entityLink", "<#E::table::spec::>ial!@:#$%^&*()_+[]{}|;\\'\",./?>");

    org.opentest4j.AssertionFailedError exception =
        assertThrows(
            org.opentest4j.AssertionFailedError.class, () -> verifyEntityLinkParser(expected));
    assertEquals(
        "expected: <<#E::table::spec::>ial!@:#$%^&*()_+[]{}|;\\'\",./?>> but was: <<#E::table::spec::>>",
        exception.getMessage());

    expected.clear();
    expected.put("entityLink", "<#E::table::user<name>::column>");
    IllegalArgumentException argException =
        assertThrows(IllegalArgumentException.class, () -> verifyEntityLinkParser(expected));
    assertEquals(
        "Entity link was not found in <#E::table::user<name>::column>", argException.getMessage());

    expected.clear();
    expected.put("entityLink", "<#E::table::user>name::column>");
    exception =
        assertThrows(
            org.opentest4j.AssertionFailedError.class, () -> verifyEntityLinkParser(expected));
    assertEquals(
        "expected: <<#E::table::user>name::column>> but was: <<#E::table::user>>",
        exception.getMessage());

    expected.clear();
    expected.put("entityLink", "<#E::table::foo<>bar::baz>");
    argException =
        assertThrows(IllegalArgumentException.class, () -> verifyEntityLinkParser(expected));
    assertEquals(
        "Entity link was not found in <#E::table::foo<>bar::baz>", argException.getMessage());
  }

  void verifyEntityLinkParser(Map<String, String> expected) {
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(expected.get("entityLink"));
    assertEquals(expected.get("entityLink"), entityLink.getLinkString());
    assertEquals(expected.get("arrayFieldName"), entityLink.getArrayFieldName());
    assertEquals(expected.get("arrayFieldValue"), entityLink.getArrayFieldValue());
    assertEquals(expected.get("entityType"), entityLink.getEntityType());
    assertEquals(expected.get("fieldName"), entityLink.getFieldName());
    assertEquals(expected.get("entityFQN"), entityLink.getEntityFQN());
    assertEquals(expected.get("linkType"), entityLink.getLinkType().toString());
    assertEquals(expected.get("fullyQualifiedFieldType"), entityLink.getFullyQualifiedFieldType());
    assertEquals(
        expected.get("fullyQualifiedFieldValue"), entityLink.getFullyQualifiedFieldValue());
  }

  @Test
  void testFieldsAndRelationIncludesHelpers() {
    Set<String> allowedFields = Set.of("owners", "tags", "domains");

    EntityUtil.Fields fields = new EntityUtil.Fields(allowedFields, "owners, tags");
    assertTrue(fields.contains("owners"));
    assertTrue(fields.contains("tags"));
    assertFalse(fields.contains("domains"));

    fields.addField(allowedFields, "domains");
    assertTrue(fields.contains("domains"));

    EntityUtil.Fields excluded = EntityUtil.Fields.createWithExcludedFields(allowedFields, "tags");
    assertTrue(excluded.contains("owners"));
    assertFalse(excluded.contains("tags"));

    assertThrows(
        IllegalArgumentException.class,
        () -> new EntityUtil.Fields(allowedFields, "owners,missing"));

    EntityUtil.RelationIncludes relationIncludes =
        new EntityUtil.RelationIncludes(
            Include.NON_DELETED, "owners:all,followers:deleted,reviewers:non-deleted");
    assertEquals(Include.ALL, relationIncludes.getIncludeFor("owners"));
    assertEquals(Include.DELETED, relationIncludes.getIncludeFor("followers"));
    assertEquals(Include.NON_DELETED, relationIncludes.getIncludeFor("reviewers"));
    assertEquals(Include.NON_DELETED, relationIncludes.getIncludeFor("unknown"));
    assertTrue(relationIncludes.hasFieldSpecificInclude("owners"));
    assertFalse(relationIncludes.hasFieldSpecificInclude("unknown"));
    assertEquals(
        Include.DELETED,
        EntityUtil.RelationIncludes.fromInclude(Include.DELETED).getDefaultInclude());

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> new EntityUtil.RelationIncludes(Include.ALL, "owners:not-valid"));
    assertTrue(exception.getMessage().contains("Invalid include value"));
  }

  @Test
  void testVersionAndFieldNameHelpers() {
    Column column = new Column().withName("amount");
    Topic topic = new Topic().withFullyQualifiedName("service.topic");
    Field schemaField = new Field().withFullyQualifiedName("service.topic.user.id");
    APIEndpoint apiEndpoint = new APIEndpoint().withFullyQualifiedName("service.api");
    Field apiField = new Field().withFullyQualifiedName("service.api.request.body");
    SearchIndex searchIndex = new SearchIndex().withFullyQualifiedName("service.search");
    SearchIndexField searchIndexField =
        new SearchIndexField().withFullyQualifiedName("service.search.keyword.raw");
    Rule rule = new Rule().withName("maskPII");
    CustomProperty property = new CustomProperty().withName("retention");

    assertEquals("table.version", EntityUtil.getVersionExtensionPrefix("table"));
    assertEquals("table.version.1.2", EntityUtil.getVersionExtension("table", 1.2));
    assertEquals(1.2, EntityUtil.getVersion("table.version.1.2"));
    assertEquals(
        "address.city",
        EntityUtil.getLocalColumnName("service.db.table", "service.db.table.address.city"));
    assertEquals("owners.tags", EntityUtil.getFieldName("owners", "tags"));
    assertEquals("columns.amount.description", EntityUtil.getColumnField(column, "description"));
    assertEquals(
        "schemaFields.\"user.id\".description",
        EntityUtil.getSchemaField(topic, schemaField, "description"));
    assertEquals(
        "schemaFields.\"request.body\".description",
        EntityUtil.getSchemaField(apiEndpoint, apiField, "description"));
    assertEquals(
        "fields.\"keyword.raw\".alias",
        EntityUtil.getSearchIndexField(searchIndex, searchIndexField, "alias"));
    assertEquals("rules.maskPII.effect", EntityUtil.getRuleField(rule, "effect"));
    assertEquals("customProperties.retention", EntityUtil.getCustomField(property, null));
    assertEquals("extension.\"config.timeout\"", EntityUtil.getExtensionField("config.timeout"));
    assertEquals(1.1, EntityUtil.previousVersion(1.2));
    assertEquals(1.3, EntityUtil.nextVersion(1.2));
    assertEquals(2.2, EntityUtil.nextMajorVersion(1.2));
  }

  @Test
  void testTagLabelChangeDescriptionAndOperationHelpers() {
    GlossaryTerm term =
        new GlossaryTerm()
            .withName("PII")
            .withDisplayName("Sensitive")
            .withDescription("Personal data")
            .withFullyQualifiedName("Glossary.PII");
    Tag tag =
        new Tag()
            .withName("Tier1")
            .withDisplayName("Tier 1")
            .withDescription("High priority")
            .withFullyQualifiedName("Tier.Tier1");
    ChangeDescription change =
        new ChangeDescription()
            .withFieldsAdded(new ArrayList<>())
            .withFieldsDeleted(new ArrayList<>())
            .withFieldsUpdated(new ArrayList<>());
    @SuppressWarnings("unchecked")
    ResourceContext<Table> createContext = mock(ResourceContext.class);
    @SuppressWarnings("unchecked")
    ResourceContext<Table> updateContext = mock(ResourceContext.class);

    List<TagLabel> termLabels = EntityUtil.toTagLabels(term);
    List<TagLabel> tagLabels = EntityUtil.toTagLabels(tag);
    assertEquals(TagLabel.TagSource.GLOSSARY, termLabels.get(0).getSource());
    assertEquals("Glossary.PII", termLabels.get(0).getTagFQN());
    assertEquals(TagLabel.TagSource.CLASSIFICATION, tagLabels.get(0).getSource());
    assertEquals("Tier.Tier1", tagLabels.get(0).getTagFQN());

    assertEquals("owners", EntityUtil.addField(null, "owners"));
    assertEquals("owners, tags", EntityUtil.addField("owners", "tags"));

    EntityUtil.fieldAdded(change, "owners", "alice");
    EntityUtil.fieldDeleted(change, "reviewers", "bob");
    EntityUtil.fieldUpdated(change, "description", "before", "after");
    EntityUtil.fieldAdded(null, "ignored", "value");

    assertEquals("owners", change.getFieldsAdded().get(0).getName());
    assertEquals("alice", change.getFieldsAdded().get(0).getNewValue());
    assertEquals("reviewers", change.getFieldsDeleted().get(0).getName());
    assertEquals("bob", change.getFieldsDeleted().get(0).getOldValue());
    assertEquals("description", change.getFieldsUpdated().get(0).getName());
    assertEquals("after", change.getFieldsUpdated().get(0).getNewValue());

    when(createContext.getEntity()).thenReturn(null);
    when(updateContext.getEntity()).thenReturn(new Table());
    assertEquals(MetadataOperation.CREATE, EntityUtil.createOrUpdateOperation(createContext));
    assertEquals(MetadataOperation.EDIT_ALL, EntityUtil.createOrUpdateOperation(updateContext));

    assertFalse(EntityUtil.isNullOrEmptyChangeDescription(change));
    assertTrue(
        EntityUtil.isNullOrEmptyChangeDescription(
            new ChangeDescription()
                .withFieldsAdded(new ArrayList<>())
                .withFieldsDeleted(new ArrayList<>())
                .withFieldsUpdated(new ArrayList<>())));
  }

  @Test
  void testReferenceAndCollectionHelpers() {
    UUID id1 = UUID.randomUUID();
    UUID id2 = UUID.randomUUID();
    EntityReference ref1 =
        new EntityReference().withId(id1).withType("table").withFullyQualifiedName("service.a");
    EntityReference ref2 =
        new EntityReference().withId(id2).withType("table").withFullyQualifiedName("service.b");
    EntityReference duplicateRef1 =
        new EntityReference().withId(id1).withType("table").withFullyQualifiedName("service.a");
    Table tableA = new Table().withId(id1).withName("a").withFullyQualifiedName("service.a");
    Table tableB = new Table().withId(id2).withName("b").withFullyQualifiedName("service.b");
    List<Table> tables = new ArrayList<>(List.of(tableB, tableA));

    assertEquals(id1, EntityUtil.getId(ref1));
    assertNull(EntityUtil.getId(null));
    assertEquals("service.a", EntityUtil.getFqn(ref1));
    assertEquals("service.a", EntityUtil.getFqn(tableA));
    assertNull(EntityUtil.getFqn((EntityReference) null));
    assertEquals("service.a", EntityUtil.getEntityReference(tableA).getFullyQualifiedName());
    assertEquals("table", EntityUtil.getEntityReference("table", "service.a").getType());
    assertEquals("<#E::table::service.a>", EntityUtil.buildEntityLink("table", "service.a"));

    EntityUtil.sortByFQN(tables);
    assertEquals(List.of("service.a", "service.b"), EntityUtil.toFQNs(tables));
    assertEquals(List.of(id1, id2), EntityUtil.strToIds(List.of(id1.toString(), id2.toString())));

    List<EntityReference> references = EntityUtil.toEntityReferences(List.of(id1, id2), "table");
    assertEquals(List.of(id1, id2), EntityUtil.refToIds(references));
    assertEquals(List.of("service.a", "service.b"), EntityUtil.getFqns(List.of(ref1, ref2)));

    EntityReference copied = new EntityReference();
    EntityUtil.copy(ref1, copied);
    assertEquals(ref1.getFullyQualifiedName(), copied.getFullyQualifiedName());

    List<EntityReference> merged =
        EntityUtil.mergedInheritedEntityRefs(List.of(ref1), List.of(duplicateRef1, ref2));
    assertEquals(2, merged.size());
    assertTrue(
        merged.stream()
            .filter(ref -> id2.equals(ref.getId()))
            .findFirst()
            .orElseThrow()
            .getInherited());
    assertEquals(
        "'" + id1 + "','" + id2 + "'",
        EntityUtil.getCommaSeparatedIdsFromRefs(List.of(ref1, ref2)));
  }

  @Test
  void testMatcherHelpers() {
    UUID refId = UUID.randomUUID();
    EntityReference ref1 = new EntityReference().withId(refId).withType("table");
    EntityReference ref2 = new EntityReference().withId(refId).withType("table");
    EntityReference differentRef =
        new EntityReference().withId(UUID.randomUUID()).withType("topic");
    Column column = new Column().withName("amount");
    Column sameColumn = new Column().withName("AMOUNT");
    Column differentColumn = new Column().withName("count");
    TableConstraint constraint =
        new TableConstraint().withColumns(List.of("id")).withReferredColumns(List.of("pk"));
    TableConstraint sameConstraint =
        new TableConstraint().withColumns(List.of("id")).withReferredColumns(List.of("pk"));
    GlossaryTerm term = new GlossaryTerm().withFullyQualifiedName("Glossary.PII");
    TermReference termReference =
        new TermReference().withName("PII").withEndpoint(URI.create("https://example.com"));
    EntityReference propertyType = new EntityReference().withId(UUID.randomUUID()).withType("type");
    CustomProperty customProperty =
        new CustomProperty().withName("retention").withPropertyType(propertyType);
    Field schemaField = new Field().withName("user.id");
    SearchIndexField searchField = new SearchIndexField().withName("keyword.raw");
    List<EntityReference> refsWithNull = new ArrayList<>();
    refsWithNull.add(ref1);
    refsWithNull.add(null);

    assertTrue(EntityUtil.entityReferenceMatch.test(ref1, ref2));
    assertFalse(EntityUtil.entityReferenceMatch.test(ref1, differentRef));
    assertTrue(EntityUtil.entityReferenceListMatch.test(null, null));
    assertTrue(EntityUtil.entityReferenceListMatch.test(List.of(ref1), List.of(ref2)));
    assertFalse(
        EntityUtil.entityReferenceListMatch.test(List.of(ref1), List.of(ref2, differentRef)));
    assertFalse(EntityUtil.entityReferenceListMatch.test(refsWithNull, List.of(ref2, ref1)));
    assertTrue(
        EntityUtil.taskMatch.test(new Task().withName("approve"), new Task().withName("approve")));
    assertTrue(EntityUtil.columnMatch.test(column, sameColumn));
    assertFalse(EntityUtil.columnMatch.test(column, differentColumn));
    assertTrue(EntityUtil.columnNameMatch.test(column, sameColumn));
    assertTrue(EntityUtil.tableConstraintMatch.test(constraint, sameConstraint));
    assertFalse(
        EntityUtil.tableConstraintMatch.test(
            constraint, new TableConstraint().withColumns(List.of("other"))));
    assertTrue(
        EntityUtil.glossaryTermMatch.test(
            term, new GlossaryTerm().withFullyQualifiedName("Glossary.PII")));
    assertTrue(
        EntityUtil.termReferenceMatch.test(
            termReference,
            new TermReference().withName("PII").withEndpoint(URI.create("https://example.com"))));
    assertTrue(
        EntityUtil.customFieldMatch.test(
            customProperty,
            new CustomProperty().withName("retention").withPropertyType(propertyType)));
    assertTrue(
        EntityUtil.ruleMatch.test(new Rule().withName("maskPII"), new Rule().withName("maskPII")));
    assertTrue(EntityUtil.schemaFieldMatch.test(schemaField, new Field().withName("USER.ID")));
    assertTrue(
        EntityUtil.searchIndexFieldMatch.test(
            searchField, new SearchIndexField().withName("KEYWORD.RAW")));
  }

  @Test
  void testEntityReferencePopulationAndValidationHelpers() {
    UUID tableId = UUID.randomUUID();
    UUID teamId = UUID.randomUUID();
    EntityReference unresolvedById = new EntityReference().withId(tableId).withType("table");
    EntityReference validationRef = new EntityReference().withId(tableId).withType("table");
    EntityReference unresolvedByName =
        new EntityReference().withType("team").withFullyQualifiedName("analytics");
    EntityReference resolvedTable =
        new EntityReference()
            .withId(tableId)
            .withType("table")
            .withName("orders")
            .withFullyQualifiedName("service.orders");
    EntityReference resolvedTeam =
        new EntityReference()
            .withId(teamId)
            .withType("team")
            .withName("analytics")
            .withFullyQualifiedName("analytics");
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse("<#E::table::service.orders>");

    try (MockedStatic<Entity> entity = org.mockito.Mockito.mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityReferencesByIds("table", List.of(tableId), Include.ALL))
          .thenReturn(List.of(resolvedTable));
      entity
          .when(() -> Entity.getEntityReferenceByName("team", "analytics", Include.ALL))
          .thenReturn(resolvedTeam);
      entity
          .when(() -> Entity.getEntityReference(unresolvedById, Include.ALL))
          .thenReturn(resolvedTable);
      entity
          .when(() -> Entity.getEntityReference(validationRef, Include.ALL))
          .thenReturn(resolvedTable);
      entity
          .when(() -> Entity.getEntityReferenceById("table", tableId, Include.ALL))
          .thenReturn(resolvedTable);
      entity
          .when(() -> Entity.getEntityReferenceByName("table", "service.orders", Include.ALL))
          .thenReturn(resolvedTable);

      List<EntityReference> populated =
          EntityUtil.populateEntityReferences(List.of(unresolvedByName, unresolvedById));
      assertEquals(
          List.of("analytics", "orders"),
          populated.stream().map(EntityReference::getName).toList());

      List<EntityReference> validated =
          EntityUtil.validateAndPopulateEntityReferences(new ArrayList<>(List.of(validationRef)));
      assertEquals("orders", validated.get(0).getName());
      assertEquals(
          "orders",
          EntityUtil.populateEntityReferencesById(List.of(tableId), "table").get(0).getName());
      assertEquals("orders", EntityUtil.validateEntityLink(entityLink).getName());
      assertEquals(
          "orders",
          EntityUtil.validateToEntityReferences(List.of(tableId), "table").get(0).getName());
    }
  }

  @Test
  void testEntityReferenceFallbackUsageAndFilteringHelpers() {
    UUID validId = UUID.randomUUID();
    UUID missingId = UUID.randomUUID();
    EntityReference validRef = new EntityReference().withId(validId).withType("table");
    EntityReference missingRef = new EntityReference().withId(missingId).withType("table");
    EntityReference resolvedValidRef =
        new EntityReference()
            .withId(validId)
            .withType("table")
            .withName("orders")
            .withFullyQualifiedName("service.orders");
    CollectionDAO.EntityRelationshipRecord validRecord =
        CollectionDAO.EntityRelationshipRecord.builder().id(validId).type("table").build();
    CollectionDAO.EntityRelationshipRecord missingRecord =
        CollectionDAO.EntityRelationshipRecord.builder().id(missingId).type("table").build();
    UsageDAO usageDAO = mock(UsageDAO.class);
    @SuppressWarnings("unchecked")
    EntityRepository<Table> repository = mock(EntityRepository.class);
    UsageDetails storedUsage =
        new UsageDetails()
            .withDate("2026-03-09")
            .withDailyStats(new UsageStats().withCount(5).withPercentileRank(0.5))
            .withWeeklyStats(new UsageStats().withCount(8).withPercentileRank(0.6))
            .withMonthlyStats(new UsageStats().withCount(13).withPercentileRank(0.7));

    when(usageDAO.getLatestUsage(validId.toString())).thenReturn(storedUsage);
    when(usageDAO.getLatestUsage(missingId.toString())).thenReturn(null);
    when(usageDAO.getLatestUsageBatch(List.of(validId.toString(), missingId.toString())))
        .thenReturn(List.of(new UsageDetailsWithId(validId.toString(), storedUsage)));
    when(repository.getAllowedFields()).thenReturn(Set.of("description", "displayName"));

    try (MockedStatic<Entity> entity = org.mockito.Mockito.mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      "table", List.of(validId, missingId), Include.ALL))
          .thenThrow(new RuntimeException("batch failed"));
      entity
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      "table", List.of(missingId, validId), Include.ALL))
          .thenThrow(new RuntimeException("batch failed"));
      entity
          .when(() -> Entity.getEntityReference(validRef, Include.ALL))
          .thenReturn(resolvedValidRef);
      entity
          .when(() -> Entity.getEntityReference(missingRef, Include.ALL))
          .thenThrow(EntityNotFoundException.byMessage("missing"));
      entity
          .when(() -> Entity.getEntityReferenceById("table", validId, Include.ALL))
          .thenReturn(resolvedValidRef);
      entity
          .when(() -> Entity.getEntityReferenceById("table", missingId, Include.ALL))
          .thenThrow(EntityNotFoundException.byMessage("missing"));
      entity.when(() -> Entity.getEntityRepository("table")).thenReturn(repository);

      List<EntityReference> populated =
          EntityUtil.populateEntityReferences(List.of(missingRef, validRef));
      assertEquals(List.of("orders"), populated.stream().map(EntityReference::getName).toList());

      List<EntityReference> relationshipRefs =
          EntityUtil.getEntityReferences(List.of(validRecord, missingRecord));
      assertEquals(
          List.of("orders"), relationshipRefs.stream().map(EntityReference::getName).toList());

      UsageDetails latestUsage = EntityUtil.getLatestUsage(usageDAO, validId);
      assertSame(storedUsage, latestUsage);
      assertEquals(0, EntityUtil.getLatestUsage(usageDAO, missingId).getDailyStats().getCount());
      assertTrue(EntityUtil.getLatestUsageForEntities(usageDAO, List.of()).isEmpty());

      Map<UUID, UsageDetails> usageMap =
          EntityUtil.getLatestUsageForEntities(usageDAO, List.of(validId, missingId));
      assertSame(storedUsage, usageMap.get(validId));
      assertEquals(0, usageMap.get(missingId).getDailyStats().getCount());

      List<TagLabel> tags =
          new ArrayList<>(
              List.of(
                  new TagLabel()
                      .withTagFQN("Tier.Tier1")
                      .withSource(TagLabel.TagSource.CLASSIFICATION)));
      EntityUtil.mergeTags(
          tags,
          List.of(
              new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION),
              new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.GLOSSARY)));
      assertEquals(2, tags.size());

      assertEquals(
          "description,owners,domains",
          EntityUtil.getFilteredFields("table", "description,owners,domains,missing"));
    }
  }

  @Test
  void testValidationReferenceLookupAndResourceHelpers() {
    UUID id = UUID.randomUUID();
    EntityReference resolved =
        new EntityReference().withId(id).withType("table").withName("orders");
    List<EntityReference> refs = List.of(new EntityReference().withId(id).withType("table"));

    EntityReference validated =
        EntityUtil.validate(
            id, "{\"id\":\"" + id + "\",\"type\":\"table\"}", EntityReference.class);
    assertEquals(id, validated.getId());
    assertThrows(
        EntityNotFoundException.class, () -> EntityUtil.validate(id, null, EntityReference.class));
    assertTrue(
        assertDoesNotThrow(() -> EntityUtil.getJsonDataResources(".*logback\\.xml")).stream()
            .anyMatch(resource -> resource.endsWith("logback.xml")));
    assertEquals(List.of(), EntityUtil.toFQNs(null));
    assertNull(EntityUtil.toEntityReferences(null, "table"));
    assertNull(EntityUtil.refToIds(null));
    assertNull(EntityUtil.getFqns(null));
    assertNull(EntityUtil.getEntityReference(null));
    assertNull(EntityUtil.getEntityReference("table", null));
    assertNull(EntityUtil.getEntityReferenceByName("table", null));
    assertNull(EntityUtil.getEntityReferences("table", null));
    assertNull(EntityUtil.getEntityReferencesById("table", null));
    assertNull(EntityUtil.validateToEntityReferences(null, "table"));
    assertNull(EntityUtil.getFqn((Table) null));
    assertFalse(EntityUtil.isDescriptionRequired(NoDescriptionEntity.class));
    assertTrue(EntityUtil.isNullOrEmptyChangeDescription(null));

    try (MockedStatic<Entity> entity = org.mockito.Mockito.mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityReferenceByName("table", "service.orders", Include.ALL))
          .thenReturn(resolved);
      entity
          .when(
              () -> Entity.getEntityReferenceByName("table", "service.orders", Include.NON_DELETED))
          .thenReturn(resolved);
      entity
          .when(() -> Entity.getEntityReferenceById("table", id, Include.NON_DELETED))
          .thenReturn(resolved);
      entity
          .when(() -> Entity.getEntityReference(refs.get(0), Include.NON_DELETED))
          .thenReturn(resolved);

      assertEquals(
          "orders", EntityUtil.getEntityReferenceByName("table", "service.orders").getName());
      assertEquals(
          "orders",
          EntityUtil.getEntityReferences("table", List.of("service.orders")).get(0).getName());
      assertEquals(
          "orders", EntityUtil.getEntityReferencesById("table", List.of(id)).get(0).getName());
      assertEquals(
          "orders", EntityUtil.getEntityReferences(refs, Include.NON_DELETED).get(0).getName());
      assertEquals(List.of(), EntityUtil.getEntityReferences(List.of(), Include.ALL));
    }
  }

  @Test
  void testEntityReferencePopulationKeepsFirstDuplicateBatchMatch() {
    UUID id = UUID.randomUUID();
    EntityReference unresolved = new EntityReference().withId(id).withType("table");
    EntityReference firstResolved =
        new EntityReference().withId(id).withType("table").withName("orders");
    EntityReference duplicateResolved =
        new EntityReference().withId(id).withType("table").withName("orders-duplicate");

    try (MockedStatic<Entity> entity = org.mockito.Mockito.mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityReferencesByIds("table", List.of(id), Include.ALL))
          .thenReturn(List.of(firstResolved, duplicateResolved));

      List<EntityReference> populated = EntityUtil.populateEntityReferences(List.of(unresolved));
      assertEquals("orders", populated.get(0).getName());
    }
  }

  @Test
  void testColumnFlattenHashAndTaskHelpers() {
    Column nestedColumn =
        new Column().withName("city").withFullyQualifiedName("service.db.table.address.city");
    Column parentColumn =
        new Column()
            .withName("address")
            .withFullyQualifiedName("service.db.table.address")
            .withChildren(List.of(nestedColumn));
    Column leafColumn =
        new Column().withName("amount").withFullyQualifiedName("service.db.table.amount");
    Table table =
        new Table()
            .withColumns(List.of(parentColumn, leafColumn))
            .withFullyQualifiedName("service.db.table");

    assertEquals(leafColumn, EntityUtil.getColumn(table, "amount"));
    assertNull(EntityUtil.getColumn(table, "missing"));
    assertEquals(leafColumn, EntityUtil.findColumn(table.getColumns(), "amount"));
    assertThrows(
        IllegalArgumentException.class, () -> EntityUtil.findColumn(table.getColumns(), "missing"));
    assertEquals(
        nestedColumn,
        EntityUtil.findColumnWithChildren(table.getColumns(), "service.db.table.address.city"));
    assertThrows(
        IllegalArgumentException.class,
        () -> EntityUtil.findColumnWithChildren(table.getColumns(), "service.db.table.unknown"));
    assertEquals(
        List.of(parentColumn, nestedColumn, leafColumn),
        EntityUtil.getFlattenedEntityField(table.getColumns()));

    assertDoesNotThrow(() -> EntityUtil.validateProfileSample("ROWS", 1000.0));
    assertDoesNotThrow(() -> EntityUtil.validateProfileSample("PERCENTAGE", 50.0));
    assertThrows(
        IllegalArgumentException.class,
        () -> EntityUtil.validateProfileSample("PERCENTAGE", 150.0));
    assertEquals("900150983cd24fb0d6963f7d28e17f72", EntityUtil.hash("abc"));
    assertNull(EntityUtil.hash(null));
    assertEquals("service.db.table", EntityUtil.getEntityField(table, "fullyQualifiedName"));
    assertNull(EntityUtil.getEntityField(table, "missingField"));
    assertNull(EntityUtil.getEntityField(null, "fullyQualifiedName"));
    assertNull(EntityUtil.getEntityField(table, ""));
    assertNull(EntityUtil.getEntityField(new ThrowingFieldTable(), "brokenField"));

    assertTrue(EntityUtil.isDescriptionTask(TaskType.RequestDescription));
    assertTrue(EntityUtil.isDescriptionTask(TaskType.UpdateDescription));
    assertFalse(EntityUtil.isDescriptionTask(TaskType.RequestTag));
    assertTrue(EntityUtil.isTagTask(TaskType.RequestTag));
    assertTrue(EntityUtil.isTagTask(TaskType.UpdateTag));
    assertFalse(EntityUtil.isTagTask(TaskType.RequestApproval));
    assertTrue(EntityUtil.isApprovalTask(TaskType.RequestApproval));
    assertFalse(EntityUtil.isApprovalTask(TaskType.RequestTag));
    assertTrue(
        EntityUtil.isTestCaseFailureResolutionTask(TaskType.RequestTestCaseFailureResolution));
    assertFalse(EntityUtil.isTestCaseFailureResolutionTask(TaskType.RequestApproval));
  }

  @Test
  void testFieldBuilderAndDomainQueryHelpers() {
    Column column = new Column().withName("amount");
    Topic topic = new Topic().withFullyQualifiedName("service.topic");
    Field schemaField = new Field().withFullyQualifiedName("service.topic.user.id");
    APIEndpoint apiEndpoint = new APIEndpoint().withFullyQualifiedName("service.api");
    Field apiField = new Field().withFullyQualifiedName("service.api.request.body");
    SearchIndex searchIndex = new SearchIndex().withFullyQualifiedName("service.search");
    SearchIndexField searchField =
        new SearchIndexField().withFullyQualifiedName("service.search.keyword.raw");
    Rule rule = new Rule().withName("maskPII");
    CustomProperty property = new CustomProperty().withName("retention");
    EntityReference domainRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("domain")
            .withFullyQualifiedName("Finance");
    EntityReference domainRole =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("role")
            .withName(DOMAIN_ONLY_ACCESS_ROLE);
    SecurityContext securityContext = mock(SecurityContext.class);

    assertEquals("columns.amount", EntityUtil.getColumnField(column, null));
    assertEquals("schemaFields.\"user.id\"", EntityUtil.getSchemaField(topic, schemaField, null));
    assertEquals(
        "schemaFields.\"request.body\"", EntityUtil.getSchemaField(apiEndpoint, apiField, null));
    assertEquals(
        "fields.\"keyword.raw\"", EntityUtil.getSearchIndexField(searchIndex, searchField, null));
    assertEquals("rules.maskPII", EntityUtil.getRuleField(rule, null));
    assertEquals("customProperties.retention.value", EntityUtil.getCustomField(property, "value"));

    try (MockedStatic<DefaultAuthorizer> authorizer =
        org.mockito.Mockito.mockStatic(DefaultAuthorizer.class)) {
      ListFilter unrestrictedFilter = new ListFilter();
      ListFilter domainFilter = new ListFilter();
      ListFilter noDomainFilter = new ListFilter();

      authorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(
              new SubjectContext(
                  new org.openmetadata.schema.entity.teams.User()
                      .withName("admin")
                      .withIsAdmin(true),
                  null))
          .thenReturn(
              new SubjectContext(
                  new org.openmetadata.schema.entity.teams.User()
                      .withName("analyst")
                      .withRoles(List.of(domainRole))
                      .withDomains(List.of(domainRef)),
                  null))
          .thenReturn(
              new SubjectContext(
                  new org.openmetadata.schema.entity.teams.User()
                      .withName("analyst-no-domain")
                      .withRoles(List.of(domainRole)),
                  null));

      EntityUtil.addDomainQueryParam(securityContext, unrestrictedFilter, "table");
      EntityUtil.addDomainQueryParam(securityContext, domainFilter, "table");
      EntityUtil.addDomainQueryParam(securityContext, noDomainFilter, "table");

      assertTrue(unrestrictedFilter.getQueryParams().isEmpty());
      assertEquals("'" + domainRef.getId() + "'", domainFilter.getQueryParam("domainId"));
      assertEquals("true", domainFilter.getQueryParam("domainAccessControl"));
      assertEquals("null", noDomainFilter.getQueryParam("domainId"));
      assertEquals("table", noDomainFilter.getQueryParam("entityType"));
    }
  }

  private static class NoDescriptionEntity {}

  private static class ThrowingFieldTable extends Table {
    public String getBrokenField() {
      throw new IllegalStateException("boom");
    }
  }

  // URL Encoding Tests for Slack Event Fix

  @Test
  void testEncodeEntityFqnSafe_NullAndEmpty() {
    // Test null input
    assertEquals("", encodeEntityFqnSafe(null));

    // Test empty input
    assertEquals("", encodeEntityFqnSafe(""));

    // Test whitespace only
    assertEquals("", encodeEntityFqnSafe("   "));
  }

  @Test
  void testEncodeEntityFqnSafe_SimpleNames() {
    // Test simple names without special characters
    assertEquals("simple", encodeEntityFqnSafe("simple"));
    assertEquals("database.table", encodeEntityFqnSafe("database.table"));
    assertEquals(
        "service.database.schema.table", encodeEntityFqnSafe("service.database.schema.table"));
  }

  @ParameterizedTest
  @CsvSource({
    "'hello world', 'hello%20world'",
    "'test#hash', 'test%23hash'",
    "'query?param', 'query%3Fparam'",
    "'data&info', 'data%26info'",
    "'value+plus', 'value%2Bplus'",
    "'key=value', 'key%3Dvalue'",
    "'path/to/resource', 'path%2Fto%2Fresource'",
    "'back\\slash', 'back%5Cslash'",
    "'pipe|separated', 'pipe%7Cseparated'",
    "'\"quoted\"', '%22quoted%22'",
    "'''single''', '%27single%27'",
    "'<tag>', '%3Ctag%3E'",
    "'[bracket]', '%5Bbracket%5D'",
    "'{brace}', '%7Bbrace%7D'"
  })
  void testEncodeEntityFqnSafe_SpecialCharacters(String input, String expected) {
    assertEquals(expected, encodeEntityFqnSafe(input));
  }

  @Test
  void testEncodeEntityFqnSafe_ComplexFqn() {
    // Test complex FQN with spaces and special characters (similar to Databricks example)
    String complexFqn = "Random.pro.silver.l0_purchase_order.TOs con curr INR tery dd ser INR";
    String encoded = encodeEntityFqnSafe(complexFqn);

    // Verify spaces are encoded
    assertTrue(encoded.contains("%20"));

    // Verify the encoded string doesn't contain unencoded spaces
    assertFalse(encoded.contains(" "));

    // Verify the result
    assertEquals(
        "Random.pro.silver.l0_purchase_order.TOs%20con%20curr%20INR%20tery%20dd%20ser%20INR",
        encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_AvoidDoubleEncoding() {
    // Test that already encoded percent signs are handled correctly
    String inputWithPercent = "test%already%encoded";
    String encoded = encodeEntityFqnSafe(inputWithPercent);

    // The percent signs should be encoded to %25
    assertEquals("test%25already%25encoded", encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_PreservesRegularCharacters() {
    // Test that alphanumeric characters and dots are preserved
    String regularFqn = "service123.database_name.schema-name.table.column";
    assertEquals(regularFqn, encodeEntityFqnSafe(regularFqn));
  }

  @Test
  void testEncodeEntityFqnSafe_MixedContent() {
    // Test mixed content with various special characters
    String mixed = "Test Table & Data #1 with (special) chars?";
    String encoded = encodeEntityFqnSafe(mixed);
    String expected = "Test%20Table%20%26%20Data%20%231%20with%20(special)%20chars%3F";
    assertEquals(expected, encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_CompareWithOriginal() {
    // Compare the new safe encoding with the original encoding method
    String testFqn = "Databricks.pro.silver.table with spaces";

    String originalEncoding = encodeEntityFqn(testFqn);
    String safeEncoding = encodeEntityFqnSafe(testFqn);

    // Both should handle spaces, but safe encoding should be more conservative
    assertTrue(originalEncoding.contains("%20"));
    assertTrue(safeEncoding.contains("%20"));

    // Safe encoding should not contain plus signs (which can cause issues)
    assertFalse(safeEncoding.contains("+"));
  }

  @Test
  void testEncodeEntityFqnSafe_EmailSecurityCompatibility() {
    // Test FQNs that would be problematic with email security systems
    String problematicFqn = "Table Name & Data #1 + Test?param=value";
    String encoded = encodeEntityFqnSafe(problematicFqn);

    // Verify all problematic characters are encoded
    assertFalse(encoded.contains(" ")); // spaces
    assertFalse(encoded.contains("&")); // ampersand
    assertFalse(encoded.contains("#")); // hash
    assertFalse(encoded.contains("?")); // question mark
    assertFalse(encoded.contains("=")); // equals
    assertFalse(encoded.contains("+")); // plus

    String expected = "Table%20Name%20%26%20Data%20%231%20%2B%20Test%3Fparam%3Dvalue";
    assertEquals(expected, encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_WhitespaceHandling() {
    // Test various whitespace scenarios
    assertEquals("test%20name", encodeEntityFqnSafe("test name"));
    assertEquals("test%20%20double", encodeEntityFqnSafe("test  double"));
    assertEquals("leading%20space", encodeEntityFqnSafe(" leading space"));
    assertEquals("trailing%20space", encodeEntityFqnSafe("trailing space "));
  }

  @Test
  void testEncodeEntityFqnSafe_UnicodeCharacters() {
    // Test that regular Unicode characters are preserved
    String unicodeFqn = "测试.データ.тест";
    assertEquals(unicodeFqn, encodeEntityFqnSafe(unicodeFqn));
  }
}
