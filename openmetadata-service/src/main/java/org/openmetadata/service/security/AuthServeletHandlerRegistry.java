package org.openmetadata.service.security;

public class AuthServeletHandlerRegistry {
  private static volatile AuthServeletHandler currentHandler =
      NoopAuthServeletHandler.getInstance();

  public static AuthServeletHandler getHandler() {
    return currentHandler;
  }

  public static void setHandler(AuthServeletHandler handler) {
    currentHandler = handler;
  }
}
