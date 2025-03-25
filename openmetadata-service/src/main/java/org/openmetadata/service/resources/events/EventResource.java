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

package org.openmetadata.service.resources.events;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import lombok.Getter;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.Entity.EntityList;
import org.openmetadata.service.jdbi3.ChangeEventRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/events")
@Tag(
    name = "Events",
    description =
        "The `Events` are changes to metadata and are sent when entities are created, modified, or updated. External systems can subscribe to events using event subscription API over Webhooks, Slack, or Microsoft Teams.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "events")
public class EventResource {
  @Getter private final ChangeEventRepository repository;

  public static class EventList extends ResultList<ChangeEvent> {

    @SuppressWarnings("unused") /* Required for tests */
    public EventList() {}

    public EventList(List<ChangeEvent> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  public EventResource(Authorizer authorizer) {
    this.repository = Entity.getChangeEventRepository();
  }

  @GET
  @Valid
  @Operation(
      operationId = "listChangeEvents",
      summary = "Get change events",
      description =
          "Get a list of change events matching event types, entity type, from a given date",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EventList.class))),
        @ApiResponse(responseCode = "404", description = "Entity for instance {id} is not found")
      })
  public ResultList<ChangeEvent> get(
      @Context UriInfo uriInfo,
      @Parameter(
              description =
                  "List of comma separated entities requested for "
                      + "`entityCreated` event. When set to `*` all entities will be "
                      + "returned",
              schema = @Schema(type = "string", example = "table,dashboard,..."))
          @QueryParam("entityCreated")
          String entityCreated,
      @Parameter(
              description =
                  "List of comma separated entities requested for "
                      + "`entityUpdated` event. When set to `*` all entities will be "
                      + "returned",
              schema = @Schema(type = "string", example = "table,dashboard,..."))
          @QueryParam("entityUpdated")
          String entityUpdated,
      @Parameter(
              description =
                  "List of comma separated entities requested for "
                      + "`entityRestored` event. When set to `*` all entities will be "
                      + "returned",
              schema = @Schema(type = "string", example = "table,dashboard,..."))
          @QueryParam("entityRestored")
          String entityRestored,
      @Parameter(
              description =
                  "List of comma separated entities requested for "
                      + "`entityCreated` event. When set to `*` all entities will be "
                      + "returned",
              schema = @Schema(type = "string", example = "table,dashboard,..."))
          @QueryParam("entityDeleted")
          String entityDeleted,
      @Parameter(
              description = "Events starting from this unix timestamp in milliseconds",
              required = true,
              schema = @Schema(type = "long", example = "1426349294842"))
          @QueryParam("timestamp")
          long timestamp) {
    List<String> entityCreatedList = EntityList.getEntityList("entityCreated", entityCreated);
    List<String> entityUpdatedList = EntityList.getEntityList("entityUpdated", entityUpdated);
    List<String> entityRestoredList = EntityList.getEntityList("entityRestored", entityRestored);
    List<String> entityDeletedList = EntityList.getEntityList("entityDeleted", entityDeleted);
    List<ChangeEvent> events =
        repository.list(
            timestamp, entityCreatedList, entityUpdatedList, entityRestoredList, entityDeletedList);
    events.sort(EntityUtil.compareChangeEvent); // Sort change events based on time
    return new EventList(events, null, null, events.size());
  }
}
