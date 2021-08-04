/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.openmetadata.catalog.resources.CatalogResource.CollectionList;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.CollectionRegistry;
import org.openmetadata.catalog.type.CollectionDescriptor;
import org.openmetadata.catalog.type.CollectionInfo;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;
import java.util.Arrays;

@Path("/v1/services")
@Api(value = "Services collection", tags = "Services collection")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "services")
public class ServiceResource {
  private static CollectionList serviceList;
  public static CollectionList getServiceList(UriInfo uriInfo) throws JsonProcessingException {
    if (serviceList == null) {
      CollectionDescriptor[] services = CollectionRegistry.getInstance()
              .getCollectionForPath("/v1/services", uriInfo);
      serviceList = new CollectionList(Arrays.asList(services));
    }
    return serviceList;
  }

  @GET
  @Operation(summary = "List service collections", tags = "services",
          description = "Get a list of resources under service collection.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of serviceCollections",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CollectionInfo.class)))
          })
  public CollectionList getCollections(@Context UriInfo uriInfo) throws JsonProcessingException {
    return getServiceList(uriInfo);
  }
}
