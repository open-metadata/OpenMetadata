package org.openmetadata.service.migration.utils.v160;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.TableRepository;

class MigrationUtilTest {
  private static final String TABLE_CONSTRAINT_FETCH_MY_SQL =
      "SELECT id, json FROM table_entity "
          + "WHERE JSON_LENGTH(JSON_EXTRACT(json, '$.tableConstraints')) > 0 "
          + "AND JSON_LENGTH(JSON_EXTRACT(json, '$.tableConstraints[*].referredColumns')) > 0 "
          + "LIMIT :limit OFFSET :offset";
  private static final String TABLE_CONSTRAINT_FETCH_POSTGRES =
      "SELECT id, json FROM table_entity "
          + "WHERE jsonb_typeof(json->'tableConstraints') = 'array' "
          + "AND jsonb_array_length(json->'tableConstraints') > 0 "
          + "AND EXISTS ("
          + "  SELECT 1 FROM jsonb_array_elements(json->'tableConstraints') AS tc "
          + "  WHERE jsonb_typeof(tc->'referredColumns') = 'array' "
          + "    AND jsonb_array_length(tc->'referredColumns') > 0"
          + ") "
          + "LIMIT :limit OFFSET :offset";

  @Test
  void addViewAllRuleToOrgPolicyAddsMissingRuleAndPersists() {
    PolicyRepository repository = mock(PolicyRepository.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    Policy policy =
        new Policy()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("OrganizationPolicy")
            .withRules(new ArrayList<>(List.of(new Rule().withName("ExistingRule"))));

    when(repository.findByName("OrganizationPolicy", Include.NON_DELETED)).thenReturn(policy);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(repository);

      MigrationUtil.addViewAllRuleToOrgPolicy(collectionDAO);
    }

    Rule addedRule =
        policy.getRules().stream()
            .filter(rule -> "OrganizationPolicy-ViewAll-Rule".equals(rule.getName()))
            .findFirst()
            .orElseThrow();
    assertEquals(List.of("all"), addedRule.getResources());
    assertEquals(List.of(MetadataOperation.VIEW_ALL), addedRule.getOperations());
    assertEquals(Rule.Effect.ALLOW, addedRule.getEffect());
    verify(collectionDAO.policyDAO())
        .update(eq(policy.getId()), eq(policy.getFullyQualifiedName()), anyString());
  }

