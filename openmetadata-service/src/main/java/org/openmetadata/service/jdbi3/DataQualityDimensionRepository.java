package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_QUALITY_DIMENSION;

import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.DataQualityDimension;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.dqtests.DataQualityDimensionResource;
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
   * Number of test cases that carry this dimension, shown in the Data Quality settings page. Test
   * cases hold their dimension as a relationship only, so deleting a dimension does not delete or
   * rewrite them: they simply lose the override and fall back to the dimension of their test
   * definition.
   */
  public int getTestCaseCount(UUID dimensionId) {
    return daoCollection
        .relationshipDAO()
        .countFindTo(
            dimensionId, DATA_QUALITY_DIMENSION, List.of(Relationship.RELATED_TO.ordinal()));
  }

  /**
   * Number of test definitions classified under each dimension, keyed by dimension name. Unlike
   * test cases, a test definition holds its dimension as a plain name in its json rather than as a
   * relationship, so it is invisible to {@link #getTestCaseCount(UUID)} — without this the delete
   * confirmation reports no impact for a dimension that a dozen test definitions are classified
   * under. The table holds the shipped definitions plus whatever the user added, so a single pass
   * in memory is cheaper than a dialect-specific json query.
   */
  public Map<String, Integer> getTestDefinitionCountsByDimensionName() {
    Map<String, Integer> counts = new HashMap<>();
    TestDefinitionRepository testDefinitionRepository =
        (TestDefinitionRepository) Entity.getEntityRepository(Entity.TEST_DEFINITION);
    List<TestDefinition> testDefinitions =
        testDefinitionRepository.listAll(
            EntityUtil.Fields.EMPTY_FIELDS, new ListFilter(Include.NON_DELETED));
    for (TestDefinition testDefinition : testDefinitions) {
      String dimension = testDefinition.getDataQualityDimension();
      if (dimension != null && !dimension.isBlank() && !NO_DIMENSION.equals(dimension)) {
        counts.merge(dimension, 1, Integer::sum);
      }
    }
    return counts;
  }
}
