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

package org.openmetadata.catalog.resources.events;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Date;
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
import org.openmetadata.catalog.Entity.EntityList;
import org.openmetadata.catalog.jdbi3.ChangeEventRepository;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/events")
@Api(value = "Events resource", tags = "events")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "events")
public class EventResource {
  private final ChangeEventRepository dao;
  private final Authorizer authorizer;

  public static class ChangeEventList extends ResultList<ChangeEvent> {

    @SuppressWarnings("unused") /* Required for tests */
    public ChangeEventList() {}

    public ChangeEventList(List<ChangeEvent> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
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
      summary = "Get change events",
      tags = "events",
      description = "Get a list of change events matching event types, entity type, from a given date",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity events",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
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
              description = "Events starting from this date time in ISO8601 format",
              required = true,
              schema = @Schema(type = "string", example = "2021-01-28T10:00:00.000000Z"))
          @QueryParam("date")
          String date)
      throws IOException, GeneralSecurityException, ParseException {
    Date parsedDate = RestUtil.DATE_TIME_FORMAT.parse(date);
    List<String> entityCreatedList = EntityList.getEntityList("entityCreated", entityCreated);
    List<String> entityUpdatedList = EntityList.getEntityList("entityUpdated", entityUpdated);
    List<String> entityDeletedList = EntityList.getEntityList("entityDeleted", entityDeleted);
    return dao.list(parsedDate, entityCreatedList, entityUpdatedList, entityDeletedList);
  }
}