  @Test
  void addViewAllRuleToOrgPolicySkipsExistingRuleAndMissingPolicies() {
    PolicyRepository repository = mock(PolicyRepository.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    Policy policy =
        new Policy()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("OrganizationPolicy")
            .withRules(
                new ArrayList<>(List.of(new Rule().withName("OrganizationPolicy-ViewAll-Rule"))));

    when(repository.findByName("OrganizationPolicy", Include.NON_DELETED))
        .thenReturn(policy)
        .thenThrow(EntityNotFoundException.byName("OrganizationPolicy"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(repository);

      MigrationUtil.addViewAllRuleToOrgPolicy(collectionDAO);
      MigrationUtil.addViewAllRuleToOrgPolicy(collectionDAO);
    }

    verify(collectionDAO.policyDAO(), never()).update(any(), anyString(), anyString());
  }

  @Test
  void addViewAllRuleToOrgPolicyInitializesNullRuleLists() {
    PolicyRepository repository = mock(PolicyRepository.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    Policy policy =
        new Policy()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("OrganizationPolicy")
            .withRules(null);

    when(repository.findByName("OrganizationPolicy", Include.NON_DELETED)).thenReturn(policy);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(repository);

      assertDoesNotThrow(() -> MigrationUtil.addViewAllRuleToOrgPolicy(collectionDAO));
    }

    assertEquals(1, policy.getRules().size());
    assertEquals("OrganizationPolicy-ViewAll-Rule", policy.getRules().getFirst().getName());
    verify(collectionDAO.policyDAO())
        .update(eq(policy.getId()), eq(policy.getFullyQualifiedName()), anyString());
  }

  @Test
  void addEditGlossaryTermsToDataConsumerPolicyUpdatesBothPolicies() {
    PolicyRepository repository = mock(PolicyRepository.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    Policy consumerPolicy = editPolicy("DataConsumerPolicy");
    Policy stewardPolicy = editPolicy("DataStewardPolicy");

    when(repository.findByName("DataConsumerPolicy", Include.NON_DELETED))
        .thenReturn(consumerPolicy);
    when(repository.findByName("DataStewardPolicy", Include.NON_DELETED)).thenReturn(stewardPolicy);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(repository);

      MigrationUtil.addEditGlossaryTermsToDataConsumerPolicy(collectionDAO);
    }

    assertTrue(
        consumerPolicy
            .getRules()
            .getFirst()
            .getOperations()
            .contains(MetadataOperation.EDIT_GLOSSARY_TERMS));
    assertTrue(
        consumerPolicy.getRules().getFirst().getOperations().contains(MetadataOperation.EDIT_TIER));
    assertTrue(
        consumerPolicy.getRules().getFirst().getOperations().contains(MetadataOperation.EDIT_TAGS));
    assertTrue(
        stewardPolicy
            .getRules()
            .getFirst()
            .getOperations()
            .contains(MetadataOperation.EDIT_GLOSSARY_TERMS));
    verify(collectionDAO.policyDAO(), times(2)).update(any(), anyString(), anyString());
  }

  @Test
  void addOperationsToPolicyRuleHandlesMissingRulesAndUnexpectedErrors() {
    PolicyRepository repository = mock(PolicyRepository.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    Policy noRulesPolicy =
        new Policy()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("PolicyWithoutRules")
            .withRules(null);

    when(repository.findByName("PolicyWithoutRules", Include.NON_DELETED))
        .thenReturn(noRulesPolicy);
    when(repository.findByName("BrokenPolicy", Include.NON_DELETED))
        .thenThrow(new IllegalStateException("repository broken"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(repository);

      assertDoesNotThrow(
          () ->
              MigrationUtil.addOperationsToPolicyRule(
                  "PolicyWithoutRules",
                  "MissingRule",
                  List.of(MetadataOperation.EDIT_TAGS),
                  collectionDAO));
      assertDoesNotThrow(
          () ->
              MigrationUtil.addOperationsToPolicyRule(
                  "BrokenPolicy",
                  "BrokenRule",
                  List.of(MetadataOperation.EDIT_TAGS),
                  collectionDAO));
    }

    verify(collectionDAO.policyDAO(), never()).update(any(), anyString(), anyString());
  }

  @Test
  void addOperationsToPolicyRuleSkipsMissingRulesAndAlreadyAppliedPolicies() {
    PolicyRepository repository = mock(PolicyRepository.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    Policy missingEditRulePolicy =
        new Policy()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("MissingEditRulePolicy")
            .withRules(new ArrayList<>(List.of(new Rule().withName("OtherRule"))));
    Policy completePolicy =
        new Policy()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("CompletePolicy")
            .withRules(
                new ArrayList<>(
                    List.of(
                        new Rule()
                            .withName("CompleteRule")
                            .withOperations(
                                new ArrayList<>(
                                    List.of(
                                        MetadataOperation.EDIT_GLOSSARY_TERMS,
                                        MetadataOperation.EDIT_TIER,
                                        MetadataOperation.EDIT_TAGS))))));

    when(repository.findByName("MissingEditRulePolicy", Include.NON_DELETED))
        .thenReturn(missingEditRulePolicy);
    when(repository.findByName("CompletePolicy", Include.NON_DELETED)).thenReturn(completePolicy);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(repository);

      MigrationUtil.addOperationsToPolicyRule(
          "MissingEditRulePolicy",
          "MissingRule",
          List.of(MetadataOperation.EDIT_TAGS),
          collectionDAO);
      MigrationUtil.addOperationsToPolicyRule(
          "CompletePolicy",
          "CompleteRule",
          List.of(
              MetadataOperation.EDIT_GLOSSARY_TERMS,
              MetadataOperation.EDIT_TIER,
              MetadataOperation.EDIT_TAGS),
          collectionDAO);
    }

    verify(collectionDAO.policyDAO(), never()).update(any(), anyString(), anyString());
  }

  @Test
  void addRelationsForTableConstraintsAddsOnlyMissingRelationships() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    TableRepository tableRepository = mock(TableRepository.class);
    UUID tableId = UUID.randomUUID();
    UUID existingRelatedId = UUID.randomUUID();
    UUID newRelatedId = UUID.randomUUID();
    Table table =
        new Table()
            .withId(tableId)
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withReferredColumns(
                            List.of(
                                "service.db.schema.alreadyRelated.columnA",
                                "service.db.schema.newRelated.columnB"))));
    List<Map<String, Object>> rows =
        List.of(Map.of("id", tableId.toString(), "json", JsonUtils.pojoToJson(table)));

    when(handle
            .createQuery(TABLE_CONSTRAINT_FETCH_MY_SQL)
            .bind("limit", 1000)
            .bind("offset", 0)
            .mapToMap()
            .list())
        .thenReturn(rows);
    when(handle
            .createQuery(TABLE_CONSTRAINT_FETCH_MY_SQL)
            .bind("limit", 1000)
            .bind("offset", 1000)
            .mapToMap()
            .list())
        .thenReturn(List.of());
    when(tableRepository.findTo(tableId, Entity.TABLE, Relationship.RELATED_TO, Entity.TABLE))
        .thenReturn(
            List.of(
                new EntityReference()
                    .withId(existingRelatedId)
                    .withType(Entity.TABLE)
                    .withFullyQualifiedName("service.db.schema.alreadyRelated")));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepository);
      entity
          .when(
              () ->
                  Entity.getEntityReferenceByName(
                      Entity.TABLE, "service.db.schema.alreadyRelated", Include.NON_DELETED))
          .thenReturn(
              new EntityReference()
                  .withId(existingRelatedId)
                  .withType(Entity.TABLE)
                  .withFullyQualifiedName("service.db.schema.alreadyRelated"));
      entity
          .when(
              () ->
                  Entity.getEntityReferenceByName(
                      Entity.TABLE, "service.db.schema.newRelated", Include.NON_DELETED))
          .thenReturn(
              new EntityReference()
                  .withId(newRelatedId)
                  .withType(Entity.TABLE)
                  .withFullyQualifiedName("service.db.schema.newRelated"));

      assertDoesNotThrow(() -> MigrationUtil.addRelationsForTableConstraints(handle, false));
    }

