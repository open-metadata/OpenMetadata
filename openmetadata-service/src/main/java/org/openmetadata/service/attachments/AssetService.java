package org.openmetadata.service.attachments;

import org.openmetadata.schema.attachments.Asset;
import java.io.InputStream;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

public interface AssetService {
  CompletableFuture<String> upload(Asset asset, InputStream content);

  CompletableFuture<InputStream> read(Asset asset);

  CompletableFuture<Void> delete(Asset asset);

  default String generateDownloadURL(Asset asset) {
    return asset.getUrl();
  }

  String generateDownloadUrlWithExpiry(Asset asset, Duration expiry);

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
