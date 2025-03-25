package org.openmetadata.service.security;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/api/v1/auth/login")
@Slf4j
public class AuthLoginServlet extends HttpServlet {
  private final AuthenticationCodeFlowHandler authenticationCodeFlowHandler;

  public AuthLoginServlet(AuthenticationCodeFlowHandler authenticationCodeFlowHandler) {
    this.authenticationCodeFlowHandler = authenticationCodeFlowHandler;
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    authenticationCodeFlowHandler.handleLogin(req, resp);
  }
}
