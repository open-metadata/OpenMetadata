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
    LOG.warn("GET /api/v1/auth/logout is deprecated; use POST instead");
    httpServletResponse.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
    httpServletResponse.setHeader("Allow", "POST");
  }

  @Override
  protected void doPost(
      final HttpServletRequest httpServletRequest, final HttpServletResponse httpServletResponse) {
    AuthServeletHandler handler =
        AuthServeletHandlerRegistry.getHandler(httpServletRequest.getServletContext());
    handler.handleLogout(httpServletRequest, httpServletResponse);
  }
}
