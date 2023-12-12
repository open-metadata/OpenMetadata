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

package org.openmetadata.service.resources.docstore;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import io.dropwizard.jersey.PATCH;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entities.docStore.CreateDocument;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.DocumentRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/docStore")
@Tag(name = "Document Store", description = "A `Document` is an generic entity in OpenMetadata.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "knowledgePanel", order = 2)
public class DocStoreResource extends EntityResource<Document, DocumentRepository> {

  public static final String COLLECTION_PATH = "/v1/docStore";

  @Override
  public Document addHref(UriInfo uriInfo, Document doc) {
    super.addHref(uriInfo, doc);
    return doc;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("data", MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.EDIT_ALL);
  }

  public DocStoreResource(Authorizer authorizer) {
    super(Entity.DOCUMENT, authorizer);
  }

  public static class DocumentList extends ResultList<Document> {
    /* Required for serde */
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Load any existing rules from database, before loading seed data.
    repository.initSeedDataFromResources();
  }

  @GET
  @Valid
  @Operation(
    operationId = "listDocuments",
    summary = "List Documents",
    description = "Get a list of Documents. Use `fields` " +
    "parameter to get only necessary fields. Use cursor-based pagination to limit the number " +
    "entries in the list using `limit` and `before` or `after` query params.",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "List of personas",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = DocumentList.class))
      )
    }
  )
  public ResultList<Document> list(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Limit the number of personas returned. (1 to 1000000, default = 10)") @DefaultValue(
      "10"
    ) @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
    @Parameter(
      description = "Filter docs by entityType",
      schema = @Schema(type = "string", example = "KnowledgePanel")
    ) @QueryParam("entityType") String entityType,
    @Parameter(
      description = "Filter docs by fqnPrefix",
      schema = @Schema(type = "string", example = "fqnPrefix")
    ) @QueryParam("fqnPrefix") String fqnPrefix,
    @Parameter(
      description = "Returns list of personas before this cursor",
      schema = @Schema(type = "string")
    ) @QueryParam("before") String before,
    @Parameter(
      description = "Returns list of personas after this cursor",
      schema = @Schema(type = "string")
    ) @QueryParam("after") String after
  ) {
    ListFilter filter = new ListFilter(Include.ALL);
    if (entityType != null) {
      filter.addQueryParam("entityType", entityType);
    }
    if (fqnPrefix != null) {
      filter.addQueryParam("fqnPrefix", fqnPrefix);
    }
    return super.listInternal(uriInfo, securityContext, "", filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
    operationId = "listAllDocumentVersion",
    summary = "List Document versions",
    description = "Get a list of all the versions of a Document identified by `id`",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "List of persona versions",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class))
      )
    }
  )
  public EntityHistory listVersions(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Id of the Document", schema = @Schema(type = "UUID")) @PathParam("id") UUID id
  ) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
    summary = "Get a Document by id",
    description = "Get a Document by `id`.",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "The Document",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = Document.class))
      ),
      @ApiResponse(responseCode = "404", description = "Document for instance {id} is not found")
    }
  )
  public Document get(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Id of the Document", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
    @Parameter(
      description = "Include all, deleted, or non-deleted entities.",
      schema = @Schema(implementation = Include.class)
    ) @QueryParam("include") @DefaultValue("non-deleted") Include include
  ) {
    return getInternal(uriInfo, securityContext, id, "", include);
  }

  @GET
  @Valid
  @Path("/name/{name}")
  @Operation(
    operationId = "getDocumentByFQN",
    summary = "Get a Document by name",
    description = "Get a Document by `name`.",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "The Document",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = Document.class))
      ),
      @ApiResponse(responseCode = "404", description = "Document for instance {name} is not found")
    }
  )
  public Document getByName(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Name of the Document", schema = @Schema(type = "string")) @PathParam("name") String name,
    @Parameter(
      description = "Include all, deleted, or non-deleted entities.",
      schema = @Schema(implementation = Include.class)
    ) @QueryParam("include") @DefaultValue("non-deleted") Include include
  ) {
    return getByNameInternal(uriInfo, securityContext, name, "", include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
    operationId = "getSpecificDocumentVersion",
    summary = "Get a version of the Document",
    description = "Get a version of the Document by given `id`",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "KnowledgePanel",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = Document.class))
      ),
      @ApiResponse(responseCode = "404", description = "Document for instance {id} and version {version} is not found")
    }
  )
  public Document getVersion(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Id of the Document", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
    @Parameter(
      description = "Document version number in the form `major`.`minor`",
      schema = @Schema(type = "string", example = "0.1 or 1.1")
    ) @PathParam("version") String version
  ) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
    operationId = "createDocument",
    summary = "Create a Document",
    description = "Create a new Document.",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "The Knowledge Panel.",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = Document.class))
      ),
      @ApiResponse(responseCode = "400", description = "Bad request")
    }
  )
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateDocument cd) {
    Document doc = getDocument(cd, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, doc);
  }

  @PUT
  @Operation(
    operationId = "createOrUpdateDocument",
    summary = "Update Document",
    description = "Create or Update a Document.",
    responses = {
      @ApiResponse(
        responseCode = "200",
        description = "The Document.",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = Document.class))
      ),
      @ApiResponse(responseCode = "400", description = "Bad request")
    }
  )
  public Response createOrUpdate(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Valid CreateDocument cd
  ) {
    Document doc = getDocument(cd, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, doc);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
    operationId = "patchDocument",
    summary = "Update a Document.",
    description = "Update an existing Document with JsonPatch.",
    externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902")
  )
  public Response patch(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Id of the Document", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
    @RequestBody(
      description = "JsonPatch with array of operations",
      content = @Content(
        mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
        examples = { @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]") }
      )
    ) JsonPatch patch
  ) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
    operationId = "deleteDocument",
    summary = "Delete a Document by id",
    description = "Delete a Document by given `id`.",
    responses = {
      @ApiResponse(responseCode = "200", description = "OK"),
      @ApiResponse(responseCode = "404", description = "Document for instance {id} is not found")
    }
  )
  public Response delete(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Id of the Document", schema = @Schema(type = "UUID")) @PathParam("id") UUID id
  ) {
    return delete(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
    operationId = "deleteDocumentByName",
    summary = "Delete a Document by name",
    description = "Delete a Document by given `name`.",
    responses = {
      @ApiResponse(responseCode = "200", description = "OK"),
      @ApiResponse(responseCode = "404", description = "Knowledge Panel for instance {name} is not found")
    }
  )
  public Response delete(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @Parameter(description = "Name of the Document", schema = @Schema(type = "string")) @PathParam("name") String name
  ) {
    return deleteByName(uriInfo, securityContext, name, false, true);
  }

  private Document getDocument(CreateDocument cd, String user) {
    return repository
      .copy(new Document(), cd, user)
      .withFullyQualifiedName(cd.getFullyQualifiedName())
      .withData(cd.getData())
      .withEntityType(cd.getEntityType());
  }
}
