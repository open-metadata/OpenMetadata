package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import java.util.Optional;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;

public class SetEntityCertificationImpl implements JavaDelegate {
  private Expression certificationExpr;

  @Override
  public void execute(DelegateExecution execution) {
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse((String) execution.getVariable("relatedEntity"));
    String entityType = entityLink.getEntityType();
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

    String certification =
        Optional.ofNullable(certificationExpr)
            .map(certificationExpr -> (String) certificationExpr.getValue(execution))
            .orElse(null);
    String user =
        Optional.ofNullable((String) execution.getVariable("resolvedBy"))
            .orElse(entity.getUpdatedBy());

    setStatus(entity, entityType, user, certification);
  }

  private void setStatus(
      EntityInterface entity, String entityType, String user, String certification) {
    System.out.printf("Set Entity Certification to '%s'%n", certification);
    //        String originalJson = JsonUtils.pojoToJson(entity);
    //
    //        entity.setCertification(certification);
    //        String updatedJson = JsonUtils.pojoToJson(entity);
    //
    //        JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
    //
    //        EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    //        entityRepository.patch(null, entity.getId(), user, patch);
  }
}
