package org.openmetadata.service.security;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/api/v1/auth/login")
@Slf4j
public class AuthLoginServlet extends HttpServlet {
  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleLogin(req, resp);
  }

  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
    // Basic and LDAP auth use POST, OIDC/SAML use GET
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleLogin(req, resp);
  }
}
