/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.IdBatches;

/** Repairs old dbt references during bootstrap, without changing case identity or result history. */
@Slf4j
public final class DbtTestDefinitionMigration {
  public static final String STEP_NAME = "dbt-shared-test-definitions";
  private static final String DEFINITION_TABLE = "test_definition";
  private static final String ID = "id";
  private static final String AFTER_ID = "afterId";
  private static final String LIMIT = "limit";
  private static final String IDS = "ids";
  private static final String TABLE_SUFFIX = "_table";
  private static final String COLUMN_LINK = "::columns::";
  private static final String TABLE_LINK = "<#E::table::";
  private static final String MIGRATION_USER = "admin";
  private static final Pattern GENERIC_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");
  private static final String CASE_REFERENCES =
      " FROM entity_relationship r JOIN test_case tc ON tc.id = r.toId"
          + " WHERE r.fromId = :id AND r.fromEntity = 'testDefinition'"
          + " AND r.toEntity = 'testCase' AND r.relation = 0";

  private DbtTestDefinitionMigration() {}

  public static void migrate(final Handle handle, final ConnectionType connectionType) {
    final int migrated =
        IdBatches.fold(
            handle,
            DEFINITION_TABLE,
            0,
            (total, ids) -> total + migrateBatch(handle, connectionType, ids));
    LOG.info("Reassigned {} dbt test cases to shared definitions", migrated);
  }

  private static int migrateBatch(
      final Handle handle, final ConnectionType connectionType, final List<String> ids) {
    int migrated = 0;
    for (final String id : ids) {
      migrated +=
          handle.inTransaction(transaction -> migrateDefinition(transaction, connectionType, id));
    }
    return migrated;
  }

  private static int migrateDefinition(
      final Handle handle, final ConnectionType connectionType, final String id) {
    final TestDefinition legacy = readDefinition(handle, ID, id);
    final String targetName = sharedName(legacy);
    if (targetName == null
        || hasOtherRelationships(handle, id)
        || hasAmbiguousCases(handle, id)
        || !matchesCases(handle, legacy)) {
      return 0;
    }
    final TestDefinition existing = readDefinition(handle, "name", targetName);
    if (existing != null && !compatibleTarget(legacy, existing)) {
      LOG.warn(
          "Retaining dbt definition {}: shared definition {} is incompatible",
          legacy.getName(),
          targetName);
      return 0;
    }
    final TestDefinition target =
        existing == null ? createTarget(handle, legacy, targetName) : existing;
    final int migrated = reassignCases(handle, connectionType, legacy.getId(), target.getId());
    // A data-only repair must request reindexing even when the search mapping did not change.
    handle
        .createUpdate("DELETE FROM index_mapping_versions WHERE entityType = :entityType")
        .bind("entityType", Entity.TEST_CASE)
        .execute();
    deleteIfUnused(handle, legacy);
    return migrated;
  }

  /** The old connector stored the generic macro name as its single generated parameter. */
  static String sharedName(final TestDefinition definition) {
    if (definition == null
        || !isDbtDefinition(definition)
        || hasCustomizations(definition)
        || nullOrEmpty(definition.getParameterDefinition())
        || definition.getParameterDefinition().size() != 1) {
      return null;
    }
    final TestCaseParameter parameter = definition.getParameterDefinition().getFirst();
    if (!isGeneratedParameter(parameter)) {
      return null;
    }
    final String name =
        parameter.getName()
            + (definition.getEntityType() == TestDefinitionEntityType.TABLE ? TABLE_SUFFIX : "");
    return name.equals(definition.getName()) ? null : name;
  }

  private static boolean isGeneratedParameter(final TestCaseParameter parameter) {
    return parameter != null
        && !nullOrEmpty(parameter.getName())
        && GENERIC_NAME.matcher(parameter.getName()).matches()
        && parameter.getName().equals(parameter.getDisplayName())
        && !Boolean.TRUE.equals(parameter.getRequired())
        && parameter.getDataType() == null
        && nullOrEmpty(parameter.getDescription())
        && nullOrEmpty(parameter.getOptionValues())
        && parameter.getValidationRule() == null;
  }

