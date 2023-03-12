package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.ALERT_ACTION;

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.alerts.AlertsPublisherManager;
import org.openmetadata.service.resources.dqtests.TestDefinitionResource;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class AlertActionRepository extends EntityRepository<AlertAction> {
  private static final String UPDATE_FIELDS =
      "owner,description,displayName,alertActionConfig,alertActionType,batchSize,readTimeout,timeout";
  private static final String PATCH_FIELDS =
      "owner,description,displayName,alertActionConfig,alertActionType,batchSize,readTimeout,timeout";

  public AlertActionRepository(CollectionDAO dao) {
    super(
        TestDefinitionResource.COLLECTION_PATH,
        ALERT_ACTION,
        AlertAction.class,
        dao.alertActionDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public AlertAction setFields(AlertAction entity, EntityUtil.Fields fields) {
    return entity;
  }

  @Override
  public void prepare(AlertAction entity) {
    System.out.println(entity);
  }

  @Override
  public void storeEntity(AlertAction entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity, update);

    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(AlertAction entity) {
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(AlertAction original, AlertAction updated, EntityRepository.Operation operation) {
    return new AlertActionUpdater(original, updated, operation);
  }

  public class AlertActionUpdater extends EntityUpdater {
    public AlertActionUpdater(AlertAction original, AlertAction updated, EntityRepository.Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("enabled", original.getEnabled(), updated.getEnabled());
      recordChange("batchSize", original.getBatchSize(), updated.getBatchSize());
      recordChange("readTimeout", original.getReadTimeout(), updated.getReadTimeout());
      recordChange("timeout", original.getTimeout(), updated.getTimeout());
      recordChange("alertActionConfig", original.getAlertActionConfig(), updated.getAlertActionConfig());
      recordChange("alertActionType", original.getAlertActionType(), updated.getAlertActionType());
      AlertsPublisherManager.getInstance().updateAllAlertUsingAlertAction(updated);
    }
  }
}
