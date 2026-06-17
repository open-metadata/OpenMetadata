package org.openmetadata.service.attachments;

import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.config.ObjectStorageConfiguration;

@Slf4j
public class AssetServiceFactory {
  private static AssetService instance;
  private static boolean shutdownHookRegistered;

  public static synchronized void init(OpenMetadataApplicationConfig config) {
    registerShutdownHook();
    ObjectStorageConfiguration objectStorageConfiguration = config.getObjectStorage();
    if (objectStorageConfiguration == null || !objectStorageConfiguration.isEnabled()) {
      LOG.warn(
          "Object storage is disabled (objectStorage.enabled=false or missing). File uploads "
              + "(e.g. Context Center Drive) will be accepted but their content will be "
              + "discarded, and file processing will fail with 'Unable to read file content "
              + "from object storage'. Configure objectStorage with provider s3, azure, or "
              + "inmemory to enable file storage.");
      // Storage disabled — always swap to a fresh NoOp provider. If a previous init
      // wired up S3/Azure/InMemory, leaving that instance live after a reload to the
      // disabled state would keep serving real uploads/downloads against the old
      // backend, which hides the misconfiguration and leaks connections in tests.
      if (!(instance instanceof NoOpAssetService)) {
        closeCurrent();
        instance = new NoOpAssetService();
      }
      return;
    }

    String provider = validateProvider(objectStorageConfiguration.getProvider());
    if (isInitializedForProvider(provider)) {
      return;
    }
    closeCurrent();

    AssetService delegate;
    String normalizedProvider = provider.toLowerCase(Locale.ROOT);
    if ("s3".equals(normalizedProvider)) {
      delegate = new S3AssetService(objectStorageConfiguration.getS3Configuration());
    } else if ("azure".equals(normalizedProvider)) {
      delegate = new AzureAssetService(objectStorageConfiguration.getAzureConfiguration());
    } else if ("inmemory".equals(normalizedProvider) || "in-memory".equals(normalizedProvider)) {
      LOG.info("Using InMemoryAssetService for local testing");
      delegate = new InMemoryAssetService();
    } else if ("noop".equals(normalizedProvider)) {
      delegate = new NoOpAssetService();
    } else {
      throw new IllegalArgumentException("Unsupported asset uploader provider: " + provider);
    }
    instance = new QueuedDeleteAssetService(delegate, ObjectDeleteQueueService.getInstance());
  }

  private static String validateProvider(String provider) {
    if (provider == null || provider.isBlank()) {
      throw new IllegalArgumentException(
          "Object storage provider must be configured when object storage is enabled.");
    }
    return provider.trim();
  }

  private static boolean isInitializedForProvider(String provider) {
    if (instance == null || provider == null || provider.isBlank()) {
      return false;
    }
    AssetService unwrapped = unwrap(instance);
    return switch (provider.toLowerCase(Locale.ROOT)) {
      case "s3" -> unwrapped instanceof S3AssetService;
      case "azure" -> unwrapped instanceof AzureAssetService;
      case "inmemory", "in-memory" -> unwrapped instanceof InMemoryAssetService;
      case "noop" -> unwrapped instanceof NoOpAssetService;
      default -> false;
    };
  }

  /**
   * Returns the concrete {@link AssetService} implementation, stripping any wrapper layers such as
   * {@link QueuedDeleteAssetService}. Callers that need to inspect provider capabilities
   * (e.g. {@code instanceof S3AssetService}) should go through this helper because the wrapper
   * hides the delegate from direct type checks.
   */
  public static AssetService unwrap(AssetService service) {
    AssetService current = service;
    while (current instanceof QueuedDeleteAssetService queuedService) {
      current = queuedService.getDelegate();
    }
    return current;
  }

  public static AssetService getService() {
    if (instance == null) {
      throw new IllegalStateException(
          "AssetService not initialized. Please make sure ObjectStorage is configured.");
    }
    return instance;
  }

  /**
   * Close the current instance if it owns lifecycle resources (e.g. S3Client / S3Presigner
   * connection pools). Safe to call with no instance or an already-closed instance.
   */
  public static synchronized void shutdown() {
    AssetService current = instance;
    if (current == null) {
      return;
    }
    try {
      current.close();
    } catch (Exception e) {
      LOG.warn("Failed to close AssetService cleanly", e);
    }
    instance = null;
  }

  private static void closeCurrent() {
    AssetService current = instance;
    if (current == null) {
      return;
    }
    try {
      current.close();
    } catch (Exception e) {
      LOG.warn("Failed to close previous AssetService cleanly", e);
    }
  }

  private static void registerShutdownHook() {
    if (shutdownHookRegistered) {
      return;
    }
    Runtime.getRuntime()
        .addShutdownHook(new Thread(AssetServiceFactory::shutdown, "asset-service-shutdown"));
    shutdownHookRegistered = true;
  }
}
