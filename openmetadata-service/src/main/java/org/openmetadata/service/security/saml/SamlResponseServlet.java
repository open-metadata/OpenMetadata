package org.openmetadata.service.security.saml;

import com.onelogin.saml2.Auth;
import java.util.List;
import java.util.Map;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
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
      String username;
      String nameId = auth.getNameId();
      if (nameId.contains("@")) {
        username = nameId.split("@")[0];
      } else username = nameId;

      JWTTokenGenerator.getInstance().init(SamlSettingsHolder.getInstance().getJwtTokenConfiguration());
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  username,
                  nameId,
                  SamlSettingsHolder.getInstance().getTokenValidity(),
                  false,
                  ServiceTokenType.OM_USER);

      //      String relayState = req.getParameter("RelayState");

      String url =
          SamlSettingsHolder.getInstance().getRelayState()
              + "?id_token="
              + jwtAuthMechanism.getJWTToken()
              + "&email="
              + nameId
              + "&name="
              + username;
      resp.sendRedirect(url);
    }
  }
}
