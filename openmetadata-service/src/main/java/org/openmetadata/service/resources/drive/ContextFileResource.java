package org.openmetadata.service.resources.drive;

import static org.openmetadata.service.jdbi3.ContextFileRepository.CONTEXT_FILE_ENTITY;

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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.StreamingOutput;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.glassfish.jersey.media.multipart.FormDataContentDisposition;
import org.glassfish.jersey.media.multipart.FormDataParam;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.attachments.AssetServiceFactory;
import org.openmetadata.service.attachments.AzureAssetService;
import org.openmetadata.service.attachments.S3AssetService;
import org.openmetadata.service.drive.ContextFileExtractionService;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;

@Tag(name = "Drive Files", description = "APIs for managing files in the Context Center Drive.")
@Path("/v1/drive/files")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "driveFiles")
public class ContextFileResource extends EntityResource<ContextFile, ContextFileRepository> {
  public static final String COLLECTION_PATH = "v1/drive/files/";
  public static final String FIELDS = "owners,tags,folder,domains,followers,votes";
  private final ContextFileMapper mapper = new ContextFileMapper();
  private final ContextFileExtractionService extractionService;
  private long maxFileSize = 5 * 1024 * 1024L;

  public ContextFileResource(Authorizer authorizer, Limits limits) {
    super(CONTEXT_FILE_ENTITY, authorizer, limits);
    this.extractionService = new ContextFileExtractionService(repository);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    AssetServiceFactory.init(config);
    if (config.getObjectStorage() != null) {
      maxFileSize = config.getObjectStorage().getMaxFileSize();
    }
  }

