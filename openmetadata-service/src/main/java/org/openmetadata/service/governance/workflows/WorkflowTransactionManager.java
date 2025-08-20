package org.openmetadata.service.governance.workflows;

import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.converter.BpmnXMLConverter;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

@Slf4j
public class WorkflowTransactionManager {

  /**
   * Atomically stores a workflow definition in OpenMetadata and deploys it to Flowable.
   * If either operation fails, both are rolled back.
   *
   * @param entity The workflow definition to store and deploy
   * @param update Whether this is an update operation
   * @return The stored and deployed workflow definition
   */
  public WorkflowDefinition storeAndDeployWorkflowDefinition(
      WorkflowDefinition entity, boolean update) {

    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    // First validate the workflow definition with Flowable before storing
    Workflow workflow = new Workflow(entity);
    BpmnXMLConverter converter = new BpmnXMLConverter();
    String mainBpmnXml = new String(converter.convertToXML(workflow.getMainModel()));
    String triggerBpmnXml = new String(converter.convertToXML(workflow.getTriggerModel()));

    if (!WorkflowHandler.getInstance().validateWorkflowDefinition(mainBpmnXml)
        || !WorkflowHandler.getInstance().validateWorkflowDefinition(triggerBpmnXml)) {
      throw new UnhandledServerException("Invalid workflow definition: Failed Flowable validation");
    }

    // Use transaction to store the entity
    Entity.getJdbi()
        .useTransaction(
            TransactionIsolationLevel.READ_COMMITTED,
            handle -> {
              try {
                // Store the entity in OpenMetadata DB using the parent storeEntity method
                repository.storeEntityInternal(entity, update);

                // Delete any existing workflow with the same name for clean replacement
                try {
                  WorkflowHandler.getInstance().deleteWorkflowDefinition(entity);
                } catch (Exception e) {
                  // Ignore if doesn't exist
                }

                // Deploy to Flowable
                WorkflowHandler.getInstance().deploy(workflow);

                LOG.info(
                    "Successfully stored and deployed workflow definition: {}", entity.getName());
              } catch (Exception e) {
                LOG.error(
                    "Failed to store and deploy workflow definition: {}", entity.getName(), e);
                // Rollback will happen automatically due to exception in transaction
                throw new UnhandledServerException(
                    "Failed to store and deploy workflow definition: " + e.getMessage());
              }
            });

    return entity;
  }

  /**
   * Atomically updates a workflow definition in OpenMetadata and redeploys it to Flowable.
   * If either operation fails, both are rolled back.
   *
   * @param original The original workflow definition
   * @param updated The updated workflow definition
   * @return The updated and redeployed workflow definition
   */
  public WorkflowDefinition updateAndRedeployWorkflowDefinition(
      WorkflowDefinition original, WorkflowDefinition updated) {

    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    // First validate the updated workflow definition
    Workflow updatedWorkflow = new Workflow(updated);
    BpmnXMLConverter converter = new BpmnXMLConverter();
    String mainBpmnXml = new String(converter.convertToXML(updatedWorkflow.getMainModel()));
    String triggerBpmnXml = new String(converter.convertToXML(updatedWorkflow.getTriggerModel()));

    if (!WorkflowHandler.getInstance().validateWorkflowDefinition(mainBpmnXml)
        || !WorkflowHandler.getInstance().validateWorkflowDefinition(triggerBpmnXml)) {
      throw new UnhandledServerException(
          "Invalid updated workflow definition: Failed Flowable validation");
    }

    // Use transaction to update the entity
    Entity.getJdbi()
        .useTransaction(
            TransactionIsolationLevel.READ_COMMITTED,
            handle -> {
              try {
                // Delete old deployment from Flowable first
                WorkflowHandler.getInstance().deleteWorkflowDefinition(original);

                // Update the entity in OpenMetadata DB using the parent storeEntity method
                repository.storeEntityInternal(updated, true);

                // Deploy updated version to Flowable
                WorkflowHandler.getInstance().deploy(updatedWorkflow);

                LOG.info(
                    "Successfully updated and redeployed workflow definition: {}",
                    updated.getName());
              } catch (Exception e) {
                LOG.error(
                    "Failed to update and redeploy workflow definition: {}", updated.getName(), e);

                // Try to restore original deployment
                try {
                  WorkflowHandler.getInstance().deploy(new Workflow(original));
                  LOG.info("Restored original workflow deployment for: {}", original.getName());
                } catch (Exception restoreEx) {
                  LOG.error(
                      "Failed to restore original workflow deployment: {}",
                      original.getName(),
                      restoreEx);
                }

                throw new UnhandledServerException(
                    "Failed to update and redeploy workflow definition: " + e.getMessage());
              }
            });

    return updated;
  }

  /**
   * Atomically deletes a workflow definition from OpenMetadata and undeploys it from Flowable.
   *
   * @param entity The workflow definition to delete
   */
  public void deleteWorkflowDefinition(WorkflowDefinition entity) {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    Entity.getJdbi()
        .useTransaction(
            TransactionIsolationLevel.READ_COMMITTED,
            handle -> {
              try {
                // Delete from Flowable first
                WorkflowHandler.getInstance().deleteWorkflowDefinition(entity);

                // Delete from OpenMetadata DB
                repository.delete("admin", entity.getId(), false, false);

                LOG.info("Successfully deleted workflow definition: {}", entity.getName());
              } catch (Exception e) {
                LOG.error("Failed to delete workflow definition: {}", entity.getName(), e);
                throw new UnhandledServerException(
                    "Failed to delete workflow definition: " + e.getMessage());
              }
            });
  }
}
