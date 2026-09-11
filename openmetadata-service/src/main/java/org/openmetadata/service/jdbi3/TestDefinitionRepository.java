package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TEST_DEFINITION;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.dqtests.TestDefinitionResource;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.AsyncService.DatabaseOperation;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
public class TestDefinitionRepository extends EntityRepository<TestDefinition> {
  private static final String ENTITY_TYPE_PARAM = "entityType";

  /** Test cases re-indexed per page after a dimension reclassification. */
  private static final int REINDEX_BATCH_SIZE = 100;

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

    TestDefinition existing = update ? findExistingOrNull(entity) : null;

    validateDataQualityDimension(entity, existing);

    // For updates to system test definitions, only allow changes to the enabled field and to the
    // data quality dimension
    if (update && entity.getProvider() == ProviderType.SYSTEM && existing != null) {
      validateSystemTestDefinitionUpdate(existing, entity);
    }
  }

  /**
   * The entity as currently stored, or null when this is really a create.
   *
   * <p>Looked up by id and then by name because the two write paths identify it differently: a
   * PATCH carries the stored id, while a PUT arrives with a freshly generated one — {@code
   * EntityMapper.copy} assigns a random UUID before the repository has decided whether this is a
   * create or an update. Calling {@code find(id)} alone therefore threw {@code
   * EntityNotFoundException} on every PUT, surfacing as a 404 from an endpoint that was supposed
   * to upsert.
   */
  private TestDefinition findExistingOrNull(TestDefinition entity) {
    if (entity.getId() != null) {
      try {
        return find(entity.getId(), Include.ALL);
      } catch (EntityNotFoundException byId) {
        LOG.debug("Test definition {} not found by id, falling back to name", entity.getId());
      }
    }
    String fqn =
        entity.getFullyQualifiedName() != null ? entity.getFullyQualifiedName() : entity.getName();
    return fqn == null ? null : findByNameOrNull(fqn, Include.ALL);
  }

  /**
   * A test definition classifies its test cases under a dimension entity — a system one or a custom
   * one created in Settings &gt; Preferences &gt; Data Quality — so a name that matches none of them
   * is rejected rather than silently stored. NoDimension is the "unset" marker the shipped test
   * definitions were seeded with and has no entity of its own.
   *
   * <p>Only a dimension the caller is actually changing is validated. A dimension that was valid
   * when it was set and has since been deleted must not turn every other edit — toggling {@code
   * enabled}, say — into a 404 on a test definition the user cannot otherwise repair.
   */
  private void validateDataQualityDimension(TestDefinition entity, TestDefinition existing) {
    String dimension = entity.getDataQualityDimension();
    if (CommonUtil.nullOrEmpty(dimension)
        || DataQualityDimensionRepository.NO_DIMENSION.equals(dimension)
        || (existing != null && dimension.equals(existing.getDataQualityDimension()))) {
      return;
    }
    Entity.getEntityReferenceByName(Entity.DATA_QUALITY_DIMENSION, dimension, Include.NON_DELETED);
  }

  /**
   * Repoints the test cases of a test definition onto its new dimension. A test case stores its
   * dimension as a relationship so that reads never have to resolve it, which means a
   * reclassification has to be pushed down rather than picked up on the next read. Only rows
   * marked inherited move; a dimension set on the test case itself is an override and stays.
   *
   * <p>The search documents of the affected test cases carry the dimension too, so they are
   * re-indexed. That is deliberately left to the async indexer: a test definition can back tens of
   * thousands of test cases and the caller must not wait for them.
   */
  private void propagateDimensionToTestCases(
      UUID testDefinitionId, String previousDimension, String newDimension) {
    EntityReference previous = findDimensionOrNull(previousDimension);
    EntityReference current = findDimensionOrNull(newDimension);
    if (Objects.equals(previousDimension, newDimension)) {
      return;
    }

    int moved;
    if (previous == null) {
      // The definition had no resolvable dimension, so its test cases hold no inherited row to
      // repoint — the rows have to be created. Test cases that already carry a dimension of their
      // own are skipped by the anti-join, so an override is never overwritten.
      if (current == null) {
        return;
      }
      moved =
          daoCollection
              .relationshipDAO()
              .addInheritedVia(
                  current.getId(),
                  Entity.DATA_QUALITY_DIMENSION,
                  Entity.TEST_CASE,
                  Relationship.RELATED_TO.ordinal(),
                  testDefinitionId,
                  Entity.TEST_DEFINITION,
                  Relationship.CONTAINS.ordinal());
    } else if (current == null) {
      // The definition was cleared (or set to NoDimension), so the inherited rows have nothing to
      // point at and are dropped. Filtered on the inherited marker exactly like the repoint below:
      // an unfiltered delete would also remove dimensions the user set on the test case itself.
      moved =
          daoCollection
              .relationshipDAO()
              .removeInheritedVia(
                  previous.getId(),
                  Entity.DATA_QUALITY_DIMENSION,
                  Entity.TEST_CASE,
                  Relationship.RELATED_TO.ordinal(),
                  testDefinitionId,
                  Entity.TEST_DEFINITION,
                  Relationship.CONTAINS.ordinal());
    } else {
      moved =
          daoCollection
              .relationshipDAO()
              .repointInheritedVia(
                  previous.getId(),
                  current.getId(),
                  Entity.DATA_QUALITY_DIMENSION,
                  Entity.TEST_CASE,
                  Relationship.RELATED_TO.ordinal(),
                  testDefinitionId,
                  Entity.TEST_DEFINITION,
                  Relationship.CONTAINS.ordinal());
    }

    if (moved == 0) {
      return;
    }
    LOG.info(
        "Reclassified {} inherited test case dimensions from [{}] to [{}]",
        moved,
        previousDimension,
        newDimension);

    // The dimension is denormalized into each test case's search document, so the documents have
    // to be rebuilt or the Data Quality dashboards keep reporting the old dimension. Handed to the
    // async executor and walked a page at a time: the relational change is already committed and
    // authoritative, and a definition can back a hundred thousand test cases.
    AsyncService.getInstance()
        .executeDatabaseTask(
            DatabaseOperation.TEST_CASE_CLEANUP,
            "dq-dimension-reclassify:" + testDefinitionId,
            () -> reindexTestCasesOf(testDefinitionId));
  }

  /** Rebuilds the search documents of a test definition's test cases, one page at a time. */
  void reindexTestCasesOf(UUID testDefinitionId) {
    int offset = 0;
    while (true) {
      List<String> page =
          daoCollection
              .relationshipDAO()
              .findToIdsPaged(
                  testDefinitionId,
                  Entity.TEST_DEFINITION,
                  Entity.TEST_CASE,
                  Relationship.CONTAINS.ordinal(),
                  REINDEX_BATCH_SIZE,
                  offset);
      if (page.isEmpty()) {
        return;
      }
      try {
        List<UUID> ids = page.stream().map(UUID::fromString).toList();
        for (EntityReference testCase :
            Entity.getEntityReferencesByIds(Entity.TEST_CASE, ids, Include.ALL)) {
          searchRepository.updateEntity(testCase);
        }
      } catch (RuntimeException e) {
        LOG.error(
            "Failed to reindex a page of test cases for test definition [{}]", testDefinitionId, e);
      }
      if (page.size() < REINDEX_BATCH_SIZE) {
        return;
      }
      offset += REINDEX_BATCH_SIZE;
    }
  }

  private EntityReference findDimensionOrNull(String dimensionName) {
    if (CommonUtil.nullOrEmpty(dimensionName)
        || DataQualityDimensionRepository.NO_DIMENSION.equals(dimensionName)) {
      return null;
    }
    try {
      return Entity.getEntityReferenceByName(
          Entity.DATA_QUALITY_DIMENSION, dimensionName, Include.ALL);
    } catch (EntityNotFoundException e) {
      return null;
    }
  }

  private void validateSystemTestDefinitionUpdate(TestDefinition existing, TestDefinition updated) {
    // Check if any field other than 'enabled' and 'dataQualityDimension' is being changed
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
    // The data quality dimension is deliberately absent from these checks: reclassifying a shipped
    // test definition under a dimension of their own — such as a BCBS 239 one — is the one edit
    // users are allowed to make to a system test definition.
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

    /**
     * Reclassifying a test definition moves the test cases that took their dimension from it. Test
     * cases carrying a dimension the user chose are left alone — their relationship has no
     * inherited marker — so an override survives a reclassification of its test definition.
     */
    private void updateDataQualityDimension() {
      recordChange(
          "dataQualityDimension",
          original.getDataQualityDimension(),
          updated.getDataQualityDimension());
      propagateDimensionToTestCases(
          original.getId(), original.getDataQualityDimension(), updated.getDataQualityDimension());
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      // For system test definitions, only allow enabled and data quality dimension changes
      if (original.getProvider() == ProviderType.SYSTEM) {
        compareAndUpdate(
            "enabled", () -> recordChange("enabled", original.getEnabled(), updated.getEnabled()));
        compareAndUpdate("dataQualityDimension", this::updateDataQualityDimension);
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
        compareAndUpdate("dataQualityDimension", this::updateDataQualityDimension);
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
