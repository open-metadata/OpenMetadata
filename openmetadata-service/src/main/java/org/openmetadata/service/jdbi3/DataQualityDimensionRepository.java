package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.DATA_QUALITY_DIMENSION;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.DataQualityDimension;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.dqtests.DataQualityDimensionResource;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.AsyncService.DatabaseOperation;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class DataQualityDimensionRepository extends EntityRepository<DataQualityDimension> {
  /**
   * Name test definitions carry when they classify their test cases under no dimension at all. It
   * has no dimension entity of its own — it is the "unset" marker the shipped test definitions were
   * seeded with, kept so that they keep deserializing.
   */
  public static final String NO_DIMENSION = "NoDimension";

  /** Test definitions repaired per round when a dimension they reference is deleted. */
  private static final int BATCH_SIZE = 100;

  public DataQualityDimensionRepository() {
    super(
        DataQualityDimensionResource.COLLECTION_PATH,
        DATA_QUALITY_DIMENSION,
        DataQualityDimension.class,
        Entity.getCollectionDAO().dataQualityDimensionDAO(),
        "",
        "");
    supportsSearch = false;
    quoteFqn = false;
  }

  @Override
  public void setFields(
      DataQualityDimension entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(DataQualityDimension entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(DataQualityDimension entity, boolean update) {
    if (entity.getProvider() == null) {
      entity.setProvider(ProviderType.USER);
    }
    if (!update) {
      return;
    }
    DataQualityDimension existing = find(entity.getId(), Include.ALL);
    if (existing != null && existing.getProvider() == ProviderType.SYSTEM) {
      // The provider is what makes a dimension immutable, so an update must not be able to flip it:
      // a client posting provider=user over a system dimension would otherwise unlock it.
      entity.setProvider(ProviderType.SYSTEM);
      rejectSystemDimensionEdit(existing, entity);
    }
  }

  private void rejectSystemDimensionEdit(
      DataQualityDimension existing, DataQualityDimension updated) {
    if (!Objects.equals(existing.getName(), updated.getName())
        || !Objects.equals(existing.getDisplayName(), updated.getDisplayName())
        || !Objects.equals(existing.getDescription(), updated.getDescription())
        || !Objects.equals(existing.getStyle(), updated.getStyle())) {
      throw new BadRequestException(
          "System data quality dimensions cannot be modified. Create a custom dimension instead.");
    }
  }

  @Override
  public void storeEntity(DataQualityDimension entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(DataQualityDimension entity) {
    // The test case owns the relationship to its dimension, see TestCaseRepository
  }

  @Override
  protected void preDelete(DataQualityDimension entity, String deletedBy) {
    if (entity.getProvider() == ProviderType.SYSTEM) {
      throw new BadRequestException("System data quality dimensions cannot be deleted.");
    }
  }

  /**
   * Deleting a dimension leaves two dangling references behind: the test definitions that name it
   * (a plain string, so nothing cascades) and the search documents of its test cases, which carry
   * the dimension denormalized. Both are repaired here.
   *
   * <p>Runs before the framework removes the relationship rows, so the affected test cases are
   * collected while the edges still exist and the repair itself is handed to the async executor —
   * a dimension can back tens of thousands of test cases and deleting a label must not block the
   * request.
   */
  @Override
  protected void entitySpecificCleanup(String deletedBy, DataQualityDimension entity) {
    // Runs before the framework removes the relationship rows. Test cases that pointed at this
    // dimension *explicitly* are captured now because after the delete there is nothing left to
    // find them by; they are user-made choices, so the set is small. The inherited ones are found
    // later via the test definitions that named the dimension, which avoids holding every id.
    List<UUID> overriddenTestCaseIds =
        daoCollection
            .relationshipDAO()
            .findTo(
                entity.getId(),
                DATA_QUALITY_DIMENSION,
                Relationship.RELATED_TO.ordinal(),
                Entity.TEST_CASE)
            .stream()
            .filter(record -> !isInheritedRow(record.getJson()))
            .map(CollectionDAO.EntityRelationshipRecord::getId)
            .toList();
    String dimensionName = entity.getName();

    AsyncService.getInstance()
        .executeDatabaseTask(
            DatabaseOperation.TEST_CASE_CLEANUP,
            "dq-dimension-delete:" + dimensionName,
            () -> {
              try {
                clearDanglingTestDefinitionReferences(dimensionName);
                reindexTestCases(overriddenTestCaseIds);
              } catch (RuntimeException e) {
                LOG.error(
                    "Failed to clean up references to deleted data quality dimension [{}]",
                    dimensionName,
                    e);
              }
            });
  }

  private static boolean isInheritedRow(String relationshipJson) {
    return Boolean.TRUE.equals(TestCaseRepository.isInheritedMarker(relationshipJson));
  }

  /**
   * Clears the dimension from the test definitions that named it, a page at a time, re-indexing
   * each page's test cases before moving on. Left dangling the reference would silently stop
   * classifying anything: new test cases resolve nothing and fall through to no dimension.
   *
   * <p>Always re-reads the first page rather than walking an offset — clearing the dimension is
   * what removes a row from the result set, so each pass returns the next batch of matches.
   */
  private void clearDanglingTestDefinitionReferences(String dimensionName) {
    TestDefinitionRepository testDefinitionRepository =
        (TestDefinitionRepository) Entity.getEntityRepository(Entity.TEST_DEFINITION);
    int cleared = 0;
    while (true) {
      List<String> batch =
          daoCollection.testDefinitionDAO().listByDataQualityDimension(dimensionName, BATCH_SIZE);
      if (batch.isEmpty()) {
        break;
      }
      List<UUID> clearedIds = new ArrayList<>();
      for (String json : batch) {
        TestDefinition testDefinition = JsonUtils.readValue(json, TestDefinition.class);
        try {
          testDefinition.setDataQualityDimension(null);
          testDefinitionRepository.createOrUpdate(null, testDefinition, ADMIN_USER_NAME);
          clearedIds.add(testDefinition.getId());
        } catch (RuntimeException e) {
          LOG.error(
              "Failed to clear deleted dimension [{}] from test definition [{}]",
              dimensionName,
              testDefinition.getName(),
              e);
        }
      }
      if (clearedIds.isEmpty()) {
        // Every row in the batch failed, so it would be returned again forever.
        LOG.error(
            "Giving up clearing dimension [{}]: no test definition in the batch could be updated",
            dimensionName);
        break;
      }
      for (UUID testDefinitionId : clearedIds) {
        testDefinitionRepository.reindexTestCasesOf(testDefinitionId);
      }
      cleared += clearedIds.size();
    }
    if (cleared > 0) {
      LOG.info("Cleared deleted dimension [{}] from {} test definitions", dimensionName, cleared);
    }
  }

  /** Rebuilds the search documents of test cases that carried the deleted dimension. */
  private void reindexTestCases(List<UUID> testCaseIds) {
    if (testCaseIds.isEmpty()) {
      return;
    }
    for (EntityReference testCase :
        Entity.getEntityReferencesByIds(Entity.TEST_CASE, testCaseIds, Include.ALL)) {
      searchRepository.updateEntity(testCase);
    }
  }

  /**
   * Number of test cases that carry each of the given dimensions, keyed by dimension id, shown in
   * the Data Quality settings page. Counted with a single grouped query rather than one count per
   * dimension, so that the settings page costs two queries no matter how many dimensions are
   * registered. Dimensions no test case references are absent from the map. Test cases hold their
   * dimension as a relationship only, so deleting a dimension does not delete or rewrite them: they
   * simply lose the override and fall back to the dimension of their test definition.
   */
  public Map<UUID, Integer> getTestCaseCounts(List<UUID> dimensionIds) {
    if (nullOrEmpty(dimensionIds)) {
      return Map.of();
    }
    return EntityDAO.queryInChunks(
            dimensionIds.stream().map(UUID::toString).toList(),
            chunk ->
                daoCollection
                    .relationshipDAO()
                    .countFindTo(
                        chunk,
                        DATA_QUALITY_DIMENSION,
                        Relationship.RELATED_TO.ordinal(),
                        Entity.TEST_CASE))
        .stream()
        .collect(
            Collectors.toMap(
                CollectionDAO.EntityRelationshipCount::getId,
                CollectionDAO.EntityRelationshipCount::getCount));
  }

  /**
   * Number of test definitions classified under each dimension, keyed by dimension name. Unlike
   * test cases, a test definition holds its dimension as a plain name in its json rather than as a
   * relationship, so it is invisible to {@link #getTestCaseCounts(List)} — without this the delete
   * confirmation reports no impact for a dimension that a dozen test definitions are classified
   * under. The table holds the shipped definitions plus whatever the user added, so a single pass
   * in memory is cheaper than a dialect-specific json query.
   */
  public Map<String, Integer> getTestDefinitionCountsByDimensionName() {
    // Grouped in SQL rather than by materialising every test definition: this runs on the
    // settings page load, so its cost must not scale with the size of the test library.
    Map<String, Integer> counts = new HashMap<>();
    for (TimeSeriesDAOs.TestDefinitionDAO.DimensionCount row :
        daoCollection.testDefinitionDAO().countByDataQualityDimension()) {
      String dimension = row.dimensionName();
      if (!nullOrEmpty(dimension) && !NO_DIMENSION.equals(dimension)) {
        counts.put(dimension, row.testDefinitionCount());
      }
    }
    return counts;
  }
}
