package org.openmetadata.service.attachments;

import java.io.InputStream;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.attachments.Asset;

public interface AssetService extends AutoCloseable {
  CompletableFuture<String> upload(Asset asset, InputStream content);

  CompletableFuture<InputStream> read(Asset asset);

  CompletableFuture<Void> delete(Asset asset);

  default String generateDownloadURL(Asset asset) {
    return asset.getUrl();
  }

  String generateDownloadUrlWithExpiry(Asset asset, Duration expiry);

  /**
   * Default no-op for providers that hold no closeable resources (in-memory, no-op,
   * Azure — whose BlobServiceClient has no explicit close). Providers that own
   * SDK clients with connection pools (e.g. S3) should override to release them on
   * application shutdown.
   */
  @Override
  default void close() {}

  default String determineBasePathPrefix(String[] pathParts) {
    if (pathParts.length <= 1) {
      return "";
    }

    String prefix = pathParts[1];
    if (!prefix.endsWith("/")) {
      prefix += "/";
    }

    return prefix;
  }
}