  private static boolean isDbtDefinition(final TestDefinition definition) {
    return List.of(TestPlatform.DBT).equals(definition.getTestPlatforms())
        && definition.getProvider() != ProviderType.SYSTEM
        && definition.getEntityType() != null
        && !Boolean.FALSE.equals(definition.getEnabled())
        && !Boolean.TRUE.equals(definition.getDeleted());
  }

  private static boolean hasCustomizations(final TestDefinition definition) {
    return !nullOrEmpty(definition.getDisplayName())
        || !nullOrEmpty(definition.getOwners())
        || !nullOrEmpty(definition.getDomains())
        || hasExecutionCustomizations(definition);
  }

  private static boolean hasExecutionCustomizations(final TestDefinition definition) {
    return !nullOrEmpty(definition.getDataQualityDimension())
        || !nullOrEmpty(definition.getSupportedDataTypes())
        || !nullOrEmpty(definition.getSupportedServices())
        || !nullOrEmpty(definition.getSqlExpression())
        || !nullOrEmpty(definition.getValidatorClass())
        || Boolean.TRUE.equals(definition.getSupportsDynamicAssertion())
        || Boolean.TRUE.equals(definition.getSupportsRowLevelPassedFailed());
  }

  static boolean compatibleTarget(final TestDefinition legacy, final TestDefinition target) {
    return isDbtDefinition(target)
        && !hasExecutionCustomizations(target)
        && target.getEntityType() == legacy.getEntityType()
        && Objects.equals(target.getParameterDefinition(), legacy.getParameterDefinition());
  }

  static boolean matchesCase(final TestDefinition definition, final TestCase testCase) {
    return definition.getName().equals(testCase.getName())
        && (nullOrEmpty(definition.getDescription())
            || Objects.equals(definition.getDescription(), testCase.getDescription()))
        && testCase.getEntityLink() != null
        && testCase.getEntityLink().startsWith(TABLE_LINK)
        && testCase.getEntityLink().contains(COLUMN_LINK)
            == (definition.getEntityType() == TestDefinitionEntityType.COLUMN)
        && testCase.getParameterValues() != null
        && testCase.getParameterValues().size() == 1
        && definition
            .getParameterDefinition()
            .getFirst()
            .getName()
            .equals(testCase.getParameterValues().getFirst().getName());
  }

  private static boolean matchesCases(final Handle handle, final TestDefinition definition) {
    String afterId = "";
    boolean hasActiveCase = false;
    List<TestCase> cases;
    do {
      cases = caseBatch(handle, definition.getId(), afterId);
      for (final TestCase testCase : cases) {
        if (!matchesCase(definition, testCase)) {
          return false;
        }
        hasActiveCase |= !Boolean.TRUE.equals(testCase.getDeleted());
        afterId = testCase.getId().toString();
      }
    } while (cases.size() == IdBatches.BATCH_SIZE);
    // An orphan has no case with which to establish provenance or compare its description.
    return hasActiveCase;
  }

  private static List<TestCase> caseBatch(
      final Handle handle, final UUID definitionId, final String afterId) {
    return handle
        .createQuery(
            "SELECT tc.json"
                + CASE_REFERENCES
                + " AND tc.id > :afterId ORDER BY tc.id LIMIT :limit")
        .bind(ID, definitionId.toString())
        .bind(AFTER_ID, afterId)
        .bind(LIMIT, IdBatches.BATCH_SIZE)
        .mapTo(String.class)
        .map(json -> JsonUtils.readValue(json, TestCase.class))
        .list();
  }

  private static TestDefinition readDefinition(
      final Handle handle, final String field, final String value) {
    // Both field names are fixed by the callers, never taken from stored metadata.
    return handle
        .createQuery("SELECT json FROM test_definition WHERE " + field + " = :id")
        .bind(ID, value)
        .mapTo(String.class)
        .findOne()
        .map(json -> JsonUtils.readValue(json, TestDefinition.class))
        .orElse(null);
  }

  private static boolean hasOtherRelationships(final Handle handle, final String id) {
    return handle
            .createQuery(
                "SELECT COUNT(*) FROM entity_relationship WHERE (fromId = :id OR toId = :id)"
                    + " AND NOT (fromId = :id AND fromEntity = 'testDefinition' AND toEntity = 'testCase' AND relation = 0)")
            .bind(ID, id)
            .mapTo(Integer.class)
            .one()
        > 0;
  }

