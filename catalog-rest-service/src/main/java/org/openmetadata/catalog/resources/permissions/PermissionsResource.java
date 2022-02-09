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

package org.openmetadata.catalog.resources.permissions;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.SecurityContext;
import lombok.NonNull;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.Permissions;
import org.openmetadata.catalog.security.SecurityUtil;

@Path("/v1/permissions")
@Api(value = "Get permissions")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "permissions")
public class PermissionsResource {
  private final Authorizer authorizer;

  public PermissionsResource(CollectionDAO dao, @NonNull Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  @GET
  @Operation(
      summary = "Retrieves permissions for logged in user",
      tags = "general",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Permissions for logged in user",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Permissions.class)))
      })
  public Permissions getPermissions(@Context SecurityContext securityContext) {
    return new Permissions(authorizer.listPermissions(SecurityUtil.getAuthenticationContext(securityContext), null));
  }
}
