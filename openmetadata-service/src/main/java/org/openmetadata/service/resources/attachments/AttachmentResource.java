package org.openmetadata.service.resources.attachments;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLConnection;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.media.multipart.FormDataContentDisposition;
import org.glassfish.jersey.media.multipart.FormDataParam;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.api.attachments.CreateAsset;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.attachments.AssetType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.exception.AssetServiceException;
import org.openmetadata.sdk.exception.AttachmentException;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.attachments.AssetService;
import org.openmetadata.service.attachments.AssetServiceFactory;
import org.openmetadata.service.jdbi3.AssetRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Slf4j
@Path("/v1/attachments")
@Tag(name = "Attachments", description = "APIs related to uploading attachments.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "Attachments")
public class AttachmentResource {
  private final AssetRepository assetRepository;
  private AssetService assetService;
  private final Authorizer authorizer;
  private long MAX_FILE_SIZE;
  private String cdnUrl;

  public AttachmentResource(Jdbi jdbi, Authorizer authorizer) {
    CollectionDAO extension = jdbi.onDemand(CollectionDAO.class);
    this.assetRepository = new AssetRepository(extension.assetDAO());
    this.authorizer = authorizer;
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.MAX_FILE_SIZE = config.getObjectStorage().getMaxFileSize();
    this.cdnUrl =
        config.getObjectStorage().getAzureConfiguration() != null
                && config.getObjectStorage().getAzureConfiguration().getCdnUrl() != null
            ? config.getObjectStorage().getAzureConfiguration().getCdnUrl()
            : config.getObjectStorage().getS3Configuration().getCloudFrontUrl();
    AssetServiceFactory.init(config);
    this.assetService = AssetServiceFactory.getService();
  }

  @GET
  @Path("/{id}")
  public Response getAssetById(
      @PathParam("id") String id, @Context SecurityContext securityContext) {
    Asset asset = assetRepository.getById(id);
    if (asset == null) {
      return Response.status(Response.Status.NOT_FOUND).build();
    }
    return Response.ok(asset).build();
  }

  @POST
  @Path("/upload")
  @Consumes(MediaType.MULTIPART_FORM_DATA)
  public Response uploadAttachment(
      @FormDataParam("file") InputStream fileInputStream,
      @FormDataParam("file") FormDataContentDisposition fileDetail,
      @FormDataParam("entityLink") String entityLink,
      @FormDataParam("assetType") @DefaultValue("Inline") AssetType assetType,
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext)
      throws IOException {
    MessageParser.EntityLink parsedLink = MessageParser.EntityLink.parse(entityLink);
    ResourceContextInterface resourceContext =
        new ResourceContext<>(parsedLink.getEntityType(), null, parsedLink.getEntityFQN());
    OperationContext operationContext =
        new OperationContext(parsedLink.getEntityType(), MetadataOperation.EDIT_DESCRIPTION);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    Asset asset =
        createAssetFromUpload(fileInputStream, fileDetail, entityLink, assetType, securityContext);

    String proxyUrl;
    if (asset.getAssetType() == AssetType.Inline) {
      if (cdnUrl != null && !cdnUrl.isEmpty()) {
        proxyUrl = cdnUrl + "/assets/" + asset.getId();
      } else {
        proxyUrl =
            uriInfo
                .getBaseUriBuilder()
                .path(AttachmentResource.class)
                .path(asset.getId() + "/download")
                .queryParam("direct", true)
                .build()
                .toString();
      }
    } else {
      proxyUrl =
          uriInfo
              .getBaseUriBuilder()
              .path(AttachmentResource.class)
              .path(asset.getId() + "/download")
              .queryParam("direct", false)
              .build()
              .toString();
    }
    asset.setUrl(proxyUrl);
    try {
      assetRepository.create(asset);
    } catch (Exception e) {
      try {
        assetService.delete(asset);
      } catch (Exception ignored) {
        LOG.warn("Failed to enqueue cleanup for asset {}", asset.getId(), ignored);
      }
      throw AttachmentException.byMessage(
          "Failed to create asset in the database. Upload has been rolled back.", e.getMessage());
    }
    return Response.status(Response.Status.CREATED).entity(asset).build();
  }

  @GET
  @Path("/{id}/download")
  public Response downloadAsset(
      @PathParam("id") String id,
      @QueryParam("expiry") @DefaultValue("3600") int expirySeconds,
      @QueryParam("direct") @DefaultValue("false") boolean direct,
      @Context SecurityContext securityContext) {
    Asset asset = assetRepository.getById(id);
    if (asset == null) {
      return Response.status(Response.Status.NOT_FOUND).build();
    }

    // Authorization check
    MessageParser.EntityLink parsedLink = MessageParser.EntityLink.parse(asset.getEntityLink());
    ResourceContextInterface resourceContext =
        new ResourceContext<>(parsedLink.getEntityType(), null, parsedLink.getEntityFQN());
    OperationContext operationContext =
        new OperationContext(parsedLink.getEntityType(), MetadataOperation.VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    boolean isImage = asset.getContentType() != null && asset.getContentType().startsWith("image/");
    boolean useCdn = cdnUrl != null && !cdnUrl.isEmpty();

    if (useCdn) {
      try {
        String signedUrl =
            assetService.generateDownloadUrlWithExpiry(asset, Duration.ofSeconds(expirySeconds));

        if (signedUrl != null) {
          if (isImage && direct) {
            return Response.ok(signedUrl).build();
          } else {
            return Response.temporaryRedirect(URI.create(signedUrl)).build();
          }
        }
      } catch (Exception e) {
        LOG.error("Error generating CDN URL: {}", e.getMessage(), e);
      }
    }

    // Fallback to direct serving
    LOG.debug(
        useCdn
            ? "Falling back to direct serving after CDN URL generation failed"
            : "Serving asset {} directly",
        asset.getId());

    try {
      InputStream fileStream = assetService.read(asset).join();
      if (isImage && direct) {
        return Response.ok(fileStream, asset.getContentType()).build();
      } else {
        return Response.ok(fileStream, asset.getContentType())
            .header("Content-Disposition", "attachment; filename=\"" + asset.getFileName() + "\"")
            .build();
      }
    } catch (java.util.concurrent.CompletionException e) {
      // Handle timeout and other async exceptions
      Throwable cause = e.getCause();

      // Check if it's a timeout by examining the cause chain
      if (isTimeoutException(cause)) {
        LOG.error("Timeout reading asset {}", asset.getId());
        return Response.status(Response.Status.GATEWAY_TIMEOUT)
            .entity("{\"message\":\"Asset download timed out. Please try again later.\"}")
            .type(MediaType.APPLICATION_JSON)
            .build();
      }

      if (cause instanceof AssetServiceException ase) {
        // Log full details server-side, but return sanitized message to client
        LOG.error("Failed to read asset {}: {}", asset.getId(), ase.getMessage());

        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
            .entity(
                "{\"message\":\"Failed to download asset. Please contact support if the problem persists.\"}")
            .type(MediaType.APPLICATION_JSON)
            .build();
      }

      LOG.error("Unexpected error reading asset {}: {}", asset.getId(), e.getMessage(), e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("{\"message\":\"Unexpected error downloading asset\"}")
          .type(MediaType.APPLICATION_JSON)
          .build();
    }
  }

  @DELETE
  @Path("/{id}")
  public Response deleteAttachment(
      @PathParam("id") String id,
      @QueryParam("hardDelete") @DefaultValue("false") boolean hardDelete,
      @Context SecurityContext securityContext) {
    Asset asset = assetRepository.getById(id);
    if (asset == null) {
      return Response.status(Response.Status.NOT_FOUND).build();
    }
    MessageParser.EntityLink parsedLink = MessageParser.EntityLink.parse(asset.getEntityLink());
    ResourceContextInterface resourceContext =
        new ResourceContext<>(parsedLink.getEntityType(), null, parsedLink.getEntityFQN());
    OperationContext operationContext =
        new OperationContext(parsedLink.getEntityType(), MetadataOperation.EDIT_DESCRIPTION);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    if (hardDelete) {
      try {
        assetService.delete(asset);
      } catch (RejectedExecutionException e) {
        return Response.status(Response.Status.TOO_MANY_REQUESTS)
            .entity(
                "{\"message\":\"Object delete queue is full. Please retry the attachment delete.\"}")
            .type(MediaType.APPLICATION_JSON)
            .build();
      }
      assetRepository.delete(asset.getId());
    } else {
      assetRepository.markDeleted(asset.getEntityLink());
    }
    return Response.ok().build();
  }

  @GET
  @Path("/fqn/{fqn}/{assetType}")
  public Response listAttachmentsByFqn(
      @PathParam("fqn") String fqn, @PathParam("assetType") AssetType assetType) {
    List<Asset> assets = assetRepository.getByFQN(fqn, assetType);
    if (assets == null) {
      return Response.status(Response.Status.NOT_FOUND).build();
    }
    return Response.ok(assets).build();
  }

  private Asset buildAsset(CreateAsset createAsset, String url, String updatedBy) {
    MessageParser.EntityLink assetLink =
        MessageParser.EntityLink.parse(createAsset.getEntityLink());
    Asset asset = new Asset();
    asset.setId(UUID.randomUUID().toString());
    asset.setFileName(createAsset.getFileName());
    asset.setContentType(createAsset.getContentType());
    asset.setSize(createAsset.getSize());
    asset.setEntityLink(createAsset.getEntityLink());
    asset.setFullyQualifiedName(assetLink.getEntityFQN());
    asset.setUrl(url);
    asset.setAssetType(createAsset.getAssetType());
    asset.setUpdatedBy(updatedBy);
    asset.setUpdatedAt(System.currentTimeMillis());
    asset.setDeleted(false);
    return asset;
  }

  private Asset createAssetFromUpload(
      InputStream fileInputStream,
      FormDataContentDisposition fileDetail,
      String entityLink,
      AssetType assetType,
      SecurityContext securityContext)
      throws IOException {

    byte[] fileBytes = org.apache.commons.io.IOUtils.toByteArray(fileInputStream);
    if (fileBytes.length > MAX_FILE_SIZE) {
      String readableFileSize = formatFileSize(fileBytes.length);
      String readableMaxSize = formatFileSize(MAX_FILE_SIZE);
      throw AttachmentException.byMessage(
          "File Size Validation",
          String.format(
              "File size (%s) exceeds maximum allowed size of %s",
              readableFileSize, readableMaxSize));
    }
    String originalFileName =
        fileDetail.getFileName() != null ? fileDetail.getFileName() : fileDetail.getName();
    String extension = "";
    int dotIndex = originalFileName.lastIndexOf('.');
    if (dotIndex != -1) {
      extension = originalFileName.substring(dotIndex);
    }

    String contentType = URLConnection.guessContentTypeFromName(originalFileName);
    if (contentType == null) {
      contentType = "application/octet-stream";
    }

    CreateAsset createAsset = new CreateAsset();
    createAsset.setEntityLink(entityLink);
    createAsset.setAssetType(assetType);

    Asset asset = buildAsset(createAsset, "", securityContext.getUserPrincipal().getName());
    asset.setFileName(originalFileName);
    asset.setSize((double) fileBytes.length);
    asset.setContentType(contentType);
    asset.setAssetType(assetType);
    asset.setExtension(extension);
    if (assetService != null) {
      assetService.upload(asset, new ByteArrayInputStream(fileBytes)).join();
    } else {
      throw AssetServiceException.byMessage(
          "Asset Service is unavailable", "Please reach out to administrator.");
    }
    return asset;
  }

  private String formatFileSize(long bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return String.format("%.2f KB", bytes / 1024.0);
    if (bytes < 1024 * 1024 * 1024) return String.format("%.2f MB", bytes / (1024.0 * 1024));
    return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
  }

  /**
   * Checks if the exception or any of its causes is a TimeoutException.
   * More robust than string matching on exception messages.
   */
  private boolean isTimeoutException(Throwable throwable) {
    Throwable current = throwable;
    while (current != null) {
      if (current instanceof TimeoutException) {
        return true;
      }
      current = current.getCause();
    }
    return false;
  }
}
