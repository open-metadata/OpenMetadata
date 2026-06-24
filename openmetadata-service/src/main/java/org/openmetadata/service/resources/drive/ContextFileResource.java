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
import java.io.OutputStream;
import java.net.URI;
import java.net.URLConnection;
import java.nio.file.Files;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.media.multipart.FormDataContentDisposition;
import org.glassfish.jersey.media.multipart.FormDataParam;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.MoveContextFileRequest;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.attachments.AssetServiceFactory;
import org.openmetadata.service.attachments.AzureAssetService;
import org.openmetadata.service.attachments.S3AssetService;
import org.openmetadata.service.drive.ContextFileProcessingService;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;

@Tag(
    name = "Context Center Drive Files",
    description = "APIs for managing files in the Context Center Drive.")
@Path("/v1/contextCenter/drive/files")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "contextCenterDriveFiles")
@Slf4j
public class ContextFileResource extends EntityResource<ContextFile, ContextFileRepository> {
  public static final String COLLECTION_PATH = "v1/contextCenter/drive/files/";
  public static final String FIELDS = "owners,tags,folder,domains,followers,votes";
  private final ContextFileMapper mapper = new ContextFileMapper();
  private final ContextFileProcessingService extractionService;
  private long maxFileSize = 5 * 1024 * 1024L;

  public ContextFileResource(Authorizer authorizer, Limits limits) {
    super(CONTEXT_FILE_ENTITY, authorizer, limits);
    this.extractionService = new ContextFileProcessingService(repository);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    AssetServiceFactory.init(config);
    if (config.getObjectStorage() != null) {
      maxFileSize = config.getObjectStorage().getMaxFileSize();
    }
    extractionService.recoverInterruptedProcessing();
  }

  public static class ContextFileList extends ResultList<ContextFile> {}

  public static class BulkFileIdsRequest {
    public List<UUID> ids;
  }

  public static class BulkDeleteFilesRequest extends BulkFileIdsRequest {
    public Boolean hardDelete;
  }

  public static class BulkMoveFilesRequest extends BulkFileIdsRequest {
    public EntityReference folder;
  }

  public static class BulkDownloadFilesRequest extends BulkFileIdsRequest {
    public String fileName;
  }

  private record ResolvedDownloadEntry(ContextFile file, Asset asset) {}

