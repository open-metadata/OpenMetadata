package org.openmetadata.catalog.security.saml;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.servlet.ServletUtils;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.openmetadata.catalog.security.jwt.JWTTokenGenerator;
import org.openmetadata.catalog.teams.authn.JWTAuthMechanism;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@WebServlet("/api/v1/saml/acs")
public class SamlResponseServlet extends HttpServlet {
  private static final Logger logger = LoggerFactory.getLogger(SamlResponseServlet.class);

  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
    try {
      handleResponse(req, resp);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  private void handleResponse(HttpServletRequest req, HttpServletResponse resp) throws Exception {
    Auth auth = new Auth(SamlSettingsHolder.getInstance().getSaml2Settings(), req, resp);
    auth.processResponse();

    if (!auth.isAuthenticated()) {
      logger.error("Not Authenticated");
      resp.sendError(403, "Unauthorized");
    }

    List<String> errors = auth.getErrors();

    if (!errors.isEmpty()) {
      if (auth.isDebugActive()) {
        String errorReason = auth.getLastErrorReason();
        if (errorReason != null && !errorReason.isEmpty()) {
          logger.error(errorReason);
          resp.sendError(500, errorReason);
        }
      }
    } else {
      Map<String, List<String>> attributes = auth.getAttributes();
      String nameId = auth.getNameId();
      String email = auth.getAttributes().get("Email").get(0);

      JWTTokenGenerator.getInstance().init(SamlSettingsHolder.getInstance().getJwtTokenConfiguration());
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(nameId, email, SamlSettingsHolder.getInstance().getTokenValidity(), false);

      String relayState = req.getParameter("RelayState");

      if (relayState != null
          && !relayState.isEmpty()
          && !relayState.equals(ServletUtils.getSelfRoutedURLNoQuery(req))) {
        String url = req.getParameter("RelayState") + "#id_token=" + jwtAuthMechanism.getJWTToken();
        resp.sendRedirect(url);
      } else {
        if (attributes.isEmpty()) {
          logger.info("You don't have any attributes");
        } else {
          Collection<String> keys = attributes.keySet();
          for (String name : keys) {
            logger.debug("Keys" + name);
            List<String> values = attributes.get(name);
            for (String value : values) {
              logger.debug("Value" + name);
            }
          }
        }
      }
    }
  }
}
