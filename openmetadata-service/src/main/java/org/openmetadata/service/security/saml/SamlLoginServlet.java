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
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

@WebServlet("/api/v1/saml/login")
@Slf4j
public class SamlLoginServlet extends HttpServlet {
  public static final String PATH = "/api/v1/saml/login";

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
