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

package org.openmetadata.catalog.resources;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.util.Arrays;
import java.util.List;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.catalog.type.CollectionDescriptor;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1")
@Api(value = "All collections in the catalog application", tags = "All collections in the Catalog")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "root")
public class CatalogResource {
  public static class CollectionList extends ResultList<CollectionDescriptor> {
    @SuppressWarnings("unused") /* Required for tests */
    public CollectionList() {}

    public CollectionList(List<CollectionDescriptor> data) {
      super(data);
    }
  }

  private static CollectionList collectionList;

  public static CollectionList getCollectionList(UriInfo uriInfo) {
    if (collectionList == null) {
      CollectionDescriptor[] collections = CollectionRegistry.getInstance().getCollectionForPath("/v1", uriInfo);
      collectionList = new CollectionList(Arrays.asList(collections));
    }
    return collectionList;
  }

  @GET
  @Operation(
      summary = "List all collections",
      tags = "general",
      description =
          "List all the collections supported by OpenMetadata. This list provides all the collections "
              + "and resource REST endpoints.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "All collections",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = CollectionDescriptor.class)))
      })
  public CollectionList getCollections(@Context UriInfo uriInfo) {
    return getCollectionList(uriInfo);
  }
}
