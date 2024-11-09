package org.openmetadata.service.security;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/api/v1/auth/logout")
@Slf4j
public class AuthLogoutServlet extends HttpServlet {
  private final AuthenticationCodeFlowHandler authenticationCodeFlowHandler;

  public AuthLogoutServlet(AuthenticationCodeFlowHandler authenticationCodeFlowHandler) {
    this.authenticationCodeFlowHandler = authenticationCodeFlowHandler;
  }

  @Override
  protected void doGet(
      final HttpServletRequest httpServletRequest, final HttpServletResponse httpServletResponse) {
    authenticationCodeFlowHandler.handleLogout(httpServletRequest, httpServletResponse);
  }
}
