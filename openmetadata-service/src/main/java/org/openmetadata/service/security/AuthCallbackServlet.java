package org.openmetadata.service.security;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import javax.servlet.annotation.WebServlet;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/callback")
@Slf4j
public class AuthCallbackServlet extends HttpServlet {
  private final AuthenticationCodeFlowHandler authenticationCodeFlowHandler;

  public AuthCallbackServlet(AuthenticationCodeFlowHandler authenticationCodeFlowHandler) {
    this.authenticationCodeFlowHandler = authenticationCodeFlowHandler;
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    authenticationCodeFlowHandler.handleCallback(req, resp);
  }
}