  private static boolean hasAmbiguousCases(final Handle handle, final String id) {
    return handle
            .createQuery(
                "SELECT COUNT(*) FROM entity_relationship r JOIN entity_relationship other"
                    + " ON other.toId = r.toId AND other.toEntity = 'testCase'"
                    + " AND other.fromEntity = 'testDefinition' AND other.relation = 0"
                    + " WHERE r.fromId = :id AND r.fromEntity = 'testDefinition'"
                    + " AND r.toEntity = 'testCase' AND r.relation = 0 AND other.fromId <> :id")
            .bind(ID, id)
            .mapTo(Integer.class)
            .one()
        > 0;
  }

  private static TestDefinition createTarget(
      final Handle handle, final TestDefinition legacy, final String name) {
    final TestDefinition target =
        new TestDefinition()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withDescription(
                "Generic dbt test " + legacy.getParameterDefinition().getFirst().getName())
            .withEntityType(legacy.getEntityType())
            .withTestPlatforms(List.of(TestPlatform.DBT))
            .withParameterDefinition(legacy.getParameterDefinition())
            .withProvider(ProviderType.USER)
            .withEnabled(true)
            .withDeleted(false)
            .withVersion(0.1)
            .withUpdatedBy(MIGRATION_USER)
            .withUpdatedAt(System.currentTimeMillis());
    handle.attach(CollectionDAO.class).testDefinitionDAO().insert(target, name);
    return target;
  }

  private static int reassignCases(
      final Handle handle,
      final ConnectionType connectionType,
      final UUID legacyId,
      final UUID targetId) {
    int migrated = 0;
    List<String> ids;
    do {
      ids =
          handle
              .createQuery(
                  "SELECT tc.id"
                      + CASE_REFERENCES
                      + " AND tc.deleted = false ORDER BY tc.id LIMIT :limit")
              .bind(ID, legacyId.toString())
              .bind(LIMIT, IdBatches.BATCH_SIZE)
              .mapTo(String.class)
              .list();
      if (!ids.isEmpty()) {
        removeEmbeddedReferences(handle, connectionType, ids);
        migrated +=
            handle
                .createUpdate(
                    "UPDATE entity_relationship SET fromId = :target"
                        + " WHERE fromId = :id AND fromEntity = 'testDefinition' AND toEntity = 'testCase'"
                        + " AND relation = 0 AND toId IN (<ids>)")
                .bind("target", targetId.toString())
                .bind(ID, legacyId.toString())
                .bindList(IDS, ids)
                .execute();
      }
    } while (!ids.isEmpty());
    return migrated;
  }

  private static void removeEmbeddedReferences(
      final Handle handle, final ConnectionType connectionType, final List<String> ids) {
    // Current storage reads this reference from the relationship. Old embedded copies must not
    // resurrect the deleted definition when another component deserializes a case's raw JSON.
    final String json =
        connectionType == ConnectionType.MYSQL
            ? "JSON_REMOVE(json, '$.testDefinition')"
            : "json - 'testDefinition'";
    handle
        .createUpdate("UPDATE test_case SET json = " + json + " WHERE id IN (<ids>)")
        .bindList(IDS, ids)
        .execute();
  }

  private static void deleteIfUnused(final Handle handle, final TestDefinition legacy) {
    final int references =
        handle
            .createQuery(
                "SELECT COUNT(*) FROM entity_relationship WHERE fromId = :id OR toId = :id")
            .bind(ID, legacy.getId().toString())
            .mapTo(Integer.class)
            .one();
    if (references == 0) {
      final CollectionDAO dao = handle.attach(CollectionDAO.class);
      dao.entityExtensionDAO().deleteAll(legacy.getId());
      dao.fieldRelationshipDAO()
          .deleteAllByPrefix(legacy.getFullyQualifiedName(), Entity.TEST_DEFINITION);
      dao.usageDAO().delete(legacy.getId());
      dao.testDefinitionDAO().delete(legacy.getId());
    }
  }
}
