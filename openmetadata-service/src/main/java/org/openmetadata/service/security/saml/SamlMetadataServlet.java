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
import com.onelogin.saml2.exception.SAMLException;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.security.cert.CertificateEncodingException;
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;

/** This Servlet outputs a login metadata config of the SP that is Openmetadata */
@Slf4j
@WebServlet("/api/v1/saml/metadata")
public class SamlMetadataServlet extends HttpServlet {
  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    try {
      // Convert Jakarta servlet types to javax servlet types using Apache Felix wrappers
      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(request);
      javax.servlet.http.HttpServletResponse wrappedResponse =
          new HttpServletResponseWrapper(response);

      Auth auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      String metadata = auth.getSettings().getSPMetadata();
      response.setContentType("text/xml");
      response.getWriter().write(metadata);
    } catch (SAMLException | CertificateEncodingException ex) {
      LOG.error("Error generating SAML metadata", ex);
      throw new ServletException("Error generating SAML metadata", ex);
    }
  }
}
