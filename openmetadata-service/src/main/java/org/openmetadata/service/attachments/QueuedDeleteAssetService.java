package org.openmetadata.service.attachments;

import java.io.InputStream;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.openmetadata.schema.attachments.Asset;

public class QueuedDeleteAssetService implements AssetService {
  static final long DEFAULT_DELETE_WAIT_MILLIS =
      Long.getLong("collate.object.delete.task.timeout.ms", 60000L);

  private final AssetService delegate;
  private final ObjectDeleteQueueService deleteQueueService;
  private final long deleteWaitMillis;

  public QueuedDeleteAssetService(
      AssetService delegate, ObjectDeleteQueueService deleteQueueService) {
    this(delegate, deleteQueueService, DEFAULT_DELETE_WAIT_MILLIS);
  }

  QueuedDeleteAssetService(
      AssetService delegate, ObjectDeleteQueueService deleteQueueService, long deleteWaitMillis) {
    this.delegate = delegate;
    this.deleteQueueService = deleteQueueService;
    if (deleteWaitMillis <= 0) {
      throw new IllegalArgumentException("deleteWaitMillis must be > 0");
    }
    this.deleteWaitMillis = deleteWaitMillis;
  }

  AssetService getDelegate() {
    return delegate;
  }

  @Override
  public CompletableFuture<String> upload(Asset asset, InputStream content) {
    return delegate.upload(asset, content);
  }

  @Override
  public CompletableFuture<InputStream> read(Asset asset) {
    return delegate.read(asset);
  }

  @Override
  public CompletableFuture<Void> delete(Asset asset) {
    return deleteQueueService.submit(
        "asset:" + asset.getId(),
        () -> {
          CompletableFuture<Void> deleteFuture = delegate.delete(asset);
          if (deleteFuture != null) {
            waitForDelete(deleteFuture, asset.getId());
          }
        });
  }

  private void waitForDelete(CompletableFuture<Void> deleteFuture, String assetId) {
    try {
      deleteFuture.get(deleteWaitMillis, TimeUnit.MILLISECONDS);
    } catch (InterruptedException e) {
      deleteFuture.cancel(true);
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while deleting asset " + assetId, e);
    } catch (TimeoutException e) {
      deleteFuture.cancel(true);
      throw new IllegalStateException(
          "Timed out deleting asset %s after %d ms".formatted(assetId, deleteWaitMillis), e);
    } catch (ExecutionException e) {
      Throwable cause = e.getCause() != null ? e.getCause() : e;
      throw new IllegalStateException("Delete failed for asset " + assetId, cause);
    }
  }

  @Override
  public String generateDownloadURL(Asset asset) {
    return delegate.generateDownloadURL(asset);
  }

  @Override
  public String generateDownloadUrlWithExpiry(Asset asset, Duration expiry) {
    return delegate.generateDownloadUrlWithExpiry(asset, expiry);
  }

  @Override
  public void close() {
    delegate.close();
  }
}
