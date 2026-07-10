/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.resources.csv;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.service.security.DefaultAuthorizer;

@Path("/v1/csv")
@Tag(name = "CSV", description = "CSV import and export metadata APIs.")
@Produces(MediaType.APPLICATION_JSON)
public class CsvDocumentationResource {
  @GET
  @Path("/documentation/{entityType}")
  @Operation(operationId = "getCsvDocumentation", summary = "Get CSV column documentation")
  public CsvDocumentation getCsvDocumentation(
      @Context SecurityContext securityContext,
      @PathParam("entityType") String entityType,
      @QueryParam("recursive") @DefaultValue("false") boolean recursive) {
    DefaultAuthorizer.getSubjectContext(securityContext);
    return EntityCsv.getCsvDocumentation(entityType, recursive);
  }
}
