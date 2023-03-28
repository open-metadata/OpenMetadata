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
import com.onelogin.saml2.settings.Saml2Settings;
import java.util.List;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;

/** This Servlet outputs a login metadata config of the SP that is Openmetadata */
@WebServlet("/api/v1/saml/metadata")
@Slf4j
public class SamlMetadataServlet extends HttpServlet {
  @Override
  @SneakyThrows
  protected void doGet(final HttpServletRequest req, final HttpServletResponse resp) {
    Auth auth = new Auth(SamlSettingsHolder.getInstance().getSaml2Settings(), req, resp);
    Saml2Settings settings = auth.getSettings();
    String metadata = settings.getSPMetadata();
    List<String> errors = Saml2Settings.validateMetadata(metadata);
    if (errors.isEmpty()) {
      resp.getOutputStream().println(metadata);
    } else {
      resp.setContentType("text/html; charset=UTF-8");
      for (String error : errors) {
        resp.getOutputStream().println("<p>" + error + "</p>");
      }
    }
  }
}
