package org.openmetadata.service.attachments;

import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.storage.blob.*;
import com.azure.storage.blob.models.*;
import com.azure.storage.blob.sas.*;
import com.azure.storage.common.sas.SasProtocol;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.concurrent.CompletableFuture;
import org.apache.commons.io.IOUtils;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.sdk.exception.AssetServiceException;
import org.openmetadata.service.config.AzureConfiguration;
import org.openmetadata.service.util.AsyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AzureAssetService implements AssetService {
  private static final Logger LOG = LoggerFactory.getLogger(AzureAssetService.class);

  private final AzureConfiguration config;
  private final BlobServiceClient blobServiceClient;
  private final BlobContainerClient containerClient;
  private final String basePathPrefix;

  public AzureAssetService(AzureConfiguration config) {
    this.config = config;
    this.basePathPrefix = String.format("%s/", config.getPrefixPath());

    if (config.getBlobEndpoint() == null || config.getBlobEndpoint().isEmpty()) {
      throw new IllegalArgumentException("blobEndpoint must be provided in Azure configuration");
    }

    this.blobServiceClient =
        new BlobServiceClientBuilder()
            .endpoint(config.getBlobEndpoint())
            .credential(new DefaultAzureCredentialBuilder().build())
            .buildClient();

    this.containerClient = blobServiceClient.getBlobContainerClient(config.getContainerName());
    initializeContainer();
  }

  private void initializeContainer() {
    try {
      if (!containerClient.exists()) {
        containerClient.create();
        LOG.info("Created Azure blob container: {}", containerClient.getBlobContainerName());
      }
      createDirectoryMarker();
    } catch (Exception e) {
      LOG.error("Failed to initialize Azure blob container: {}", e.getMessage(), e);
      throw new RuntimeException("Failed to initialize Azure blob container", e);
    }
  }

  private void createDirectoryMarker() {
    String markerPath = basePathPrefix + ".directory";
    BlobClient blobClient = containerClient.getBlobClient(markerPath);
    if (!blobClient.exists()) {
      blobClient.upload(new ByteArrayInputStream(new byte[0]), 0, true);
    }
  }

  @Override
  public CompletableFuture<String> upload(Asset asset, InputStream content) {
    return AsyncService.executeAsync(
        () -> {
          try {
            byte[] bytes = IOUtils.toByteArray(content);
            String fullPath = basePathPrefix + asset.getId();
            BlobClient blobClient = containerClient.getBlobClient(fullPath);

            blobClient.upload(new ByteArrayInputStream(bytes), bytes.length, true);
            blobClient.setHttpHeaders(new BlobHttpHeaders().setContentType(asset.getContentType()));

            return generateDownloadUrlWithExpiry(asset, Duration.ofMinutes(15));
          } catch (IOException e) {
            throw AssetServiceException.byMessage(
                "Failed to upload asset: " + asset.getId(), e.getMessage());
          }
        },
        "Upload",
        asset.getId());
  }

  @Override
  public CompletableFuture<InputStream> read(Asset asset) {
    return AsyncService.executeAsync(
        () -> {
          try {
            LOG.debug("Reading asset {} from Azure blob storage", asset.getId());
            BlobClient blobClient = containerClient.getBlobClient(basePathPrefix + asset.getId());
            InputStream inputStream = blobClient.openInputStream();
            LOG.debug("Successfully opened input stream for asset {}", asset.getId());
            return inputStream;
          } catch (Exception e) {
            throw AssetServiceException.byMessage(
                "Failed to read asset: " + asset.getId(), e.getMessage());
          }
        },
        "Read",
        asset.getId());
  }

  @Override
  public CompletableFuture<Void> delete(Asset asset) {
    return AsyncService.executeAsync(
        () -> {
          try {
            BlobClient blobClient = containerClient.getBlobClient(basePathPrefix + asset.getId());
            blobClient.delete();
            LOG.debug("Successfully deleted asset {}", asset.getId());
            return null;
          } catch (Exception e) {
            throw AssetServiceException.byMessage(
                "Failed to delete asset: " + asset.getId(), e.getMessage());
          }
        },
        "Delete",
        asset.getId());
  }

  @Override
  public String generateDownloadUrlWithExpiry(Asset asset, Duration expiry) {
    try {
      String blobName = basePathPrefix + asset.getId();
      BlobClient blobClient = containerClient.getBlobClient(blobName);

      OffsetDateTime start = OffsetDateTime.now().minusMinutes(5);
      OffsetDateTime end = OffsetDateTime.now().plus(expiry);
      UserDelegationKey userDelegationKey = blobServiceClient.getUserDelegationKey(start, end);

      BlobSasPermission permission = new BlobSasPermission().setReadPermission(true);
      BlobServiceSasSignatureValues sasValues =
          new BlobServiceSasSignatureValues(end, permission)
              .setStartTime(start)
              .setProtocol(SasProtocol.HTTPS_ONLY)
              .setBlobName(blobName)
              .setContainerName(containerClient.getBlobContainerName());

      String sasToken = blobClient.generateUserDelegationSas(sasValues, userDelegationKey);
      return blobClient.getBlobUrl() + "?" + sasToken;
    } catch (Exception e) {
      LOG.error("Failed to generate SAS token for asset: {}", asset.getId(), e);
      throw new RuntimeException("Could not generate SAS token", e);
    }
  }

  @Override
  public String generateDownloadURL(Asset asset) {
    return generateDownloadUrlWithExpiry(asset, Duration.ofMinutes(15));
  }
}
