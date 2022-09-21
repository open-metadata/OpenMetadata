package org.openmetadata.service.security.saml;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.servlet.ServletUtils;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.teams.authn.JWTAuthMechanism;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

@WebServlet("/api/v1/saml/acs")
@Slf4j
public class SamlResponseServlet extends HttpServlet {
  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
    try {
      handleResponse(req, resp);
    } catch (Exception e) {
      LOG.error("SamlResponseError :" + e.getMessage());
    }
  }

  private void handleResponse(HttpServletRequest req, HttpServletResponse resp) throws Exception {
    Auth auth = new Auth(SamlSettingsHolder.getInstance().getSaml2Settings(), req, resp);
    auth.processResponse();

    if (!auth.isAuthenticated()) {
      LOG.error("Not Authenticated");
      resp.sendError(403, "Unauthorized");
    }

    List<String> errors = auth.getErrors();

    if (!errors.isEmpty()) {
      String errorReason = auth.getLastErrorReason();
      if (errorReason != null && !errorReason.isEmpty()) {
        LOG.error(errorReason);
        resp.sendError(500, errorReason);
      }
    } else {
      Map<String, List<String>> attributes = auth.getAttributes();
      String nameId = auth.getNameId();
      String username = nameId.split("@")[0];

      JWTTokenGenerator.getInstance().init(SamlSettingsHolder.getInstance().getJwtTokenConfiguration());
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(username, nameId, SamlSettingsHolder.getInstance().getTokenValidity(), false);

      String relayState = req.getParameter("RelayState");

      if (relayState != null
          && !relayState.isEmpty()
          && !relayState.equals(ServletUtils.getSelfRoutedURLNoQuery(req))) {
        String url =
            SamlSettingsHolder.getInstance().getRelayState()
                + "?id_token="
                + jwtAuthMechanism.getJWTToken()
                + "&email="
                + nameId
                + "&name="
                + username;
        resp.sendRedirect(url);
      } else {
        if (attributes.isEmpty()) {
          LOG.info("You don't have any attributes");
        } else {
          Collection<String> keys = attributes.keySet();
          for (String name : keys) {
            LOG.debug("Keys" + name);
            List<String> values = attributes.get(name);
            for (String value : values) {
              LOG.debug("Value" + name);
            }
          }
        }
      }
    }
  }
}
