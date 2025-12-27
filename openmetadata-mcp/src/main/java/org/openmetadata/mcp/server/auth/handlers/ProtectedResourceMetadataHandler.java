package org.openmetadata.mcp.server.auth.handlers;

import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.ProtectedResourceMetadata;

/**
 * Handler for OAuth Protected Resource metadata requests (RFC 9728).
 */
public class ProtectedResourceMetadataHandler {

  private final ProtectedResourceMetadata metadata;

  public ProtectedResourceMetadataHandler(ProtectedResourceMetadata metadata) {
    this.metadata = metadata;
  }

  /**
   * Handle a protected resource metadata request.
   * @return A CompletableFuture that resolves to the protected resource metadata
   */
  public CompletableFuture<ProtectedResourceMetadata> handle() {
    return CompletableFuture.completedFuture(metadata);
  }
}
