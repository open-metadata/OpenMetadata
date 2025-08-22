package org.openmetadata.service.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/callback")
@Slf4j
public class AuthCallbackServlet extends HttpServlet {

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {
    // Check if this is a final redirect with tokens (from any auth mechanism)
    // These should be handled by the React app
    if (req.getParameter("id_token") != null) {
      // This is the final redirect after successful authentication
      // Forward to React app to handle the tokens
      req.getRequestDispatcher("/index.html").forward(req, resp);
      return;
    }

    // Otherwise, this is an auth provider callback that needs backend processing
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleCallback(req, resp);
  }

  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {
    // POST callbacks are typically from SAML with SAMLResponse
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleCallback(req, resp);
  }
}
