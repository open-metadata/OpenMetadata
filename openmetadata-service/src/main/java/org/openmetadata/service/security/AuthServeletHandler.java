package org.openmetadata.service.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public interface AuthServeletHandler {
  void handleLogin(HttpServletRequest req, HttpServletResponse resp);

  void handleLogout(HttpServletRequest req, HttpServletResponse resp);

  void handleCallback(HttpServletRequest req, HttpServletResponse resp);

  void handleRefresh(HttpServletRequest req, HttpServletResponse resp);
}
