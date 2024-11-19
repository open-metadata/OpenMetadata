package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESOLVED_BY_VARIABLE;

import java.util.Optional;
import javax.json.JsonPatch;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

public class SetEntityCertificationImpl implements JavaDelegate {
  private Expression certificationExpr;

  @Override
  public void execute(DelegateExecution execution) {
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse((String) execution.getVariable(RELATED_ENTITY_VARIABLE));
    String entityType = entityLink.getEntityType();
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

    String certification =
        Optional.ofNullable(certificationExpr)
            .map(certificationExpr -> (String) certificationExpr.getValue(execution))
            .orElse(null);
    String user =
        Optional.ofNullable((String) execution.getVariable(RESOLVED_BY_VARIABLE))
            .orElse(entity.getUpdatedBy());

    setStatus(entity, entityType, user, certification);
  }

  private void setStatus(
      EntityInterface entity, String entityType, String user, String certification) {
    String originalJson = JsonUtils.pojoToJson(entity);

    Optional<String> oCertification = Optional.ofNullable(certification);
    Optional<AssetCertification> oEntityCertification =
        Optional.ofNullable(entity.getCertification());

    if (oCertification.isEmpty() && oEntityCertification.isEmpty()) {
      return;
    }

    if (oCertification.isEmpty()) {
      entity.setCertification(null);
    } else {

      if (oCertification.get().equals(oEntityCertification.get().getTagLabel().getTagFQN())) {
        return;
      }

      AssetCertification assetCertification =
          new AssetCertification()
              .withTagLabel(EntityUtil.toTagLabel(TagLabelUtil.getTag(certification)));
      entity.setCertification(assetCertification);
    }

    String updatedJson = JsonUtils.pojoToJson(entity);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    entityRepository.patch(null, entity.getId(), user, patch);
  }
}
