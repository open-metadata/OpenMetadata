package org.openmetadata.service.attachments;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.service.util.AsyncService;

/**
 * In-memory implementation of AssetService for local testing and development.
 * Stores asset contents in memory using a ConcurrentHashMap.
 *
 * WARNING: This implementation is NOT suitable for production use as:
 * - Data is lost on restart
 * - Memory usage grows with asset size
 * - Not distributed/shared across instances
 */
@Slf4j
public class InMemoryAssetService implements AssetService {
  private final ConcurrentHashMap<String, byte[]> assetStore;
  private final String baseUrl;

  public InMemoryAssetService() {
    this("http://localhost:8585/api/v1/assets");
  }

  public InMemoryAssetService(String baseUrl) {
    this.assetStore = new ConcurrentHashMap<>();
    this.baseUrl = baseUrl;
    LOG.info("Initialized InMemoryAssetService for local testing (base URL: {})", baseUrl);
  }

  /**
   * Run async work on the shared OM {@link AsyncService} executor so server-side
   * concurrency is bounded and observable, rather than falling back to the JVM
   * common ForkJoinPool.
   */
  private static Executor executor() {
    return AsyncService.getInstance().getExecutorService();
  }

  @Override
  public CompletableFuture<String> upload(Asset asset, InputStream content) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            // Read the input stream into a byte array
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] data = new byte[8192];
            int bytesRead;
            while ((bytesRead = content.read(data, 0, data.length)) != -1) {
              buffer.write(data, 0, bytesRead);
            }
            byte[] assetBytes = buffer.toByteArray();

            // Store in memory
            assetStore.put(asset.getId(), assetBytes);

            LOG.debug(
                "Uploaded asset {} ({} bytes) to in-memory storage",
                asset.getId(),
                assetBytes.length);

            return "success";
          } catch (Exception e) {
            LOG.error("Failed to upload asset {}: {}", asset.getId(), e.getMessage(), e);
            throw new RuntimeException("Failed to upload asset", e);
          }
        },
        executor());
  }

  @Override
  public CompletableFuture<InputStream> read(Asset asset) {
    // Return synchronously — the in-memory fetch is trivial and every caller
    // immediately joins on the returned future. Matches S3AssetService.read
    // and AzureAssetService.read so none of the providers route read traffic
    // through AsyncService (callers already block, no benefit to queueing).
    byte[] assetBytes = assetStore.get(asset.getId());
    if (assetBytes == null) {
      LOG.warn("Asset {} not found in in-memory storage", asset.getId());
      return CompletableFuture.completedFuture(null);
    }
    LOG.debug(
        "Retrieved asset {} ({} bytes) from in-memory storage", asset.getId(), assetBytes.length);
    return CompletableFuture.completedFuture(new ByteArrayInputStream(assetBytes));
  }

  @Override
  public CompletableFuture<Void> delete(Asset asset) {
    return CompletableFuture.runAsync(
        () -> {
          byte[] removed = assetStore.remove(asset.getId());
          if (removed != null) {
            LOG.debug(
                "Deleted asset {} ({} bytes) from in-memory storage",
                asset.getId(),
                removed.length);
          } else {
            LOG.warn("Attempted to delete non-existent asset {}", asset.getId());
          }
        },
        executor());
  }

  @Override
  public String generateDownloadUrlWithExpiry(Asset asset, Duration expiry) {
    // For in-memory storage, we just return a mock URL
    // In a real implementation, this would require a separate endpoint to serve the assets
    String url = baseUrl + "/" + asset.getId() + "?expiry=" + expiry.toSeconds();
    LOG.debug("Generated mock download URL for asset {}: {}", asset.getId(), url);
    return url;
  }

  /**
   * Match S3/Azure providers by delegating the no-expiry entry point to the expiry
   * variant. The default in {@link AssetService} returns {@code asset.getUrl()} which
   * for in-memory assets is never set (the stored URL is always empty), leading to
   * broken download links for callers that use the non-expiry API.
   */
  @Override
  public String generateDownloadURL(Asset asset) {
    return generateDownloadUrlWithExpiry(asset, Duration.ofMinutes(15));
  }

  /**
   * Get the current size of the in-memory store (for debugging/monitoring)
   * @return number of assets stored
   */
  public int getStoreSize() {
    return assetStore.size();
  }

  /**
   * Get the total memory used by stored assets (approximate)
   * @return total bytes stored
   */
  public long getTotalBytesStored() {
    return assetStore.values().stream().mapToLong(bytes -> bytes.length).sum();
  }

  /**
   * Clear all assets from memory (useful for testing)
   */
  public void clear() {
    int size = assetStore.size();
    assetStore.clear();
    LOG.info("Cleared {} assets from in-memory storage", size);
  }
}
