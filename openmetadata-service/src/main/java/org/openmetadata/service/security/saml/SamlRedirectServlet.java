package org.openmetadata.service.security.saml;

import com.onelogin.saml2.Auth;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/api/v1/saml/login")
@Slf4j
public class SamlRedirectServlet extends HttpServlet {
  @Override
  protected void doGet(final HttpServletRequest req, final HttpServletResponse resp) {
    Auth auth;
    try {
      auth = new Auth(SamlSettingsHolder.getInstance().getSaml2Settings(), req, resp);
      auth.login(SamlSettingsHolder.getInstance().getRelayState());
    } catch (Exception e) {
      LOG.error(e.getMessage());
    }
  }
}
