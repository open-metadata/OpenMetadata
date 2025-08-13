package org.openmetadata.service.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class NoopAuthServeletHandler implements AuthServeletHandler {
  private static final NoopAuthServeletHandler INSTANCE = new NoopAuthServeletHandler();

  // Private constructor to prevent instantiation
  private NoopAuthServeletHandler() {}

  // Public method to access the singleton instance
  public static NoopAuthServeletHandler getInstance() {
    return INSTANCE;
  }

  @Override
  public void handleLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      resp.sendError(
          HttpServletResponse.SC_NOT_FOUND, "Callback endpoint not available for public clients");
    } catch (IOException e) {
      LOG.error("Failed to send 404 response", e);
    }
  }

  @Override
  public void handleLogout(HttpServletRequest req, HttpServletResponse resp) {
    try {
      resp.sendError(
          HttpServletResponse.SC_NOT_FOUND, "Callback endpoint not available for public clients");
    } catch (IOException e) {
      LOG.error("Failed to send 404 response", e);
    }
  }

  @Override
  public void handleCallback(HttpServletRequest req, HttpServletResponse resp) {
    // For public clients, return 404 to let frontend handle the callback
    // This simulates the callback endpoint not existing
    try {
      resp.sendError(
          HttpServletResponse.SC_NOT_FOUND, "Callback endpoint not available for public clients");
    } catch (IOException e) {
      LOG.error("Failed to send 404 response", e);
    }
  }

  @Override
  public void handleRefresh(HttpServletRequest req, HttpServletResponse resp) {
    try {
      resp.sendError(
          HttpServletResponse.SC_NOT_FOUND, "Callback endpoint not available for public clients");
    } catch (IOException e) {
      LOG.error("Failed to send 404 response", e);
    }
  }
}
