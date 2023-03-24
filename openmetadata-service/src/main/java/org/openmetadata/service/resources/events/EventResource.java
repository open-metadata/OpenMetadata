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

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity.EntityList;
import org.openmetadata.service.jdbi3.ChangeEventRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/events")
@Api(value = "Events resource", tags = "events")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "events")
public class EventResource {

  @Getter private final ChangeEventRepository dao;
  private final Authorizer authorizer;

  public static class EventList extends ResultList<ChangeEvent> {

    @SuppressWarnings("unused") /* Required for tests */
    public EventList() {}

    public EventList(List<ChangeEvent> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  public EventResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "ChangeEventRepository must not be null");
    this.dao = new ChangeEventRepository(dao);
    this.authorizer = authorizer;
  }

  @GET
  @Valid
  @Operation(
      operationId = "listChangeEvents",
      summary = "Get change events",
      tags = "events",
      description = "Get a list of change events matching event types, entity type, from a given date",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EventList.class))),
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
                      + "`entityCreated` event. When set to `*` all entities will be "
                      + "returned",
              schema = @Schema(type = "string", example = "table,dashboard,..."))
          @QueryParam("entityUpdated")
          String entityUpdated,
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
          long timestamp)
      throws IOException {
    List<String> entityCreatedList = EntityList.getEntityList("entityCreated", entityCreated);
    List<String> entityUpdatedList = EntityList.getEntityList("entityUpdated", entityUpdated);
    List<String> entityDeletedList = EntityList.getEntityList("entityDeleted", entityDeleted);
    List<ChangeEvent> events = dao.list(timestamp, entityCreatedList, entityUpdatedList, entityDeletedList);
    events.sort(EntityUtil.compareChangeEvent); // Sort change events based on time
    return new EventList(events, null, null, events.size()); // TODO
  }
}