    verify(tableRepository)
        .addRelationship(
            tableId, newRelatedId, Entity.TABLE, Entity.TABLE, Relationship.RELATED_TO);
    verify(tableRepository, never())
        .addRelationship(
            tableId, existingRelatedId, Entity.TABLE, Entity.TABLE, Relationship.RELATED_TO);
  }

  @Test
  void addRelationsForTableConstraintsSwallowsMissingRelatedTables() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    TableRepository tableRepository = mock(TableRepository.class);
    UUID tableId = UUID.randomUUID();
    Table table =
        new Table()
            .withId(tableId)
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withReferredColumns(List.of("service.db.schema.missingRelated.columnA"))));
    List<Map<String, Object>> rows =
        List.of(Map.of("id", tableId.toString(), "json", JsonUtils.pojoToJson(table)));

    when(handle
            .createQuery(TABLE_CONSTRAINT_FETCH_POSTGRES)
            .bind("limit", 1000)
            .bind("offset", 0)
            .mapToMap()
            .list())
        .thenReturn(rows);
    when(handle
            .createQuery(TABLE_CONSTRAINT_FETCH_POSTGRES)
            .bind("limit", 1000)
            .bind("offset", 1000)
            .mapToMap()
            .list())
        .thenReturn(List.of());
    when(tableRepository.findTo(tableId, Entity.TABLE, Relationship.RELATED_TO, Entity.TABLE))
        .thenReturn(List.of());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepository);
      entity
          .when(
              () ->
                  Entity.getEntityReferenceByName(
                      Entity.TABLE, "service.db.schema.missingRelated", Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byName("service.db.schema.missingRelated"));

      assertDoesNotThrow(() -> MigrationUtil.addRelationsForTableConstraints(handle, true));
    }

    verify(tableRepository, never())
        .addRelationship(
            any(), any(), eq(Entity.TABLE), eq(Entity.TABLE), eq(Relationship.RELATED_TO));
  }

  @Test
  void migrateServiceTypesAndConnectionsExecutesDialectSpecificStatements() {
    Handle postgresHandle = mock(Handle.class);
    Handle mySqlHandle = mock(Handle.class);
    when(postgresHandle.execute(anyString())).thenReturn(1);
    when(mySqlHandle.execute(anyString())).thenReturn(1);

    assertDoesNotThrow(() -> MigrationUtil.migrateServiceTypesAndConnections(postgresHandle, true));
    assertDoesNotThrow(() -> MigrationUtil.migrateServiceTypesAndConnections(mySqlHandle, false));

    ArgumentCaptor<String> postgresSql = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> mySqlSql = ArgumentCaptor.forClass(String.class);
    verify(postgresHandle, times(4)).execute(postgresSql.capture());
    verify(mySqlHandle, times(4)).execute(mySqlSql.capture());

    assertTrue(postgresSql.getAllValues().stream().allMatch(sql -> sql.contains("jsonb_set")));
    assertTrue(mySqlSql.getAllValues().stream().allMatch(sql -> sql.contains("JSON_SET")));
    assertTrue(
        postgresSql.getAllValues().stream().anyMatch(sql -> sql.contains("api_endpoint_entity")));
    assertTrue(
        mySqlSql.getAllValues().stream().anyMatch(sql -> sql.contains("api_collection_entity")));
  }

  @Test
  void addDisplayNameToCustomPropertyBindsDialectSpecificUpdates() {
    Handle postgresHandle = mock(Handle.class);
    Handle mySqlHandle = mock(Handle.class);
    Update postgresUpdate = mock(Update.class);
    Update mySqlUpdate = mock(Update.class);

    when(postgresHandle.createUpdate(anyString())).thenReturn(postgresUpdate);
    when(mySqlHandle.createUpdate(anyString())).thenReturn(mySqlUpdate);
    when(postgresUpdate.bind("fromType", Entity.TYPE)).thenReturn(postgresUpdate);
    when(postgresUpdate.bind("toType", Entity.TYPE)).thenReturn(postgresUpdate);
    when(postgresUpdate.bind("relation", Relationship.HAS.ordinal())).thenReturn(postgresUpdate);
    when(mySqlUpdate.bind("fromType", Entity.TYPE)).thenReturn(mySqlUpdate);
    when(mySqlUpdate.bind("toType", Entity.TYPE)).thenReturn(mySqlUpdate);
    when(mySqlUpdate.bind("relation", Relationship.HAS.ordinal())).thenReturn(mySqlUpdate);
    when(postgresUpdate.execute()).thenReturn(1);
    when(mySqlUpdate.execute()).thenReturn(1);

    MigrationUtil.addDisplayNameToCustomProperty(postgresHandle, true);
    MigrationUtil.addDisplayNameToCustomProperty(mySqlHandle, false);

    ArgumentCaptor<String> postgresSql = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> mySqlSql = ArgumentCaptor.forClass(String.class);
    verify(postgresHandle).createUpdate(postgresSql.capture());
    verify(mySqlHandle).createUpdate(mySqlSql.capture());
    verify(postgresUpdate).bind("fromType", Entity.TYPE);
    verify(postgresUpdate).bind("toType", Entity.TYPE);
    verify(postgresUpdate).bind("relation", Relationship.HAS.ordinal());
    verify(mySqlUpdate).bind("fromType", Entity.TYPE);
    verify(mySqlUpdate).bind("toType", Entity.TYPE);
    verify(mySqlUpdate).bind("relation", Relationship.HAS.ordinal());
    assertTrue(postgresSql.getValue().contains("jsonb_set"));
    assertTrue(mySqlSql.getValue().contains("JSON_SET"));
  }

  @Test
  void addDisplayNameToCustomPropertySwallowsUpdateFailures() {
    Handle handle = mock(Handle.class);
    when(handle.createUpdate(anyString())).thenThrow(new IllegalStateException("bind failed"));

    assertDoesNotThrow(() -> MigrationUtil.addDisplayNameToCustomProperty(handle, true));
  }

  private static Policy editPolicy(String name) {
    return new Policy()
        .withId(UUID.randomUUID())
        .withFullyQualifiedName(name)
        .withRules(
            new ArrayList<>(
                List.of(
                    new Rule()
                        .withName(name + "-EditRule")
                        .withOperations(
                            new ArrayList<>(List.of(MetadataOperation.EDIT_DESCRIPTION))))));
  }
}
