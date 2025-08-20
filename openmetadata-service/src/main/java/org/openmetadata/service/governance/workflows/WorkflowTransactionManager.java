package org.openmetadata.service.governance.workflows;

import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.converter.BpmnXMLConverter;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * WorkflowTransactionManager provides atomic operations for workflow definitions
 * across both OpenMetadata and Flowable databases.
 *
 * IMPORTANT DESIGN PRINCIPLES:
 * 1. This should ONLY be used at the API/Resource layer, NOT in repository methods
 * 2. This should NEVER be called during seed data initialization
 * 3. This manages the TOP-LEVEL transaction for workflow operations
 *
 * The problem we're solving:
 * - We need atomic operations across TWO databases (OpenMetadata and Flowable)
 * - If either operation fails, both should rollback
 * - But we must NOT interfere with seed data loading which has its own transaction management
 */
@Slf4j
public class WorkflowTransactionManager {

  /**
   * Create a workflow definition with atomic transaction across both databases.
   * This method should be called from WorkflowDefinitionResource, NOT from repository.
   */
  public static WorkflowDefinition createWorkflowDefinition(WorkflowDefinition entity) {
    // Get the repository
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    // Validate the workflow BEFORE starting any transaction
    Workflow workflow = new Workflow(entity);
    validateWorkflow(workflow);

    // Start a NEW transaction at the API level
    // This is the TOP-LEVEL transaction for this operation
    Jdbi jdbi = Entity.getJdbi();

    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          try {
            // Within this transaction, call the repository methods
            // The repository's postCreate will deploy to Flowable
            // Both operations happen within THIS transaction
            WorkflowDefinition created = repository.create(null, entity);

            LOG.info("Successfully created workflow definition: {}", entity.getName());
            return created;

          } catch (Exception e) {
            LOG.error("Failed to create workflow definition: {}", entity.getName(), e);
            // The transaction will rollback automatically
            throw new UnhandledServerException(
                "Failed to create workflow definition: " + e.getMessage(), e);
          }
        });
  }

  /**
   * Update a workflow definition with atomic transaction across both databases.
   * This method should be called from WorkflowDefinitionResource, NOT from repository.
   */
  public static WorkflowDefinition updateWorkflowDefinition(
      WorkflowDefinition original, WorkflowDefinition updated, String updatedBy) {

    // Get the repository
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    // Validate the updated workflow BEFORE starting transaction
    Workflow updatedWorkflow = new Workflow(updated);
    validateWorkflow(updatedWorkflow);

    // Start a NEW transaction at the API level
    Jdbi jdbi = Entity.getJdbi();

    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          try {
            // The repository's postUpdate will handle Flowable operations
            // Both DB operations happen within THIS transaction
            PutResponse<WorkflowDefinition> response =
                repository.update(null, original, updated, updatedBy);
            WorkflowDefinition result = response.getEntity();

            LOG.info("Successfully updated workflow definition: {}", updated.getName());
            return result;

          } catch (Exception e) {
            LOG.error("Failed to update workflow definition: {}", updated.getName(), e);
            // The transaction will rollback automatically
            throw new UnhandledServerException(
                "Failed to update workflow definition: " + e.getMessage(), e);
          }
        });
  }

  /**
   * Delete a workflow definition with atomic transaction across both databases.
   * This method should be called from WorkflowDefinitionResource, NOT from repository.
   */
  public static void deleteWorkflowDefinition(WorkflowDefinition entity, boolean hardDelete) {
    // Get the repository
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    // Start a NEW transaction at the API level
    Jdbi jdbi = Entity.getJdbi();

    jdbi.useTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          try {
            // The repository's postDelete will handle Flowable cleanup
            // Both operations happen within THIS transaction
            repository.delete("admin", entity.getId(), false, hardDelete);

            LOG.info("Successfully deleted workflow definition: {}", entity.getName());

          } catch (Exception e) {
            LOG.error("Failed to delete workflow definition: {}", entity.getName(), e);
            // The transaction will rollback automatically
            throw new UnhandledServerException(
                "Failed to delete workflow definition: " + e.getMessage(), e);
          }
        });
  }

  /**
   * Validate a workflow definition with Flowable.
   * This is done BEFORE starting any transaction.
   */
  private static void validateWorkflow(Workflow workflow) {
    if (!WorkflowHandler.isInitialized()) {
      throw new UnhandledServerException("WorkflowHandler is not initialized");
    }

    try {
      BpmnXMLConverter converter = new BpmnXMLConverter();
      String mainBpmnXml = new String(converter.convertToXML(workflow.getMainModel()));
      String triggerBpmnXml = new String(converter.convertToXML(workflow.getTriggerModel()));

      boolean valid =
          WorkflowHandler.getInstance().validateWorkflowDefinition(mainBpmnXml)
              && WorkflowHandler.getInstance().validateWorkflowDefinition(triggerBpmnXml);

      if (!valid) {
        throw new UnhandledServerException(
            "Invalid workflow definition: Failed Flowable validation");
      }
    } catch (Exception e) {
      LOG.error("Error validating workflow", e);
      throw new UnhandledServerException("Failed to validate workflow: " + e.getMessage(), e);
    }
  }
}