  private record DownloadEntry(ContextFile file, Asset asset, java.nio.file.Path contentPath) {}

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
      @QueryParam("include") @DefaultValue("non-deleted") Include include,
      @Parameter(description = "Sort files by updatedAt. Supported values: ASC, DESC.")
          @QueryParam("orderBy")
          String orderBy) {
    ListFilter filter = new ListFilter(include);
    if (orderBy == null || orderBy.isBlank()) {
      return super.listInternal(
          uriInfo, securityContext, fieldsParam, filter, limit, before, after);
    }

    RestUtil.validateCursors(before, after);
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(entityType, getViewOperations(fields));
    ResourceContextInterface resourceContext = filter.getResourceContext(entityType);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    EntityUtil.addDomainQueryParam(securityContext, filter, entityType);
    ResultList<ContextFile> resultList =
        repository.listByUpdatedAt(
            uriInfo, fields, filter, limit, before, after, resolveOrderBy(orderBy));
    return addHref(uriInfo, resultList);
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

    ContextFile file = mapper.createToEntity(createFile, user);
    repository.prepareInternal(file, false);
    repository.validateNoDuplicateFileName(originalFileName, file.getFolder(), null);

    try (ContextFileUploadSupport.BufferedUpload bufferedUpload =
        ContextFileUploadSupport.bufferUpload(fileInputStream, maxFileSize)) {
      createFile.setFileSize(Math.toIntExact(bufferedUpload.getSize()));
      file.setFileSize(createFile.getFileSize());

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

      Response.ResponseBuilder responseBuilder =
          Response.ok(output, asset.getContentType())
              .header("Content-Disposition", buildContentDisposition(asset.getFileName()));
      if (asset.getSize() != null) {
        responseBuilder.header("Content-Length", asset.getSize().longValue());
      }
      return responseBuilder.build();
    } catch (Exception e) {
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"message\":\"Failed to download file content\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
  }

  @POST
  @Path("/bulk/delete")
  @Operation(
      operationId = "bulkDeleteDriveFiles",
      summary = "Delete multiple drive files",
      description = "Delete multiple drive files in one request.")
  public Response bulkDeleteFiles(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid BulkDeleteFilesRequest request) {
    List<UUID> ids = validateBulkIds(request == null ? null : request.ids);
    limits.enforceBulkSizeLimit(entityType, ids.size());
    boolean hardDelete = request != null && Boolean.TRUE.equals(request.hardDelete);
    List<BulkResponse> successful = new ArrayList<>();
    List<BulkResponse> failed = new ArrayList<>();

    for (UUID id : ids) {
      try {
        Response response = delete(uriInfo, securityContext, id, hardDelete);
        successful.add(bulkResponse(id.toString(), response.getStatus(), null));
      } catch (Exception e) {
        failed.add(bulkResponse(id.toString(), statusFromException(e), e.getMessage()));
      }
    }

    return buildBulkOperationResponse(buildBulkOperationResult(ids.size(), successful, failed));
  }

  @PUT
  @Path("/bulk/move")
  @Operation(
      operationId = "bulkMoveDriveFiles",
      summary = "Move multiple drive files",
      description =
          "Move multiple drive files to a new parent folder. When `folder` is omitted or null, "
              + "files are moved to the drive root.")
  public Response bulkMoveFiles(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid BulkMoveFilesRequest request) {
    List<UUID> ids = validateBulkIds(request == null ? null : request.ids);
    limits.enforceBulkSizeLimit(entityType, ids.size());
    List<BulkResponse> successful = new ArrayList<>();
    List<BulkResponse> failed = new ArrayList<>();
    EntityReference newFolder = request == null ? null : request.folder;

    for (UUID id : ids) {
      try {
        OperationContext operationContext =
            new OperationContext(entityType, MetadataOperation.EDIT_ALL);
        authorizer.authorize(
            securityContext,
            operationContext,
            getResourceContextById(id, ResourceContextInterface.Operation.PUT));
        ContextFile moved =
            repository.moveContextFile(id, newFolder, securityContext.getUserPrincipal().getName());
        addHref(uriInfo, moved);
        successful.add(bulkResponse(id.toString(), Response.Status.OK.getStatusCode(), null));
      } catch (Exception e) {
        failed.add(bulkResponse(id.toString(), statusFromException(e), e.getMessage()));
      }
    }

    return buildBulkOperationResponse(buildBulkOperationResult(ids.size(), successful, failed));
  }

  @POST
  @Path("/bulk/download")
  @Produces("application/zip")
  @Operation(
      operationId = "bulkDownloadDriveFiles",
      summary = "Download multiple drive files",
      description = "Download multiple drive files as a zip archive.")
  public Response bulkDownloadFiles(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid BulkDownloadFilesRequest request,
      @QueryParam("include") @DefaultValue("non-deleted") Include include) {
    List<UUID> ids = validateBulkIds(request == null ? null : request.ids);
    limits.enforceBulkSizeLimit(entityType, ids.size());

    AssetService assetService = AssetServiceFactory.getService();
    if (assetService == null) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"message\":\"Object storage is not configured\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }

    List<ResolvedDownloadEntry> resolvedEntries = new ArrayList<>();
    for (UUID id : ids) {
      ContextFile file = getInternal(uriInfo, securityContext, id, "", include);
      Asset asset = resolveAsset(file);
      if (asset == null) {
        throw new EntityNotFoundException("No current content found for file " + id);
      }
      resolvedEntries.add(new ResolvedDownloadEntry(file, asset));
    }

    List<DownloadEntry> entries = new ArrayList<>();
    for (ResolvedDownloadEntry entry : resolvedEntries) {
      java.nio.file.Path contentPath = null;
      try {
        contentPath = Files.createTempFile("context-file-download-", ".bin");
        InputStream inputStream = assetService.read(entry.asset()).join();
        if (inputStream == null) {
          cleanupDownloadEntries(entries);
          Files.deleteIfExists(contentPath);
          return Response.status(Response.Status.NOT_FOUND)
              .entity(
                  "{\"message\":\"No current content found for file "
                      + entry.file().getId()
                      + "\"}")
              .type(MediaType.APPLICATION_JSON)
              .build();
        }
        try (InputStream input = inputStream;
            OutputStream output = Files.newOutputStream(contentPath)) {
          input.transferTo(output);
        }
        entries.add(new DownloadEntry(entry.file(), entry.asset(), contentPath));
      } catch (IOException | RuntimeException e) {
        cleanupDownloadEntries(entries);
        if (contentPath != null) {
          try {
            Files.deleteIfExists(contentPath);
          } catch (IOException cleanupException) {
            LOG.warn(
                "Failed to clean up bulk download temp file {}", contentPath, cleanupException);
          }
        }
        LOG.error("Failed to prepare content for bulk drive file download", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
            .entity("{\"message\":\"Failed to download file content\"}")
            .type(MediaType.APPLICATION_JSON)
            .build();
      }
    }

    StreamingOutput output =
        stream -> {
          Map<String, Integer> usedNames = new LinkedHashMap<>();
          try (ZipOutputStream zipOutputStream = new ZipOutputStream(stream)) {
            for (DownloadEntry entry : entries) {
              try (InputStream inputStream = Files.newInputStream(entry.contentPath())) {
                String fileName = zipEntryName(entry, usedNames);
                zipOutputStream.putNextEntry(new ZipEntry(fileName));
                inputStream.transferTo(zipOutputStream);
                zipOutputStream.closeEntry();
              }
            }
          } catch (IOException e) {
            LOG.error("Failed to stream bulk drive file download", e);
            throw new WebApplicationException("Failed to stream file content", e);
          } catch (RuntimeException e) {
            LOG.error("Failed to stream bulk drive file download", e);
            throw new WebApplicationException("Failed to stream file content", e);
          } finally {
            cleanupDownloadEntries(entries);
          }
        };

    String fileName =
        request != null && request.fileName != null && !request.fileName.isBlank()
            ? request.fileName
            : "context-center-documents.zip";
    return Response.ok(output, "application/zip")
        .header("Content-Disposition", buildContentDisposition(fileName))
        .build();
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

  @PUT
  @Path("/{id}/move")
  @Operation(
      operationId = "moveDriveFile",
      summary = "Move a drive file to a different folder",
      description =
          "Move a drive file to a new parent folder. When the request body omits `folder` "
              + "(or sets it to null), the file is moved to the drive root.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The moved drive file",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ContextFile.class)))
      })
  public Response moveFile(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Valid MoveContextFileRequest moveRequest) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.PUT));
    EntityReference newFolder = moveRequest == null ? null : moveRequest.getFolder();
    ContextFile moved =
        repository.moveContextFile(id, newFolder, securityContext.getUserPrincipal().getName());
    return Response.ok(addHref(uriInfo, moved)).build();
  }

  private Asset resolveAsset(ContextFile file) {
    if (file.getHeadContentId() != null && !file.getHeadContentId().isEmpty()) {
      ContextFileContent content = repository.getContentById(file.getHeadContentId());
      Asset asset = resolveAsset(content);
      if (asset != null) {
        return asset;
      }
    }
    if (file.getAssetId() != null && !file.getAssetId().isEmpty()) {
      Asset asset = resolveAsset(file.getAssetId());
      if (asset != null) {
        return asset;
      }
    }
    return repository.getContentRepository().listByContextFileId(file.getId()).stream()
        .sorted(
            Comparator.comparing(
                    (ContextFileContent content) ->
                        Boolean.TRUE.equals(content.getIsCurrent()) ? 0 : 1)
                .thenComparing(
                    content ->
                        content.getIngestedAt() == null ? Long.MIN_VALUE : content.getIngestedAt(),
                    Comparator.reverseOrder()))
        .map(this::resolveAsset)
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  private Asset resolveAsset(ContextFileContent content) {
    if (content == null || content.getAssetId() == null || content.getAssetId().isEmpty()) {
      return null;
    }
    return resolveAsset(content.getAssetId());
  }

  private Asset resolveAsset(String assetId) {
    try {
      return repository.getAssetRepository().getById(assetId);
    } catch (Exception e) {
      return null;
    }
  }

  private List<UUID> validateBulkIds(List<UUID> ids) {
    if (ids == null || ids.isEmpty()) {
      throw new BadRequestException("ids must not be empty");
    }
    Set<UUID> uniqueIds = new HashSet<>(ids);
    if (uniqueIds.size() != ids.size()) {
      throw new BadRequestException("ids must not contain duplicates");
    }
    return ids;
  }

  private Response buildBulkOperationResponse(BulkOperationResult result) {
    if (result.getStatus() == ApiStatus.FAILURE) {
      return Response.status(Response.Status.BAD_REQUEST).entity(result).build();
    }
    return Response.ok(result).build();
  }

  private BulkOperationResult buildBulkOperationResult(
      int processed, List<BulkResponse> successful, List<BulkResponse> failed) {
    BulkOperationResult result = new BulkOperationResult();
    result.setNumberOfRowsProcessed(processed);
    result.setNumberOfRowsPassed(successful.size());
    result.setNumberOfRowsFailed(failed.size());
    result.setSuccessRequest(successful);
    result.setFailedRequest(failed);
    if (failed.isEmpty()) {
      result.setStatus(ApiStatus.SUCCESS);
    } else if (successful.isEmpty()) {
      result.setStatus(ApiStatus.FAILURE);
    } else {
      result.setStatus(ApiStatus.PARTIAL_SUCCESS);
    }
    return result;
  }

  private BulkResponse bulkResponse(Object request, int status, Object message) {
    BulkResponse response = new BulkResponse();
    response.setRequest(request);
    response.setStatus(status);
    if (message != null) {
      response.setMessage(String.valueOf(message));
    }
    return response;
  }

  private int statusFromException(Exception exception) {
    if (exception instanceof AuthorizationException) {
      return Response.Status.FORBIDDEN.getStatusCode();
    }
    if (exception instanceof EntityNotFoundException) {
      return Response.Status.NOT_FOUND.getStatusCode();
    }
    if (exception instanceof BadRequestException) {
      return Response.Status.BAD_REQUEST.getStatusCode();
    }
    if (exception instanceof WebApplicationException webApplicationException
        && webApplicationException.getResponse() != null) {
      return webApplicationException.getResponse().getStatus();
    }
    return Response.Status.INTERNAL_SERVER_ERROR.getStatusCode();
  }

  private void cleanupDownloadEntries(List<DownloadEntry> entries) {
    for (DownloadEntry entry : entries) {
      try {
        Files.deleteIfExists(entry.contentPath());
      } catch (IOException e) {
        LOG.warn("Failed to clean up bulk download temp file {}", entry.contentPath(), e);
      }
    }
  }

  private String zipEntryName(DownloadEntry entry, Map<String, Integer> usedNames) {
    String sourceName =
        entry.asset().getFileName() != null && !entry.asset().getFileName().isBlank()
            ? entry.asset().getFileName()
            : entry.file().getDisplayName() != null && !entry.file().getDisplayName().isBlank()
                ? entry.file().getDisplayName()
                : entry.file().getName();
    String safeName = sanitizeFileName(sourceName).replace('/', '_');
    int count = usedNames.merge(safeName, 1, Integer::sum);
    if (count == 1) {
      return safeName;
    }
    int dotIndex = safeName.lastIndexOf('.');
    if (dotIndex <= 0) {
      return safeName + " (" + count + ")";
    }
    return safeName.substring(0, dotIndex) + " (" + count + ")" + safeName.substring(dotIndex);
  }

  private OrderBy resolveOrderBy(String orderBy) {
    try {
      return OrderBy.valueOf(orderBy.trim().toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("orderBy must be one of: ASC, DESC");
    }
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

  /** Delegate to {@link ContextFileUploadSupport#sanitizeFileName(String)}. */
  static String sanitizeFileName(String fileName) {
    return ContextFileUploadSupport.sanitizeFileName(fileName);
  }

  /** Delegate to {@link ContextFileUploadSupport#buildContentDisposition(String)}. */
  static String buildContentDisposition(String fileName) {
    return ContextFileUploadSupport.buildContentDisposition(fileName);
  }

  /** Clamp expiry to [1, MAX_EXPIRY_SECONDS]. */
  static int clampExpiry(int expirySeconds) {
    return Math.max(1, Math.min(expirySeconds, MAX_EXPIRY_SECONDS));
  }
}
