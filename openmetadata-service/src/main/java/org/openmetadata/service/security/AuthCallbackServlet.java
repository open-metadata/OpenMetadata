package org.openmetadata.service.security;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/callback")
@Slf4j
public class AuthCallbackServlet extends HttpServlet {

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleCallback(req, resp);
  }
}
