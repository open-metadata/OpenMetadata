package org.openmetadata.service.resources.drive;

import static org.openmetadata.service.jdbi3.FolderRepository.FOLDER_ENTITY;

import org.openmetadata.service.jdbi3.FolderRepository;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Folder;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Tag(name = "Drive Folders", description = "APIs for managing folders in the Context Center Drive.")
@Path("/v1/drive/folders")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "driveFolders")
public class FolderResource extends EntityResource<Folder, FolderRepository> {
  public static final String COLLECTION_PATH = "v1/drive/folders/";
  public static final String FIELDS = "owners,tags,parent,children,domains,followers";
  private final FolderMapper mapper = new FolderMapper();

  public static class FolderContents {
    public Folder folder;
    public List<Folder> folders;
    public List<ContextFile> files;
    public int childrenFolderCount;
    public int childrenFileCount;
    public int itemCount;
  }

  public FolderResource(Authorizer authorizer, Limits limits) {
    super(FOLDER_ENTITY, authorizer, limits);
  }

  public static class FolderList extends ResultList<Folder> {}

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("parent,children", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  public Folder addHref(UriInfo uriInfo, Folder folder) {
    super.addHref(uriInfo, folder);
    Entity.withHref(uriInfo, folder.getParent());
    Entity.withHref(uriInfo, folder.getChildren());
    return folder;
  }

  @GET
  @Operation(
      operationId = "listDriveFolders",
      summary = "List folders",
      responses = {
        @ApiResponse(
            responseCode = "200",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = FolderList.class)))
      })
  public ResultList<Folder> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("limit") @DefaultValue("10") int limit,
      @QueryParam("before") String before,
      @QueryParam("after") String after,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, new ListFilter(include), limit, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(operationId = "getDriveFolder", summary = "Get a folder by ID")
  public Folder get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(operationId = "getDriveFolderByFqn", summary = "Get a folder by FQN")
  public Folder getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("fqn") String fqn,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/contents")
  @Operation(
      operationId = "getDriveFolderContents",
      summary = "Get the direct contents of a folder")
  public FolderContents getContents(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    Folder folder = getInternal(uriInfo, securityContext, id, "parent,children", include);
    List<Folder> folders = repository.getChildFolderEntities(folder);
    List<ContextFile> files = repository.getChildFileEntities(folder);

    FolderContents response = new FolderContents();
    response.folder = folder;
    response.folders = folders;
    response.files = files;
    response.childrenFolderCount = folders.size();
    response.childrenFileCount = files.size();
    response.itemCount = folders.size() + files.size();
    return response;
  }

  @POST
  @Operation(operationId = "createDriveFolder", summary = "Create a folder")
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateFolder create) {
    Folder folder = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, folder);
  }

  @PUT
  @Operation(operationId = "createOrUpdateDriveFolder", summary = "Create or update a folder")
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateFolder create) {
    Folder folder = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, folder);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchDriveFolder", summary = "Update a folder via JSON Patch")
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid jakarta.json.JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteDriveFolder", summary = "Delete a folder")
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("recursive") @DefaultValue("false") boolean recursive,
      @Parameter(description = "Permanently delete the folder asynchronously.")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete) {
    if (hardDelete) {
      Folder folder = getInternal(uriInfo, securityContext, id, "", Include.ALL);
      if (!Boolean.TRUE.equals(folder.getDeleted())) {
        super.delete(uriInfo, securityContext, id, recursive, false);
      }
      return deleteByIdAsync(uriInfo, securityContext, id, recursive, true);
    }
    return super.delete(uriInfo, securityContext, id, recursive, false);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreDriveFolder",
      summary = "Restore a soft deleted drive folder",
      description = "Restore a folder from the trash.")
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
