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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.openlineage.FailedEvent;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageBatchRequest;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageResponse;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRunEvent;
import org.openmetadata.schema.api.lineage.openlineage.ProcessingSummary;
import org.openmetadata.schema.configuration.OpenLineageSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.openlineage.OpenLineageEntityResolver;
import org.openmetadata.service.openlineage.OpenLineageMapper;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.Authorizer;
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
@Collection(name = "openlineage", entityType = Entity.NONE)
public class OpenLineageResource {

  private static final String DEFAULT_PIPELINE_SERVICE = "openlineage";

  private final LineageRepository lineageRepository;
  private final Authorizer authorizer;

  public OpenLineageResource(Authorizer authorizer) {
    this.authorizer = authorizer;
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

  private OpenLineageMapper createMapper() {
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
        new OpenLineageEntityResolver(autoCreate, pipelineService, namespaceMapping);
    return new OpenLineageMapper(entityResolver, settings);
  }

  @POST
  @Path("/lineage")
  @Operation(
      operationId = "postOpenLineageEvent",
      summary = "Receive a single OpenLineage event",
      description =
          "Process a single OpenLineage RunEvent and create lineage edges in OpenMetadata. "
              + "Only COMPLETE events are processed by default.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Event processed successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = OpenLineageResponse.class))),
        @ApiResponse(responseCode = "400", description = "Invalid event format"),
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
    OpenLineageMapper mapper = createMapper();

    try {
      List<AddLineage> lineageRequests = mapper.mapRunEvent(event, updatedBy);

      int edgesCreated = 0;
      for (AddLineage addLineage : lineageRequests) {
        try {
          lineageRepository.addLineage(addLineage, updatedBy);
          edgesCreated++;
        } catch (Exception e) {
          LOG.warn("Failed to add lineage edge: {}", e.getMessage());
        }
      }

      OpenLineageResponse response =
          new OpenLineageResponse()
              .withStatus(OpenLineageResponse.Status.SUCCESS)
              .withMessage(
                  edgesCreated > 0
                      ? String.format("Created %d lineage edge(s)", edgesCreated)
                      : "Event processed, no lineage edges created")
              .withLineageEdgesCreated(edgesCreated);

      return Response.ok(response).build();

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
            description = "Batch processed",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = OpenLineageResponse.class))),
        @ApiResponse(responseCode = "400", description = "Invalid batch format"),
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
    OpenLineageMapper mapper = createMapper();

    int received = batch.getEvents().size();
    int successful = 0;
    int failed = 0;
    int skipped = 0;
    int totalEdgesCreated = 0;
    List<FailedEvent> failedEvents = new ArrayList<>();

    for (int i = 0; i < batch.getEvents().size(); i++) {
      OpenLineageRunEvent event = batch.getEvents().get(i);

      try {
        List<AddLineage> lineageRequests = mapper.mapRunEvent(event, updatedBy);

        if (lineageRequests.isEmpty()) {
          skipped++;
          continue;
        }

        int edgesCreated = 0;
        for (AddLineage addLineage : lineageRequests) {
          try {
            lineageRepository.addLineage(addLineage, updatedBy);
            edgesCreated++;
          } catch (Exception e) {
            LOG.warn("Failed to add lineage edge for event {}: {}", i, e.getMessage());
          }
        }

        if (edgesCreated > 0) {
          successful++;
          totalEdgesCreated += edgesCreated;
        } else {
          skipped++;
        }

      } catch (Exception e) {
        failed++;
        failedEvents.add(
            new FailedEvent().withIndex(i).withReason(e.getMessage()).withRetriable(false));
        LOG.warn("Failed to process event {}: {}", i, e.getMessage());
      }
    }

    ProcessingSummary summary =
        new ProcessingSummary()
            .withReceived(received)
            .withSuccessful(successful)
            .withFailed(failed)
            .withSkipped(skipped);

    OpenLineageResponse.Status status;
    if (failed == 0 && successful > 0) {
      status = OpenLineageResponse.Status.SUCCESS;
    } else if (failed > 0 && successful > 0) {
      status = OpenLineageResponse.Status.PARTIAL_SUCCESS;
    } else if (failed == received) {
      status = OpenLineageResponse.Status.FAILURE;
    } else {
      status = OpenLineageResponse.Status.SUCCESS;
    }

    OpenLineageResponse response =
        new OpenLineageResponse()
            .withStatus(status)
            .withMessage(
                String.format(
                    "Processed %d events: %d successful, %d failed, %d skipped. Created %d lineage edges.",
                    received, successful, failed, skipped, totalEdgesCreated))
            .withSummary(summary)
            .withFailedEvents(failedEvents.isEmpty() ? null : failedEvents)
            .withLineageEdgesCreated(totalEdgesCreated);

    return Response.ok(response).build();
  }
}
