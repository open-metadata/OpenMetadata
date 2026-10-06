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

package org.openmetadata.service.resources.lineage;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageBatchRequest;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageResponse;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRunEvent;
import org.openmetadata.schema.configuration.OpenLineageSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.openlineage.OpenLineageEntityCreator;
import org.openmetadata.service.openlineage.OpenLineageEntityResolver;
import org.openmetadata.service.openlineage.OpenLineageEventPlan;
import org.openmetadata.service.openlineage.OpenLineageMapper;
import org.openmetadata.service.openlineage.OpenLineageResponses;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
@Path("/v1/openlineage")
@Tag(
    name = "OpenLineage",
    description =
        "OpenLineage API for receiving lineage events from external systems like Spark, Airflow, etc.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "openlineage")
public class OpenLineageResource {

  private static final String DEFAULT_PIPELINE_SERVICE = "openlineage";

  private final LineageRepository lineageRepository;
  private final Authorizer authorizer;
  private final Limits limits;

  public OpenLineageResource(Authorizer authorizer, Limits limits) {
    this.authorizer = authorizer;
    this.limits = limits;
    this.lineageRepository = Entity.getLineageRepository();
  }

  private OpenLineageSettings getSettings() {
    return SettingsCache.getSettingOrDefault(
        SettingsType.OPEN_LINEAGE_SETTINGS,
        new OpenLineageSettings()
            .withEnabled(true)
            .withAutoCreateEntities(true)
            .withDefaultPipelineService(DEFAULT_PIPELINE_SERVICE),
        OpenLineageSettings.class);
  }

  private OpenLineageMapper createMapper(SecurityContext securityContext) {
    OpenLineageSettings settings = getSettings();

    boolean autoCreate =
        settings.getAutoCreateEntities() != null ? settings.getAutoCreateEntities() : true;
    String pipelineService =
        settings.getDefaultPipelineService() != null
            ? settings.getDefaultPipelineService()
            : DEFAULT_PIPELINE_SERVICE;

    Map<String, String> namespaceMapping =
        settings.getNamespaceToServiceMapping() != null
            ? settings.getNamespaceToServiceMapping().getAdditionalProperties()
            : null;

    OpenLineageEntityResolver entityResolver =
        new OpenLineageEntityResolver(
            autoCreate,
            pipelineService,
            namespaceMapping,
            new OpenLineageEntityCreator(
                (entityType, entity) -> authorizeCreate(securityContext, entityType, entity)));
    return new OpenLineageMapper(entityResolver, settings);
  }

  /**
   * EDIT_LINEAGE lets a caller post events, not create entities. Anything an event creates is held
   * to the checks a REST create by the same caller gets: plan limits, then CREATE against the
   * entity's persisted parent.
   */
  private void authorizeCreate(
      SecurityContext securityContext, String entityType, EntityInterface entity) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    CreateResourceContext<EntityInterface> resourceContext =
        new CreateResourceContext<>(entityType, entity);
    limits.enforceLimits(securityContext, resourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }

  @POST
  @Path("/lineage")
  @Operation(
      operationId = "postOpenLineageEvent",
      summary = "Receive a single OpenLineage event",
      description =
          "Process a single OpenLineage RunEvent and create lineage edges in OpenMetadata. "
              + "Only COMPLETE events are processed by default. Datasets that cannot be "
              + "resolved, or created under a mapped service, are listed in unresolvedDatasets.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description =
                "Event processed: status success, or partial_success when some datasets "
                    + "could not be resolved",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = OpenLineageResponse.class))),
        @ApiResponse(
            responseCode = "400",
            description =
                "Invalid event format, or no lineage edge could be created because the event's "
                    + "datasets could not be resolved",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = OpenLineageResponse.class))),
        @ApiResponse(responseCode = "403", description = "Not authorized to create lineage")
      })
  public Response postLineage(
      @Context SecurityContext securityContext, @Valid OpenLineageRunEvent event) {

    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.TABLE, MetadataOperation.EDIT_LINEAGE),
        new ResourceContext<>(Entity.TABLE));

    OpenLineageSettings settings = getSettings();
    if (!Boolean.TRUE.equals(settings.getEnabled())) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(
              new OpenLineageResponse()
                  .withStatus(OpenLineageResponse.Status.FAILURE)
                  .withMessage("OpenLineage API is disabled")
                  .withLineageEdgesCreated(0))
          .build();
    }

    String updatedBy = securityContext.getUserPrincipal().getName();
    OpenLineageMapper mapper = createMapper(securityContext);

    try {
      OpenLineageEventPlan plan = mapper.mapRunEvent(event, updatedBy);
      OpenLineageResponse response =
          OpenLineageResponses.forEvent(plan, addLineageEdges(plan, updatedBy));
      return Response.status(httpStatus(response.getStatus())).entity(response).build();

    } catch (Exception e) {
      LOG.error("Error processing OpenLineage event: {}", e.getMessage(), e);
      OpenLineageResponse response =
          new OpenLineageResponse()
              .withStatus(OpenLineageResponse.Status.FAILURE)
              .withMessage("Error processing event: " + e.getMessage())
              .withLineageEdgesCreated(0);

      return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(response).build();
    }
  }

  @POST
  @Path("/lineage/batch")
  @Operation(
      operationId = "postOpenLineageBatch",
      summary = "Receive multiple OpenLineage events",
      description =
          "Process multiple OpenLineage RunEvents in a single request. "
              + "Returns a summary of processed events including any failures.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Batch processed; failed events and unresolved datasets are listed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = OpenLineageResponse.class))),
        @ApiResponse(
            responseCode = "400",
            description = "Invalid batch format, or every event in the batch failed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = OpenLineageResponse.class))),
        @ApiResponse(responseCode = "403", description = "Not authorized to create lineage")
      })
  public Response postLineageBatch(
      @Context SecurityContext securityContext, @Valid OpenLineageBatchRequest batch) {

    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.TABLE, MetadataOperation.EDIT_LINEAGE),
        new ResourceContext<>(Entity.TABLE));

    OpenLineageSettings settings = getSettings();
    if (!Boolean.TRUE.equals(settings.getEnabled())) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(
              new OpenLineageResponse()
                  .withStatus(OpenLineageResponse.Status.FAILURE)
                  .withMessage("OpenLineage API is disabled")
                  .withLineageEdgesCreated(0))
          .build();
    }

    String updatedBy = securityContext.getUserPrincipal().getName();
    OpenLineageMapper mapper = createMapper(securityContext);

    OpenLineageResponses.BatchOutcome outcome =
        new OpenLineageResponses.BatchOutcome(batch.getEvents().size());
    for (int i = 0; i < batch.getEvents().size(); i++) {
      try {
        OpenLineageEventPlan plan = mapper.mapRunEvent(batch.getEvents().get(i), updatedBy);
        outcome.record(i, plan, addLineageEdges(plan, updatedBy));
      } catch (Exception e) {
        outcome.recordFailure(i, e.getMessage());
        LOG.warn("Failed to process event {}: {}", i, e.getMessage());
      }
    }

    Response.Status status = outcome.allFailed() ? Response.Status.BAD_REQUEST : Response.Status.OK;
    return Response.status(status).entity(outcome.toResponse()).build();
  }

  private int addLineageEdges(OpenLineageEventPlan plan, String updatedBy) {
    int edgesCreated = 0;
    for (AddLineage addLineage : plan.lineageRequests()) {
      try {
        lineageRepository.addLineage(addLineage, updatedBy);
        edgesCreated++;
      } catch (Exception e) {
        LOG.warn("Failed to add lineage edge: {}", e.getMessage());
      }
    }
    return edgesCreated;
  }

  /** An event that wrote nothing because its datasets did not resolve is the caller's to fix. */
  private static Response.Status httpStatus(OpenLineageResponse.Status status) {
    return status == OpenLineageResponse.Status.FAILURE
        ? Response.Status.BAD_REQUEST
        : Response.Status.OK;
  }
}
