package org.openmetadata.service.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class NoopAuthServeletHandler implements AuthServeletHandler {
  private static final NoopAuthServeletHandler INSTANCE = new NoopAuthServeletHandler();

  // Private constructor to prevent instantiation
  private NoopAuthServeletHandler() {}

  // Public method to access the singleton instance
  public static NoopAuthServeletHandler getInstance() {
    return INSTANCE;
  }

  @Override
  public void handleLogin(HttpServletRequest req, HttpServletResponse resp) {}

  @Override
  public void handleLogout(HttpServletRequest req, HttpServletResponse resp) {}

  @Override
  public void handleCallback(HttpServletRequest req, HttpServletResponse resp) {}

  @Override
  public void handleRefresh(HttpServletRequest req, HttpServletResponse resp) {}
}
