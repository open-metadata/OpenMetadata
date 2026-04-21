package org.openmetadata.service.attachments;

import java.io.InputStream;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.attachments.Asset;

public class NoOpAssetService implements AssetService {
  @Override
  public CompletableFuture<String> upload(Asset asset, InputStream content) {
    return CompletableFuture.completedFuture("");
  }

  @Override
  public CompletableFuture<InputStream> read(Asset asset) {
    return CompletableFuture.completedFuture(null);
  }

  @Override
  public CompletableFuture<Void> delete(Asset asset) {
    return CompletableFuture.completedFuture(null);
  }

  /**
   * Return the asset's own URL (which is empty when object storage is disabled) instead
   * of a synthetic CDN URL. Returning a fake URL would let clients issue downloads that
   * can never succeed and would mask the misconfiguration.
   */
  @Override
  public String generateDownloadUrlWithExpiry(Asset asset, Duration expiry) {
    return asset == null ? "" : asset.getUrl();
  }
}
