package org.openmetadata.catalog.security.saml;

import com.onelogin.saml2.Auth;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@WebServlet("/api/v1/saml/login")
public class SamlRedirectServlet extends HttpServlet {
  private static final Logger logger = LoggerFactory.getLogger(SamlRedirectServlet.class);

  @Override
  protected void doGet(final HttpServletRequest req, final HttpServletResponse resp) {
    Auth auth;
    try {
      auth = new Auth(SamlSettingsHolder.getInstance().getSaml2Settings(), req, resp);
      auth.login(SamlSettingsHolder.getInstance().getRelayState());
    } catch (Exception e) {
      logger.error(e.getMessage());
    }
  }
}
