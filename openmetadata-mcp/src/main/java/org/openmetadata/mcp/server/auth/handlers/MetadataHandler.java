package org.openmetadata.mcp.server.auth.handlers;

import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.OAuthMetadata;

/**
 * Handler for OAuth metadata requests.
 */
public class MetadataHandler {

  private final OAuthMetadata metadata;

  public MetadataHandler(OAuthMetadata metadata) {
    this.metadata = metadata;
  }

  /**
   * Handle a metadata request.
   * @return A CompletableFuture that resolves to the OAuth metadata
   */
  public CompletableFuture<OAuthMetadata> handle() {
    return CompletableFuture.completedFuture(metadata);
  }
}
