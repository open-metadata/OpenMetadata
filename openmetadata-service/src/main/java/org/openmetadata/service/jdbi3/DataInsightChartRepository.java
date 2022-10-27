package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_INSIGHT_CHART;

import java.io.IOException;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

public class DataInsightChartRepository extends EntityRepository<DataInsightChart> {
  public static final String COLLECTION_PATH = "/v1/dataInsight";
  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";

  public DataInsightChartRepository(CollectionDAO dao) {
    super(
        COLLECTION_PATH,
        DATA_INSIGHT_CHART,
        DataInsightChart.class,
        dao.dataInsightChartDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public DataInsightChart setFields(DataInsightChart entity, EntityUtil.Fields fields) throws IOException {
    entity.setOwner(fields.contains(Entity.FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void prepare(DataInsightChart entity) throws IOException {
    setFullyQualifiedName(entity);
  }

  @Override
  public void storeEntity(DataInsightChart entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity.getId(), entity, update);
    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(DataInsightChart entity) throws IOException {
    storeOwner(entity, entity.getOwner());
  }
}
