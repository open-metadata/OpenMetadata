/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.services.governance;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowTransactionManager;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.governance.WorkflowDefinitionMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;

@Slf4j
@Singleton
@Service(entityType = Entity.WORKFLOW_DEFINITION)
public class WorkflowDefinitionService
    extends EntityBaseService<WorkflowDefinition, WorkflowDefinitionRepository> {

  @Getter private final WorkflowDefinitionMapper mapper;
  public static final String FIELDS = "owners";

  @Inject
  public WorkflowDefinitionService(
      WorkflowDefinitionRepository repository,
      Authorizer authorizer,
      WorkflowDefinitionMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.WORKFLOW_DEFINITION, WorkflowDefinition.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    repository.initSeedDataFromResources();
  }

  public Response redeploy(UriInfo uriInfo, UUID id) {
    WorkflowDefinition wd =
        repository.get(
            uriInfo,
            id,
            new EntityUtil.Fields(repository.getAllowedFields()),
            Include.NON_DELETED,
            false);
    WorkflowHandler.getInstance().deleteWorkflowDefinition(wd);
    WorkflowHandler.getInstance().deploy(new Workflow(wd));
    return Response.status(Response.Status.OK).entity("Workflow Redeployed").build();
  }

  public Response createWorkflow(
      UriInfo uriInfo, SecurityContext securityContext, WorkflowDefinition workflowDefinition) {
    WorkflowDefinition created =
        WorkflowTransactionManager.createWorkflowDefinition(
            uriInfo, securityContext, workflowDefinition, authorizer, limits);
    return Response.status(Response.Status.CREATED)
        .entity(repository.withHref(uriInfo, created))
        .build();
  }

  public Response patchWorkflow(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, JsonPatch patch) {
    PatchResponse<WorkflowDefinition> response =
        WorkflowTransactionManager.patchWorkflowDefinition(
            uriInfo, securityContext, id, patch, authorizer);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response patchWorkflowByName(
      UriInfo uriInfo, SecurityContext securityContext, String fqn, JsonPatch patch) {
    PatchResponse<WorkflowDefinition> response =
        WorkflowTransactionManager.patchWorkflowDefinitionByName(
            uriInfo, securityContext, fqn, patch, authorizer);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response createOrUpdateWorkflow(
      UriInfo uriInfo, SecurityContext securityContext, WorkflowDefinition workflowDefinition) {
    String updatedBy = securityContext.getUserPrincipal().getName();
    PutResponse<WorkflowDefinition> response =
        WorkflowTransactionManager.createOrUpdateWorkflowDefinition(
            uriInfo, securityContext, workflowDefinition, updatedBy, authorizer, limits);
    return Response.status(response.getStatus())
        .entity(repository.withHref(uriInfo, response.getEntity()))
        .build();
  }

  public Response deleteWorkflow(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, boolean hardDelete) {
    WorkflowDefinition workflow =
        repository.get(uriInfo, id, new EntityUtil.Fields(repository.getAllowedFields()));
    WorkflowTransactionManager.deleteWorkflowDefinition(
        securityContext, workflow, hardDelete, authorizer);
    return Response.ok().build();
  }

  public Response deleteWorkflowByName(
      UriInfo uriInfo, SecurityContext securityContext, String fqn, boolean hardDelete) {
    WorkflowDefinition workflow =
        repository.getByName(uriInfo, fqn, new EntityUtil.Fields(repository.getAllowedFields()));
    WorkflowTransactionManager.deleteWorkflowDefinition(
        securityContext, workflow, hardDelete, authorizer);
    return Response.ok().build();
  }

  public Response validateWorkflow(
      SecurityContext securityContext, WorkflowDefinition workflowDefinition) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_ALL);
    ResourceContext<WorkflowDefinition> resourceContext = new ResourceContext<>(entityType);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    repository.validateWorkflow(workflowDefinition);

    return Response.ok()
        .entity(
            Map.of(
                "status", "valid",
                "message", "Workflow validation successful",
                "validatedAt", System.currentTimeMillis()))
        .build();
  }

  public Response triggerWorkflow(UriInfo uriInfo, String fqn) {
    try {
      WorkflowDefinition workflow =
          repository.getByName(uriInfo, fqn, repository.getFields("suspended"));
      if (workflow.getSuspended() != null && workflow.getSuspended()) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(
                Map.of(
                    "status", "error",
                    "workflow", fqn,
                    "message",
                        "Cannot trigger suspended workflow. Please resume the workflow first.",
                    "code", "WORKFLOW_SUSPENDED"))
            .build();
      }

      boolean triggerResponse = WorkflowHandler.getInstance().triggerWorkflow(fqn);
      if (triggerResponse) {
        return Response.status(Response.Status.OK)
            .entity(
                Map.of(
                    "status",
                    "success",
                    "workflow",
                    fqn,
                    "message",
                    "Workflow triggered successfully",
                    "triggeredAt",
                    System.currentTimeMillis()))
            .build();
      } else {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(
                Map.of(
                    "status", "error",
                    "workflow", fqn,
                    "message",
                        "Failed to trigger workflow. The workflow may not be deployed or may have configuration issues.",
                    "code", "TRIGGER_FAILED"))
            .build();
      }
    } catch (EntityNotFoundException e) {
      return Response.status(Response.Status.NOT_FOUND)
          .entity(
              Map.of(
                  "status", "error",
                  "workflow", fqn,
                  "message", "Workflow Definition not found",
                  "code", "WORKFLOW_NOT_FOUND"))
          .build();
    }
  }

  public Response suspendWorkflow(UriInfo uriInfo, SecurityContext securityContext, String fqn) {
    WorkflowDefinition workflow = repository.getByName(uriInfo, fqn, repository.getFields("id"));

    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    ResourceContext<WorkflowDefinition> resourceContext =
        new ResourceContext<>(entityType, workflow.getId(), workflow.getName());
    authorizer.authorize(securityContext, operationContext, resourceContext);

    repository.suspendWorkflow(workflow);

    return Response.ok()
        .entity(
            Map.of(
                "status",
                "suspended",
                "workflow",
                fqn,
                "message",
                "Workflow suspended successfully",
                "suspendedAt",
                System.currentTimeMillis()))
        .build();
  }

  public Response resumeWorkflow(UriInfo uriInfo, SecurityContext securityContext, String fqn) {
    WorkflowDefinition workflow = repository.getByName(uriInfo, fqn, repository.getFields("id"));

    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    ResourceContext<WorkflowDefinition> resourceContext =
        new ResourceContext<>(entityType, workflow.getId(), workflow.getName());
    authorizer.authorize(securityContext, operationContext, resourceContext);

    repository.resumeWorkflow(workflow);

    return Response.ok()
        .entity(
            Map.of(
                "status",
                "resumed",
                "workflow",
                fqn,
                "message",
                "Workflow resumed successfully",
                "resumedAt",
                System.currentTimeMillis()))
        .build();
  }

  public static class WorkflowDefinitionList extends ResultList<WorkflowDefinition> {}
}
