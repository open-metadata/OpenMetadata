package org.openmetadata.service.security;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/api/v1/auth/logout")
@Slf4j
public class AuthLogoutServlet extends HttpServlet {

  @Override
  protected void doGet(
      final HttpServletRequest httpServletRequest, final HttpServletResponse httpServletResponse) {
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleLogout(httpServletRequest, httpServletResponse);
  }

  @Override
  protected void doPost(
      final HttpServletRequest httpServletRequest, final HttpServletResponse httpServletResponse) {
    // Support both GET and POST for logout
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleLogout(httpServletRequest, httpServletResponse);
  }
}
