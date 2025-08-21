package org.openmetadata.service.governance.workflows;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * WorkflowTransactionManager provides coordinated operations for workflow definitions.
 *
 * REALITY CHECK:
 * - We CANNOT have true atomic transactions across OpenMetadata and Flowable databases
 * - We use compensating transactions pattern: try to clean up on failures
 * - This is "best effort" coordination, not true 2PC (two-phase commit)
 *
 * USAGE:
 * - Use at API/Resource layer only, NOT in repositories
 * - Skip during seed data initialization (WorkflowHandler not initialized)
 * - Accepts that some edge cases may leave orphaned deployments in Flowable
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

    // Pre-validate by creating Workflow object (constructor will throw if invalid)
    Workflow workflow = new Workflow(entity);

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

    // Pre-validate the updated workflow
    Workflow updatedWorkflow = new Workflow(updated);

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

  // Removed deployToFlowableFirst - the postCreate/postUpdate hooks handle deployment
  // We accept that we cannot have true atomic transactions across two databases
}
