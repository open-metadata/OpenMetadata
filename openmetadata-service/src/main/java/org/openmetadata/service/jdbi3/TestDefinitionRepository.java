package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TEST_DEFINITION;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Set;
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
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.dqtests.TestDefinitionResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository()
public class TestDefinitionRepository implements EntityPolicy<TestDefinition> {

  private static final String ENTITY_TYPE_PARAM = "entityType";

  private static final List<TestDefinitionEntityType> ENTITY_TYPES =
      List.of(TestDefinitionEntityType.values());

  public TestDefinitionRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                TestDefinitionResource.COLLECTION_PATH,
                TEST_DEFINITION,
                TestDefinition.class,
                Entity.getCollectionDAO().testDefinitionDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
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
      TestDefinition existing = lookup().byId(entity.getId(), Include.ALL);
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
    persistence().store(entity, update);
  }

  @Override
  public void storeRelationships(TestDefinition entity) {
    // No relationships to store beyond what is stored in the super class
  }

  @Override
  public void preDelete(TestDefinition entity, String deletedBy) {
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
  public void deleteChildren(UUID id, boolean recursive, boolean hardDelete, String updatedBy) {
    if (!recursive) {
      requireNoDependentTestCases(id);
    }
    EntityPolicy.super.deleteChildren(id, recursive, hardDelete, updatedBy);
  }

  private void requireNoDependentTestCases(UUID testDefinitionId) {
    int testCaseCount =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .countFindTo(
                testDefinitionId, TEST_DEFINITION, List.of(Relationship.CONTAINS.ordinal()));
    if (testCaseCount > 0) {
      String testDefinitionName =
          lookup().byId(testDefinitionId, Include.ALL).getFullyQualifiedName();
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
  public EntityUpdater<TestDefinition> getUpdater(
      TestDefinition original,
      TestDefinition updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new TestDefinitionUpdater(original, updated, operation).mutation();
  }

  public class TestDefinitionUpdater implements EntitySpecificMutation<TestDefinition> {

    public TestDefinitionUpdater(
        TestDefinition original, TestDefinition updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<TestDefinition> entityUpdate, boolean consolidatingChanges) {
      // For system test definitions, only allow enabled field changes
      if (entityUpdate.getOriginal().getProvider() == ProviderType.SYSTEM) {
        // Only record enabled field changes for system test definitions
        entityUpdate.compareAndUpdate(
            "enabled",
            () ->
                entityUpdate.recordChange(
                    "enabled",
                    entityUpdate.getOriginal().getEnabled(),
                    entityUpdate.getUpdated().getEnabled()));
      } else {
        // For user/automation test definitions, allow all changes
        entityUpdate.compareAndUpdate(
            "testPlatforms",
            () ->
                entityUpdate.recordChange(
                    "testPlatforms",
                    entityUpdate.getOriginal().getTestPlatforms(),
                    entityUpdate.getUpdated().getTestPlatforms()));
        entityUpdate.compareAndUpdate(
            "supportedDataTypes",
            () ->
                entityUpdate.recordChange(
                    "supportedDataTypes",
                    entityUpdate.getOriginal().getSupportedDataTypes(),
                    entityUpdate.getUpdated().getSupportedDataTypes()));
        entityUpdate.compareAndUpdate(
            "parameterDefinition",
            () ->
                entityUpdate.recordChange(
                    "parameterDefinition",
                    entityUpdate.getOriginal().getParameterDefinition(),
                    entityUpdate.getUpdated().getParameterDefinition()));
        entityUpdate.compareAndUpdate(
            "enabled",
            () ->
                entityUpdate.recordChange(
                    "enabled",
                    entityUpdate.getOriginal().getEnabled(),
                    entityUpdate.getUpdated().getEnabled()));
        entityUpdate.compareAndUpdate(
            "dataQualityDimension",
            () ->
                entityUpdate.recordChange(
                    "dataQualityDimension",
                    entityUpdate.getOriginal().getDataQualityDimension(),
                    entityUpdate.getUpdated().getDataQualityDimension()));
        entityUpdate.compareAndUpdate(
            "supportedServices",
            () ->
                entityUpdate.recordChange(
                    "supportedServices",
                    entityUpdate.getOriginal().getSupportedServices(),
                    entityUpdate.getUpdated().getSupportedServices()));
        entityUpdate.compareAndUpdate(
            "sqlExpression",
            () ->
                entityUpdate.recordChange(
                    "sqlExpression",
                    entityUpdate.getOriginal().getSqlExpression(),
                    entityUpdate.getUpdated().getSqlExpression()));
      }
    }

    private final EntityUpdater<TestDefinition> entityUpdate;

    public EntityUpdater<TestDefinition> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<TestDefinition> entityContext;

  @Override
  public final EntityPolicyContext<TestDefinition> context() {
    return entityContext;
  }
}
