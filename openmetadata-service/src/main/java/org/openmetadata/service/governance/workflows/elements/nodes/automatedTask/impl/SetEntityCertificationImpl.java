package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import jakarta.json.JsonPatch;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class SetEntityCertificationImpl implements JavaDelegate {
  private Expression certificationExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));
      String entityType = entityLink.getEntityType();
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

      String certification =
          Optional.ofNullable(certificationExpr)
              .map(certificationExpr -> (String) certificationExpr.getValue(execution))
              .orElse(null);
      String user =
          Optional.ofNullable(
                  (String)
                      varHandler.getNamespacedVariable(
                          inputNamespaceMap.get(UPDATED_BY_VARIABLE), UPDATED_BY_VARIABLE))
              .orElse("governance-bot");

      setStatus(entity, entityType, user, certification);
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
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
      if (oEntityCertification.isPresent()
          && oCertification.get().equals(oEntityCertification.get().getTagLabel().getTagFQN())) {
        return;
      }

      AssetCertification assetCertification =
          new AssetCertification()
              .withTagLabel(
                  new TagLabel()
                      .withTagFQN(certification)
                      .withSource(TagLabel.TagSource.CLASSIFICATION)
                      .withLabelType(TagLabel.LabelType.AUTOMATED)
                      .withState(TagLabel.State.CONFIRMED));
      entity.setCertification(assetCertification);
    }

    String updatedJson = JsonUtils.pojoToJson(entity);
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    entityRepository.patch(null, entity.getId(), user, patch);
  }
}
