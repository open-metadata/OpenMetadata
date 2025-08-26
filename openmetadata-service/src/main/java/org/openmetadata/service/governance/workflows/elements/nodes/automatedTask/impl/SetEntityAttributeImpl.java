package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityFieldUtils;

/**
 * Universal entity attribute setter for OpenMetadata workflows.
 *
 * Sets top-level entity fields properly by fetching actual entities from repositories.
 *
 * <h2>Supported Field Types:</h2>
 * <ul>
 *   <li><strong>Simple fields:</strong> description, displayName - direct value setting</li>
 *   <li><strong>Tags:</strong> Fetches Tag entities and creates proper TagLabels (APPENDS)</li>
 *   <li><strong>GlossaryTerms:</strong> Fetches GlossaryTerm entities and creates TagLabels (APPENDS)</li>
 *   <li><strong>Certification:</strong> Creates AssetCertification with proper TagLabel (REPLACES)</li>
 *   <li><strong>Tier:</strong> Manages Tier.* tags in tags array (REPLACES existing tier)</li>
 *   <li><strong>Owners:</strong> Fetches User/Team entities and creates EntityReferences</li>
 *   <li><strong>Reviewers:</strong> Fetches User/Team entities and creates EntityReferences</li>
 * </ul>
 *
 * <h2>Configuration Examples:</h2>
 * <pre>{@code
 * // Simple field
 * {
 *   "config": {
 *     "fieldName": "description",
 *     "fieldValue": "Updated description"
 *   }
 * }
 *
 * // Tags - provide FQN(s), will fetch actual Tag entities
 * {
 *   "config": {
 *     "fieldName": "tags",
 *     "fieldValue": "PII.Sensitive"  // or "PII.Sensitive, Quality.High"
 *   }
 * }
 *
 * // GlossaryTerms - provide FQN(s), will fetch actual GlossaryTerm entities
 * {
 *   "config": {
 *     "fieldName": "glossaryTerms",
 *     "fieldValue": "BusinessGlossary.Customer"
 *   }
 * }
 *
 * // Certification
 * {
 *   "config": {
 *     "fieldName": "certification",
 *     "fieldValue": "Certification.Gold"
 *   }
 * }
 *
 * // Tier
 * {
 *   "config": {
 *     "fieldName": "tier",
 *     "fieldValue": "Tier.Tier1"
 *   }
 * }
 *
 * // Owners - use format "user:name" or "team:name"
 * {
 *   "config": {
 *     "fieldName": "owners",
 *     "fieldValue": "user:john.doe, team:data-team"
 *   }
 * }
 *
 * // Reviewers - use format "user:name" or "team:name"
 * {
 *   "config": {
 *     "fieldName": "reviewers",
 *     "fieldValue": "user:jane.smith, user:bob.jones"
 *   }
 * }
 * }</pre>
 */
@Slf4j
public class SetEntityAttributeImpl implements JavaDelegate {
  private Expression fieldNameExpr;
  private Expression fieldValueExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      // Extract entity from workflow context
      Map<String, Object> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      String relatedEntityNamespace = (String) inputNamespaceMap.get(RELATED_ENTITY_VARIABLE);
      String relatedEntityValue =
          (String)
              varHandler.getNamespacedVariable(relatedEntityNamespace, RELATED_ENTITY_VARIABLE);
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(relatedEntityValue);

      String entityType = entityLink.getEntityType();
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

      String fieldName = (String) fieldNameExpr.getValue(execution);
      String fieldValue =
          fieldValueExpr.getValue(execution) != null
              ? (String) fieldValueExpr.getValue(execution)
              : null;

      String updatedByNamespace = (String) inputNamespaceMap.get(UPDATED_BY_VARIABLE);
      String user =
          Optional.ofNullable(updatedByNamespace)
              .map(ns -> (String) varHandler.getNamespacedVariable(ns, UPDATED_BY_VARIABLE))
              .orElse("governance-bot");

      // Apply the field change using shared utility
      EntityFieldUtils.setEntityField(entity, entityType, user, fieldName, fieldValue, true);

    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }
}
