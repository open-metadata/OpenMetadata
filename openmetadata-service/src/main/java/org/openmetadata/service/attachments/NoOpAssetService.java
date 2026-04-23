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
   * Return the asset's own URL when present, otherwise an empty string. We deliberately
   * avoid returning a synthetic CDN URL here — a fake URL would let clients issue
   * downloads that can never succeed and would mask the "storage disabled"
   * misconfiguration. {@link org.openmetadata.schema.attachments.Asset#getUrl()} is
   * optional in the schema, so normalize null/blank to "" to preserve the non-null
   * contract callers rely on.
   */
  @Override
  public String generateDownloadUrlWithExpiry(Asset asset, Duration expiry) {
    if (asset == null) {
      return "";
    }
    String url = asset.getUrl();
    return url == null || url.isBlank() ? "" : url;
  }

  /**
   * Keep {@link #generateDownloadURL(Asset)} aligned with the expiry variant so the two
   * entry points never disagree. The default {@code AssetService} implementation returns
   * {@code asset.getUrl()} as-is (potentially {@code null}); delegating ensures NoOp
   * always satisfies the non-null contract.
   */
  @Override
  public String generateDownloadURL(Asset asset) {
    return generateDownloadUrlWithExpiry(asset, Duration.ofMinutes(15));
  }
}
