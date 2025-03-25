package org.openmetadata.service.security;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/api/v1/auth/refresh")
@Slf4j
public class AuthRefreshServlet extends HttpServlet {
  private final AuthenticationCodeFlowHandler authenticationCodeFlowHandler;

  public AuthRefreshServlet(AuthenticationCodeFlowHandler authenticationCodeFlowHandler) {
    this.authenticationCodeFlowHandler = authenticationCodeFlowHandler;
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    authenticationCodeFlowHandler.handleRefresh(req, resp);
  }
}
