/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.saml;

import com.onelogin.saml2.Auth;
import java.util.List;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/**
 * This Servlet also known as Assertion Consumer Service URL handles the SamlResponse the IDP send in response to the
 * SamlRequest. After a successful processing it redirects user to the relayState which is the callback setup in the
 * config.
 */
@WebServlet("/api/v1/saml/acs")
@Slf4j
public class SamlAssertionConsumerServlet extends HttpServlet {
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
      LOG.error("[SAML ACS] Not Authenticated");
      resp.sendError(403, "UnAuthenticated");
    }

    List<String> errors = auth.getErrors();

    if (!errors.isEmpty()) {
      String errorReason = auth.getLastErrorReason();
      if (errorReason != null && !errorReason.isEmpty()) {
        LOG.error("[SAML ACS]" + errorReason);
        resp.sendError(500, errorReason);
      }
    } else {
      String username;
      String nameId = auth.getNameId();
      String email = nameId;
      if (nameId.contains("@")) {
        username = nameId.split("@")[0];
      } else {
        username = nameId;
        email = String.format("%s@%s", username, SamlSettingsHolder.getInstance().getDomain());
      }

      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  username,
                  email,
                  SamlSettingsHolder.getInstance().getTokenValidity(),
                  false,
                  ServiceTokenType.OM_USER);

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
