package org.openmetadata.service.apps.bundles.retentionPolicyApp;

import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.retentionPolicyApp.cleanupHandlers.EventSubscriptionCleanupHandler;

public class CleanupHandlerFactory {
  public static CleanupHandler getHandler(String entityType) {
    return switch (entityType) {
      case Entity.EVENT_SUBSCRIPTION -> new EventSubscriptionCleanupHandler();
      default -> throw new IllegalArgumentException("Unsupported entity type: " + entityType);
    };
  }
}