  public static class ContextFileList extends ResultList<ContextFile> {}

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("folder", MetadataOperation.VIEW_BASIC);
    return List.of();
  }

  @Override
  public ContextFile addHref(UriInfo uriInfo, ContextFile file) {
    super.addHref(uriInfo, file);
    Entity.withHref(uriInfo, file.getFolder());
    return file;
  }

  @GET
  @Operation(
      operationId = "listDriveFiles",
      summary = "List files",
      responses = {
        @ApiResponse(
            responseCode = "200",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextFileList.class)))
      })
  public ResultList<ContextFile> list(
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
  @Operation(operationId = "getDriveFile", summary = "Get a file by ID")
  public ContextFile get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(operationId = "getDriveFileByFqn", summary = "Get a file by FQN")
  public ContextFile getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("fqn") String fqn,
      @QueryParam("fields") String fieldsParam,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @POST
  @Operation(operationId = "createDriveFile", summary = "Create a file entry")
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateContextFile createFile) {
    ContextFile file =
        mapper.createToEntity(createFile, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, file);
  }

  @PUT
  @Operation(operationId = "createOrUpdateDriveFile", summary = "Create or update a file")
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateContextFile createFile) {
    ContextFile file =
        mapper.createToEntity(createFile, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, file);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(operationId = "patchDriveFile", summary = "Update a file via JSON Patch")
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid jakarta.json.JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @POST
  @Path("/upload")
  @Consumes(MediaType.MULTIPART_FORM_DATA)
  @Operation(
      operationId = "uploadDriveFile",
      summary = "Upload a file to Drive",
      description = "Uploads a file to S3 and creates a ContextFile entity.",
      responses = {
        @ApiResponse(
            responseCode = "201",
            description = "File uploaded",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextFile.class)))
      })
  public Response uploadFile(
      @FormDataParam("file") InputStream fileInputStream,
      @FormDataParam("file") FormDataContentDisposition fileDetail,
      @FormDataParam("displayName") String displayName,
      @FormDataParam("description") String description,
      @FormDataParam("folder") String folderFqn,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext)
      throws IOException {
    String user = securityContext.getUserPrincipal().getName();
    String originalFileName =
        fileDetail.getFileName() != null ? fileDetail.getFileName() : fileDetail.getName();
    String contentType = URLConnection.guessContentTypeFromName(originalFileName);
    if (contentType == null) {
      contentType = "application/octet-stream";
    }
    String fileExtension = "";
    int dotIdx = originalFileName.lastIndexOf('.');
    if (dotIdx != -1) {
      fileExtension = originalFileName.substring(dotIdx + 1).toLowerCase();
    }

    AssetService assetService = AssetServiceFactory.getService();
    if (assetService == null) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"message\":\"Object storage is not configured\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }

    String pageName = ContextFileUploadSupport.sanitizeEntityName(originalFileName);
    ContextFileType fileType = ContextFileUploadSupport.detectFileType(contentType);

    CreateContextFile createFile = new CreateContextFile();
    createFile.setName(pageName);
    createFile.setDisplayName(displayName != null ? displayName : originalFileName);
    createFile.setDescription(description);
    createFile.setFileType(fileType);
    createFile.setContentType(contentType);
    createFile.setFileExtension(fileExtension);
    createFile.setProcessingStatus(ProcessingStatus.Uploaded);
    if (folderFqn != null && !folderFqn.isEmpty()) {
      createFile.setFolder(folderFqn);
    }

    try (ContextFileUploadSupport.BufferedUpload bufferedUpload =
        ContextFileUploadSupport.bufferUpload(fileInputStream, maxFileSize)) {
      createFile.setFileSize(Math.toIntExact(bufferedUpload.getSize()));

      ContextFile file = mapper.createToEntity(createFile, user);
      repository.prepareInternal(file, false);

      Asset asset =
          ContextFileUploadSupport.buildAsset(
              file, originalFileName, contentType, fileExtension, bufferedUpload.getSize(), user);
      ContextFileContent content =
          ContextFileUploadSupport.buildContent(file, asset, bufferedUpload.getChecksum(), user);
      file.setAssetId(asset.getId());
      file.setHeadContentId(content.getId().toString());

      boolean assetUploaded = false;
      boolean assetPersisted = false;
      boolean contentPersisted = false;
      ContextFile createdFile = null;
      try {
        try (InputStream uploadStream = bufferedUpload.newInputStream()) {
          assetService.upload(asset, uploadStream).join();
        }
        assetUploaded = true;
        repository.getAssetRepository().create(asset);
        assetPersisted = true;

        Response createResponse = create(uriInfo, securityContext, file);
        createdFile = (ContextFile) createResponse.getEntity();

        repository
            .getContentRepository()
            .create(null, content, user, ImpersonationContext.getImpersonatedBy());
        contentPersisted = true;
        extractionService.submit(createdFile.getId(), content.getId());
        return createResponse;
      } catch (Exception e) {
        if (contentPersisted) {
          try {
            repository.getContentRepository().delete(user, content.getId(), false, true);
          } catch (Exception ignored) {
            // Best-effort cleanup.
          }
        }
        if (createdFile != null) {
          cleanupFailedUpload(user, createdFile.getId());
        }
        if (assetPersisted) {
          try {
            repository.getAssetRepository().delete(asset.getId());
          } catch (Exception ignored) {
            // Best-effort cleanup.
          }
        }
        if (assetUploaded) {
          try {
            assetService.delete(asset).join();
          } catch (Exception ignored) {
            // Best-effort cleanup.
          }
        }
        throw e;
      }
    } catch (ContextFileUploadSupport.MaxFileSizeExceededException e) {
      return Response.status(Response.Status.REQUEST_ENTITY_TOO_LARGE)
          .entity(
              String.format(
                  "{\"message\":\"File size %d exceeds configured limit %d bytes\"}",
                  e.getActualSize(), e.getMaxFileSize()))
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
  }

  @GET
  @Path("/{id}/download")
  @Operation(operationId = "downloadDriveFile", summary = "Download a file by ID")
  public Response downloadFile(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @QueryParam("include") @DefaultValue("non-deleted") Include include,
      @QueryParam("redirect") @DefaultValue("true") boolean redirect,
      @QueryParam("expiry") @DefaultValue("300") int expirySeconds) {
    ContextFile file = getInternal(uriInfo, securityContext, id, "", include);
    Asset asset = resolveAsset(file);
    if (asset == null) {
      return Response.status(Response.Status.NOT_FOUND)
          .entity("{\"message\":\"No current content found for this file\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }

    AssetService assetService = AssetServiceFactory.getService();
    if (assetService == null) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"message\":\"Object storage is not configured\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }

    try {
      if (redirect && supportsRedirectDownload(assetService)) {
        String signedUrl =
            assetService.generateDownloadUrlWithExpiry(
                asset, Duration.ofSeconds(clampExpiry(expirySeconds)));
        if (signedUrl != null && !signedUrl.isEmpty()) {
          return Response.temporaryRedirect(URI.create(signedUrl)).build();
        }
      }

      InputStream fileStream = assetService.read(asset).join();
      if (fileStream == null) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity("{\"message\":\"No current content found for this file\"}")
            .type(MediaType.APPLICATION_JSON)
            .build();
      }

      StreamingOutput output =
          stream -> {
            try (InputStream input = fileStream) {
              input.transferTo(stream);
            } catch (IOException e) {
              throw new WebApplicationException("Failed to stream file content", e);
            }
          };

      return Response.ok(output, asset.getContentType())
          .header("Content-Disposition", buildContentDisposition(asset.getFileName()))
          .header("Content-Length", asset.getSize().longValue())
          .build();
    } catch (Exception e) {
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"message\":\"Failed to download file content\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
  }

  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteDriveFile", summary = "Delete a file")
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Parameter(description = "Permanently delete the file asynchronously.")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete) {
    if (hardDelete) {
      ContextFile file = getInternal(uriInfo, securityContext, id, "", Include.ALL);
      if (!Boolean.TRUE.equals(file.getDeleted())) {
        super.delete(uriInfo, securityContext, id, false, false);
      }
      return deleteByIdAsync(uriInfo, securityContext, id, false, true);
    }
    return super.delete(uriInfo, securityContext, id, false, false);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restoreDriveFile",
      summary = "Restore a soft deleted drive file",
      description = "Restore a drive file from the trash.")
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private Asset resolveAsset(ContextFile file) {
    if (file.getHeadContentId() != null && !file.getHeadContentId().isEmpty()) {
      ContextFileContent content = repository.getContentById(file.getHeadContentId());
      if (content != null && content.getAssetId() != null && !content.getAssetId().isEmpty()) {
        return repository.getAssetRepository().getById(content.getAssetId());
      }
    }
    if (file.getAssetId() != null && !file.getAssetId().isEmpty()) {
      return repository.getAssetRepository().getById(file.getAssetId());
    }
    return null;
  }

  private void cleanupFailedUpload(String user, UUID fileId) {
    try {
      repository.delete(user, fileId, false, true);
    } catch (Exception ignored) {
      // Best-effort cleanup after a partially completed upload.
    }
  }

  private boolean supportsRedirectDownload(AssetService assetService) {
    // The configured service is wrapped by QueuedDeleteAssetService, so unwrap to inspect the
    // real provider when deciding whether to issue a signed-URL redirect.
    AssetService unwrapped = AssetServiceFactory.unwrap(assetService);
    return unwrapped instanceof S3AssetService || unwrapped instanceof AzureAssetService;
  }

  static final int MAX_EXPIRY_SECONDS = 3600;

  /**
   * Sanitize a filename for use in the ASCII {@code filename="..."} parameter of a
   * Content-Disposition header. Strips header-injection characters (quotes, backslashes,
   * CR/LF) and falls back to "download" if the input is blank.
   */
  static String sanitizeFileName(String fileName) {
    if (fileName == null) {
      return "download";
    }
    String sanitized = fileName.replaceAll("[\"\\\\\\r\\n]", "_").trim();
    return sanitized.isEmpty() ? "download" : sanitized;
  }

  /**
   * Build a Content-Disposition value that is safe for non-ASCII filenames. Emits both
   * the legacy quoted {@code filename=} parameter (for older clients) and the RFC 5987
   * {@code filename*=UTF-8''...} parameter with percent-encoded bytes — so international
   * filenames round-trip while still being header-injection safe.
   */
  static String buildContentDisposition(String fileName) {
    String safeAscii = sanitizeFileName(fileName);
    String encoded = URLEncoder.encode(safeAscii, StandardCharsets.UTF_8).replace("+", "%20");
    return "attachment; filename=\"" + safeAscii + "\"; filename*=UTF-8''" + encoded;
  }

  /** Clamp expiry to [1, MAX_EXPIRY_SECONDS]. */
  static int clampExpiry(int expirySeconds) {
    return Math.max(1, Math.min(expirySeconds, MAX_EXPIRY_SECONDS));
  }
}
