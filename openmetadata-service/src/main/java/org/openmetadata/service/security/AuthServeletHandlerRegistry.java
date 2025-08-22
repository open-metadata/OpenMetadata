package org.openmetadata.service.security;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class AuthServeletHandlerRegistry {
  private static volatile AuthServeletHandler currentHandler = null;

  public static AuthServeletHandler getHandler() {
    if (currentHandler == null) {
      synchronized (AuthServeletHandlerRegistry.class) {
        if (currentHandler == null) {
          try {
            currentHandler = AuthServeletHandlerFactory.getHandler();
            LOG.info(
                "Initialized authentication handler: {}",
                currentHandler.getClass().getSimpleName());
          } catch (Exception e) {
            LOG.error(
                "Failed to initialize authentication handler, using NoopAuthServeletHandler", e);
            currentHandler = NoopAuthServeletHandler.getInstance();
          }
        }
      }
    }
    return currentHandler;
  }

  /**
   * Force re-initialization of the handler
   */
  public static void resetHandler() {
    synchronized (AuthServeletHandlerRegistry.class) {
      currentHandler = null;
      LOG.info("Authentication handler reset, will reinitialize on next access");
    }
  }

  /**
   * Set handler directly (for testing or explicit initialization)
   */
  public static void setHandler(AuthServeletHandler handler) {
    currentHandler = handler;
  }
}
