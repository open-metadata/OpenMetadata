package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_QUALITY_DIMENSION;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.DataQualityDimension;
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
}
