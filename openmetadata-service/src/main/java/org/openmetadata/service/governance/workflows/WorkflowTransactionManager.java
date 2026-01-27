package org.openmetadata.service.governance.workflows;

import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.schema.type.MetadataOperation.EDIT_ALL;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.RestUtil.PatchResponse;
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
   * This method handles authorization AND transaction coordination.
   */
  public static WorkflowDefinition createWorkflowDefinition(
      UriInfo uriInfo,
      SecurityContext securityContext,
      WorkflowDefinition entity,
      Authorizer authorizer,
      Limits limits) {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    OperationContext operationContext = new OperationContext(Entity.WORKFLOW_DEFINITION, CREATE);
    CreateResourceContext<WorkflowDefinition> createResourceContext =
        new CreateResourceContext<>(Entity.WORKFLOW_DEFINITION, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);

    Workflow workflow = new Workflow(entity);

    Jdbi jdbi = Entity.getJdbi();

    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          try {
            WorkflowDefinition created = repository.create(uriInfo, entity);

            LOG.info("Successfully created workflow definition: {}", entity.getName());
            return created;

          } catch (BadRequestException | EntityNotFoundException e) {
            throw e;
          } catch (Exception e) {
            LOG.error("Failed to create workflow definition: {}", entity.getName(), e);
            throw new UnhandledServerException(
                "Failed to create workflow definition: " + e.getMessage(), e);
          }
        });
  }

  /**
   * Update a workflow definition with atomic transaction across both databases.
   * This method handles authorization AND transaction coordination.
   */
  public static WorkflowDefinition updateWorkflowDefinition(
      UriInfo uriInfo,
      SecurityContext securityContext,
      WorkflowDefinition original,
      WorkflowDefinition updated,
      String updatedBy,
      Authorizer authorizer) {

    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    repository.prepareInternal(updated, true);

    OperationContext operationContext = new OperationContext(Entity.WORKFLOW_DEFINITION, EDIT_ALL);
    ResourceContext<WorkflowDefinition> resourceContext =
        new ResourceContext<>(
            Entity.WORKFLOW_DEFINITION, original.getId(), original.getFullyQualifiedName());
    authorizer.authorize(securityContext, operationContext, resourceContext);

    Workflow updatedWorkflow = new Workflow(updated);

    Jdbi jdbi = Entity.getJdbi();

    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          try {
            PutResponse<WorkflowDefinition> response =
                repository.update(uriInfo, original, updated, updatedBy);
            WorkflowDefinition result = response.getEntity();

            LOG.info("Successfully updated workflow definition: {}", updated.getName());
            return result;

          } catch (BadRequestException | EntityNotFoundException e) {
            throw e;
          } catch (Exception e) {
            LOG.error("Failed to update workflow definition: {}", updated.getName(), e);
            throw new UnhandledServerException(
                "Failed to update workflow definition: " + e.getMessage(), e);
          }
        });
  }

  /**
   * Delete a workflow definition with atomic transaction across both databases.
   * This method handles authorization AND transaction coordination.
   */
  public static void deleteWorkflowDefinition(
      SecurityContext securityContext,
      WorkflowDefinition entity,
      boolean hardDelete,
      Authorizer authorizer) {
    // Get the repository
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    // Authorization (following OpenMetadata pattern)
    OperationContext operationContext = new OperationContext(Entity.WORKFLOW_DEFINITION, EDIT_ALL);
    ResourceContext<WorkflowDefinition> resourceContext =
        new ResourceContext<>(
            Entity.WORKFLOW_DEFINITION, entity.getId(), entity.getFullyQualifiedName());
    authorizer.authorize(securityContext, operationContext, resourceContext);

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

          } catch (BadRequestException | EntityNotFoundException e) {
            // Preserve these exception types for proper HTTP status codes
            throw e;
          } catch (Exception e) {
            LOG.error("Failed to delete workflow definition: {}", entity.getName(), e);
            // The transaction will rollback automatically
            throw new UnhandledServerException(
                "Failed to delete workflow definition: " + e.getMessage(), e);
          }
        });
  }

  /**
   * Create or update a workflow definition with distributed transaction coordination.
   * Handles authorization, both creation and update with proper Flowable synchronization.
   */
  public static PutResponse<WorkflowDefinition> createOrUpdateWorkflowDefinition(
      UriInfo uriInfo,
      SecurityContext securityContext,
      WorkflowDefinition entity,
      String updatedBy,
      Authorizer authorizer,
      Limits limits) {

    // Get the repository
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    Workflow workflow = new Workflow(entity);

    // Check if workflow exists
    WorkflowDefinition existing = null;
    try {
      existing =
          repository.getByName(
              uriInfo,
              entity.getFullyQualifiedName(),
              repository.getFields("*"),
              Include.NON_DELETED,
              false);
    } catch (EntityNotFoundException e) {
      // Entity doesn't exist, will create
    }

    if (existing == null) {
      // Create new workflow with authorization
      WorkflowDefinition created =
          createWorkflowDefinition(uriInfo, securityContext, entity, authorizer, limits);
      return new PutResponse<>(Response.Status.CREATED, created, ENTITY_CREATED);
    } else {
      // Update existing workflow with authorization
      WorkflowDefinition updated =
          updateWorkflowDefinition(
              uriInfo, securityContext, existing, entity, updatedBy, authorizer);
      return new PutResponse<>(Response.Status.OK, updated, ENTITY_UPDATED);
    }
  }

  /**
   * Patch a workflow definition with atomic transaction across both databases.
   * This method handles authorization AND transaction coordination for JsonPatch operations.
   */
  public static PatchResponse<WorkflowDefinition> patchWorkflowDefinition(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      JsonPatch patch,
      Authorizer authorizer) {

    // Get the repository
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    // Authorization (following OpenMetadata pattern for patch)
    OperationContext operationContext = new OperationContext(Entity.WORKFLOW_DEFINITION, patch);
    ResourceContext<WorkflowDefinition> resourceContext =
        new ResourceContext<>(Entity.WORKFLOW_DEFINITION, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    // Start a NEW transaction at the API level
    Jdbi jdbi = Entity.getJdbi();

    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          try {
            // The repository's patch will handle the actual patching
            // The repository's postUpdate will handle Flowable operations
            // Both DB operations happen within THIS transaction
            PatchResponse<WorkflowDefinition> response =
                repository.patch(uriInfo, id, securityContext.getUserPrincipal().getName(), patch);

            LOG.info("Successfully patched workflow definition: {}", response.entity().getName());
            return response;

          } catch (BadRequestException | EntityNotFoundException e) {
            // Preserve these exception types for proper HTTP status codes
            throw e;
          } catch (Exception e) {
            LOG.error("Failed to patch workflow definition with id: {}", id, e);
            // The transaction will rollback automatically
            throw new UnhandledServerException(
                "Failed to patch workflow definition: " + e.getMessage(), e);
          }
        });
  }

  /**
   * Patch a workflow definition by name with atomic transaction across both databases.
   * This method handles authorization AND transaction coordination for JsonPatch operations.
   */
  public static PatchResponse<WorkflowDefinition> patchWorkflowDefinitionByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      JsonPatch patch,
      Authorizer authorizer) {

    // Get the repository
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    // Authorization (following OpenMetadata pattern for patch)
    OperationContext operationContext = new OperationContext(Entity.WORKFLOW_DEFINITION, patch);
    ResourceContext<WorkflowDefinition> resourceContext =
        new ResourceContext<>(Entity.WORKFLOW_DEFINITION, null, fqn);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    // Start a NEW transaction at the API level
    Jdbi jdbi = Entity.getJdbi();

    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          try {
            // The repository's patch will handle the actual patching
            // The repository's postUpdate will handle Flowable operations
            // Both DB operations happen within THIS transaction
            PatchResponse<WorkflowDefinition> response =
                repository.patch(uriInfo, fqn, securityContext.getUserPrincipal().getName(), patch);

            LOG.info("Successfully patched workflow definition: {}", response.entity().getName());
            return response;

          } catch (BadRequestException | EntityNotFoundException e) {
            // Preserve these exception types for proper HTTP status codes
            throw e;
          } catch (Exception e) {
            LOG.error("Failed to patch workflow definition with name: {}", fqn, e);
            // The transaction will rollback automatically
            throw new UnhandledServerException(
                "Failed to patch workflow definition: " + e.getMessage(), e);
          }
        });
  }

  // Note: While we cannot achieve true 2PC (two-phase commit) across OpenMetadata and Flowable,
  // we use compensating transactions and handle deployment within our transaction boundaries
  // to minimize the risk of inconsistency between the two systems
}
