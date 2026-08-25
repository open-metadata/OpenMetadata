package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TEST_DEFINITION;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.dqtests.TestDefinitionResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
public class TestDefinitionRepository extends EntityRepository<TestDefinition> {
  private static final String ENTITY_TYPE_PARAM = "entityType";
  private static final List<TestDefinitionEntityType> ENTITY_TYPES =
      List.of(TestDefinitionEntityType.values());

  public TestDefinitionRepository() {
    super(
        TestDefinitionResource.COLLECTION_PATH,
        TEST_DEFINITION,
        TestDefinition.class,
        Entity.getCollectionDAO().testDefinitionDAO(),
        "",
        "");
  }

  @Override
  public void setFields(
      TestDefinition entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(TestDefinition entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(TestDefinition entity, boolean update) {
    // validate test platforms
    if (CommonUtil.nullOrEmpty(entity.getTestPlatforms())) {
      throw new IllegalArgumentException("testPlatforms must not be empty");
    }
    // Set enabled to true by default if not specified
    if (entity.getEnabled() == null) {
      entity.setEnabled(true);
    }

    // For updates to system test definitions, only allow changes to the enabled field
    if (update && entity.getProvider() == ProviderType.SYSTEM) {
      TestDefinition existing = find(entity.getId(), Include.ALL);
      if (existing != null) {
        validateSystemTestDefinitionUpdate(existing, entity);
      }
    }
  }

  private void validateSystemTestDefinitionUpdate(TestDefinition existing, TestDefinition updated) {
    // Check if any field other than 'enabled' is being changed
    if (!existing.getEntityType().equals(updated.getEntityType())) {
      throw new BadRequestException(
          "System test definitions cannot have their entity type modified");
    }
    if (!existing.getTestPlatforms().equals(updated.getTestPlatforms())) {
      throw new BadRequestException(
          "System test definitions cannot have their test platforms modified");
    }
    if (!CommonUtil.nullOrEmpty(existing.getSupportedDataTypes())
        && !existing.getSupportedDataTypes().equals(updated.getSupportedDataTypes())) {
      throw new BadRequestException(
          "System test definitions cannot have their supported data types modified");
    }
    if (!CommonUtil.nullOrEmpty(existing.getParameterDefinition())
        && !existing.getParameterDefinition().equals(updated.getParameterDefinition())) {
      throw new BadRequestException(
          "System test definitions cannot have their parameter definitions modified");
    }
    if (existing.getDataQualityDimension() != null
        && !existing.getDataQualityDimension().equals(updated.getDataQualityDimension())) {
      throw new BadRequestException(
          "System test definitions cannot have their data quality dimension modified");
    }
    if (!CommonUtil.nullOrEmpty(existing.getSupportedServices())
        && !existing.getSupportedServices().equals(updated.getSupportedServices())) {
      throw new BadRequestException(
          "System test definitions cannot have their supported services modified");
    }
    if (existing.getSqlExpression() != null
        && !existing.getSqlExpression().equals(updated.getSqlExpression())) {
      throw new BadRequestException(
          "System test definitions cannot have their SQL expression modified");
    }
  }

  @Override
  public void storeEntity(TestDefinition entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(TestDefinition entity) {
    // No relationships to store beyond what is stored in the super class
  }

  @Override
  protected void preDelete(TestDefinition entity, String deletedBy) {
    // Prevent deletion of system test definitions
    if (entity.getProvider() == ProviderType.SYSTEM) {
      throw new BadRequestException(
          "System test definitions cannot be deleted. They can only be disabled by setting enabled=false.");
    }
  }

  /**
   * Guard a non-recursive delete: a test case must have a test definition
   * ({@code mustHaveRelationship=true}), so deleting the definition necessarily deletes every test
   * case that uses it. Surface that as an explicit, counted confirmation instead of the generic
   * "not empty" error. With {@code recursive=true} the cascade proceeds via
   * {@link EntityRepository#deleteChildren}.
   */
  @Override
  protected void deleteChildren(UUID id, boolean recursive, boolean hardDelete, String updatedBy) {
    if (!recursive) {
      requireNoDependentTestCases(id);
    }
    super.deleteChildren(id, recursive, hardDelete, updatedBy);
  }

  private void requireNoDependentTestCases(UUID testDefinitionId) {
    int testCaseCount =
        daoCollection
            .relationshipDAO()
            .countFindTo(
                testDefinitionId, TEST_DEFINITION, List.of(Relationship.CONTAINS.ordinal()));
    if (testCaseCount > 0) {
      String testDefinitionName = find(testDefinitionId, Include.ALL).getFullyQualifiedName();
      throw new IllegalArgumentException(
          CatalogExceptionMessage.testDefinitionHasTestCases(testDefinitionName, testCaseCount));
    }
  }

  /**
   * Canonicalizes the {@code entityType} listing filter for every door into {@link
   * CollectionDAO.TestDefinitionDAO}. The DAO compares the value against the {@code
   * test_definition.entityType} generated column with {@code =}, which PostgreSQL evaluates
   * case-sensitively under the deterministic collations it ships with, so an un-normalized {@code
   * Column} silently matched nothing while MySQL's case-insensitive collation matched it — see issue
   * #29542. Canonicalizing here keeps both engines and both callers (the REST resource and the MCP
   * tool) identical, and turns an unknown value into a {@code 400} instead of an empty page. A blank
   * value stays an absent filter so that clients serializing an unset filter are not rejected.
   */
  public static void addEntityTypeFilter(ListFilter filter, String entityType) {
    String value = CommonUtil.nullOrEmpty(entityType) ? "" : entityType.trim();
    if (!value.isEmpty()) {
      filter.addQueryParam(ENTITY_TYPE_PARAM, parseEntityType(value).value());
    }
  }

  private static TestDefinitionEntityType parseEntityType(String entityType) {
    return ENTITY_TYPES.stream()
        .filter(candidate -> candidate.value().equalsIgnoreCase(entityType))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    String.format(
                        "Invalid entityType '%s'. Must be one of %s",
                        entityType,
                        ENTITY_TYPES.stream().map(TestDefinitionEntityType::value).toList())));
  }

  @Override
  public EntityRepository<TestDefinition>.EntityUpdater getUpdater(
      TestDefinition original,
      TestDefinition updated,
      Operation operation,
      ChangeSource changeSource) {
    return new TestDefinitionUpdater(original, updated, operation);
  }

  public class TestDefinitionUpdater extends EntityUpdater {
    public TestDefinitionUpdater(
        TestDefinition original, TestDefinition updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      // For system test definitions, only allow enabled field changes
      if (original.getProvider() == ProviderType.SYSTEM) {
        // Only record enabled field changes for system test definitions
        compareAndUpdate(
            "enabled", () -> recordChange("enabled", original.getEnabled(), updated.getEnabled()));
      } else {
        // For user/automation test definitions, allow all changes
        compareAndUpdate(
            "testPlatforms",
            () ->
                recordChange(
                    "testPlatforms", original.getTestPlatforms(), updated.getTestPlatforms()));
        compareAndUpdate(
            "supportedDataTypes",
            () ->
                recordChange(
                    "supportedDataTypes",
                    original.getSupportedDataTypes(),
                    updated.getSupportedDataTypes()));
        compareAndUpdate(
            "parameterDefinition",
            () ->
                recordChange(
                    "parameterDefinition",
                    original.getParameterDefinition(),
                    updated.getParameterDefinition()));
        compareAndUpdate(
            "enabled", () -> recordChange("enabled", original.getEnabled(), updated.getEnabled()));
        compareAndUpdate(
            "dataQualityDimension",
            () ->
                recordChange(
                    "dataQualityDimension",
                    original.getDataQualityDimension(),
                    updated.getDataQualityDimension()));
        compareAndUpdate(
            "supportedServices",
            () ->
                recordChange(
                    "supportedServices",
                    original.getSupportedServices(),
                    updated.getSupportedServices()));
        compareAndUpdate(
            "sqlExpression",
            () ->
                recordChange(
                    "sqlExpression", original.getSqlExpression(), updated.getSqlExpression()));
      }
    }
  }
}
