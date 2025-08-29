package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import jakarta.json.JsonPatch;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class SetGlossaryTermStatusImpl implements JavaDelegate {
  private Expression statusExpr;
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
      GlossaryTerm glossaryTerm = Entity.getEntity(entityLink, "*", Include.ALL);

      String status = (String) statusExpr.getValue(execution);
      String user =
          Optional.ofNullable(
                  (String)
                      varHandler.getNamespacedVariable(
                          inputNamespaceMap.get(UPDATED_BY_VARIABLE), UPDATED_BY_VARIABLE))
              .orElse("governance-bot");

      setStatus(glossaryTerm, user, status);
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private void setStatus(GlossaryTerm glossaryTerm, String user, String status) {
    if (!Objects.equals(status, glossaryTerm.getEntityStatus().value())) {
      String originalJson = JsonUtils.pojoToJson(glossaryTerm);

      glossaryTerm.setEntityStatus(EntityStatus.fromValue(status));
      String updatedJson = JsonUtils.pojoToJson(glossaryTerm);

      JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

      GlossaryTermRepository entityRepository =
          (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
      entityRepository.patch(null, glossaryTerm.getId(), user, patch);
    }
  }
}
