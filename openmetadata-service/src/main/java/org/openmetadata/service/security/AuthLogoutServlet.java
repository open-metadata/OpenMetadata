package org.openmetadata.service.security;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/api/v1/auth/logout")
@Slf4j
public class AuthLogoutServlet extends HttpServlet {
  private final String url;

  public AuthLogoutServlet(String url) {
    this.url = url;
  }

  @Override
  protected void doGet(
      final HttpServletRequest httpServletRequest, final HttpServletResponse httpServletResponse) {
    try {
      LOG.debug("Performing application logout");
      HttpSession session = httpServletRequest.getSession(false);
      if (session != null) {
        LOG.debug("Invalidating the session for logout");
        session.invalidate();
        httpServletResponse.sendRedirect(url);
      } else {
        LOG.error("No session store available for this web context");
      }
    } catch (Exception ex) {
      LOG.error("[Auth Logout] Error while performing logout", ex);
    }
  }
}
