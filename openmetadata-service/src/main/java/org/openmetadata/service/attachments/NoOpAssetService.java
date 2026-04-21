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

  @Override
  public String generateDownloadUrlWithExpiry(Asset asset, Duration expiry) {
    return "https://cdn.example.com/static/" + asset.getId();
  }
}
