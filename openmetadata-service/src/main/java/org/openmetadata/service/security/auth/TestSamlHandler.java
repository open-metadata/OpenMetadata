/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.security.auth;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.core.Response;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;

/**
 * Handles SAML Test Login flow. Parallel to {@link TestLoginHandler} for OIDC.
 * Builds a temporary {@link Saml2Settings} from form-provided IdP/SP fields so
 * the admin can verify the SAML configuration before persisting it.
 *
 * <p>RelayState is prefixed with {@value #RELAY_STATE_PREFIX} so
 * {@code AuthCallbackServlet.doPost} can route the IdP's POST callback to
 * this handler instead of the normal SAML login flow.
 */
@Slf4j
public final class TestSamlHandler {

  public static final String RELAY_STATE_PREFIX = "saml-test-login:";
  private static final String SESSION_KEY_PREFIX = "testSaml.";
  private static final String DEFAULT_CALLBACK_PATH = "/callback";
  private static final String HTTP_POST_BINDING =
      "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";
  private static final String HTTP_REDIRECT_BINDING =
      "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";
  private static final String DEFAULT_NAMEID_FORMAT =
      "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";

  private TestSamlHandler() {}

  public static Response handleInitiate(
      HttpServletRequest req,
      HttpServletResponse resp,
      String idpEntityId,
      String idpSsoLoginUrl,
      String idpX509Certificate,
      String spEntityId,
      String spAcsUrl,
      String nameIdFormat) {
    try {
      if (nullOrEmpty(idpEntityId)) {
        return TestLoginResponses.buildHtmlErrorResponse(
            "IdP Entity ID is required for SAML Test Login.");
      }
      if (nullOrEmpty(idpSsoLoginUrl)) {
        return TestLoginResponses.buildHtmlErrorResponse(
            "IdP SSO Login URL is required for SAML Test Login.");
      }
      if (nullOrEmpty(idpX509Certificate)) {
        return TestLoginResponses.buildHtmlErrorResponse(
            "IdP X.509 Certificate is required for SAML Test Login.");
      }

      String serverUrl = buildServerUrl(req);
      if (nullOrEmpty(spAcsUrl)) {
        spAcsUrl = serverUrl + DEFAULT_CALLBACK_PATH;
      }
      if (nullOrEmpty(spEntityId)) {
        spEntityId = serverUrl;
      }
      if (nullOrEmpty(nameIdFormat)) {
        nameIdFormat = DEFAULT_NAMEID_FORMAT;
      }

      Saml2Settings settings =
          buildSamlSettings(idpEntityId, idpSsoLoginUrl, idpX509Certificate, spEntityId, spAcsUrl,
              nameIdFormat);

      String relayState = RELAY_STATE_PREFIX + UUID.randomUUID();
      HttpSession session = req.getSession(true);
      session.setAttribute(SESSION_KEY_PREFIX + relayState, settings);

      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse = new HttpServletResponseWrapper(resp);

      Auth auth = new Auth(settings, wrappedRequest, wrappedResponse);
      // Passes relayState as the RelayState parameter on the SAML AuthnRequest.
      // OneLogin library sends the 302 via wrappedResponse.
      auth.login(relayState);

      return Response.ok().build();
    } catch (Exception e) {
      LOG.error("[SAML Test Login] Failed to initiate", e);
      return TestLoginResponses.buildHtmlErrorResponse(
          "Failed to initiate SAML Test Login: " + e.getMessage());
    }
  }

  public static Response handleCallback(HttpServletRequest req) {
    try {
      String relayState = req.getParameter("RelayState");
      if (nullOrEmpty(relayState) || !relayState.startsWith(RELAY_STATE_PREFIX)) {
        return TestLoginResponses.buildPostMessageResponse(
            false, "Missing or invalid RelayState for SAML Test Login.", null);
      }

      HttpSession session = req.getSession(false);
      if (session == null) {
        return TestLoginResponses.buildPostMessageResponse(
            false, "Session expired. Please try SAML Test Login again.", null);
      }

      Saml2Settings settings =
          (Saml2Settings) session.getAttribute(SESSION_KEY_PREFIX + relayState);
      if (settings == null) {
        return TestLoginResponses.buildPostMessageResponse(
            false, "SAML Test Login session not found (RelayState mismatch).", null);
      }

      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse =
          new HttpServletResponseWrapper(new DummyResponse());

      Auth auth = new Auth(settings, wrappedRequest, wrappedResponse);
      auth.processResponse();

      if (!auth.isAuthenticated()) {
        String reason = auth.getLastErrorReason();
        List<String> errors = auth.getErrors();
        return TestLoginResponses.buildPostMessageResponse(
            false,
            "SAML authentication failed: "
                + (reason != null ? reason : String.join("; ", errors)),
            null);
      }

      Map<String, Object> claims = buildClaimsFromAuth(auth);
      session.removeAttribute(SESSION_KEY_PREFIX + relayState);

      return TestLoginResponses.buildPostMessageResponse(
          true, null, Map.of("claims", claims));
    } catch (Exception e) {
      LOG.error("[SAML Test Login] Callback failed", e);
      return TestLoginResponses.buildPostMessageResponse(
          false, "SAML callback error: " + e.getMessage(), null);
    }
  }

  private static Saml2Settings buildSamlSettings(
      String idpEntityId,
      String idpSsoLoginUrl,
      String idpX509Certificate,
      String spEntityId,
      String spAcsUrl,
      String nameIdFormat) {
    Map<String, Object> samlData = new HashMap<>();
    samlData.put(SettingsBuilder.DEBUG_PROPERTY_KEY, false);

    samlData.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, spEntityId);
    samlData.put(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY, spAcsUrl);
    samlData.put(
        SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_BINDING_PROPERTY_KEY, HTTP_POST_BINDING);
    samlData.put(
        SettingsBuilder.SP_SINGLE_LOGOUT_SERVICE_BINDING_PROPERTY_KEY, HTTP_REDIRECT_BINDING);
    samlData.put(SettingsBuilder.SP_NAMEIDFORMAT_PROPERTY_KEY, nameIdFormat);

    samlData.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, idpEntityId);
    samlData.put(SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY, idpSsoLoginUrl);
    samlData.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_BINDING_PROPERTY_KEY, HTTP_REDIRECT_BINDING);
    samlData.put(
        SettingsBuilder.IDP_SINGLE_LOGOUT_SERVICE_BINDING_PROPERTY_KEY, HTTP_REDIRECT_BINDING);
    samlData.put(SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, idpX509Certificate);

    samlData.put(SettingsBuilder.STRICT_PROPERTY_KEY, false);
    samlData.put(SettingsBuilder.SECURITY_NAMEID_ENCRYPTED, false);
    samlData.put(SettingsBuilder.SECURITY_AUTHREQUEST_SIGNED, false);
    samlData.put(SettingsBuilder.SECURITY_WANT_MESSAGES_SIGNED, false);
    samlData.put(SettingsBuilder.SECURITY_WANT_ASSERTIONS_SIGNED, false);
    samlData.put(SettingsBuilder.SECURITY_WANT_ASSERTIONS_ENCRYPTED, false);
    samlData.put(SettingsBuilder.SECURITY_WANT_NAMEID_ENCRYPTED, false);
    samlData.put(SettingsBuilder.SECURITY_REQUESTED_AUTHNCONTEXTCOMPARISON, "exact");
    samlData.put(
        SettingsBuilder.SECURITY_SIGNATURE_ALGORITHM,
        "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256");
    samlData.put(
        SettingsBuilder.SECURITY_DIGEST_ALGORITHM, "http://www.w3.org/2001/04/xmlenc#sha256");
    samlData.put(SettingsBuilder.UNIQUE_ID_PREFIX_PROPERTY_KEY, "OPENMETADATA_TEST_");

    return new SettingsBuilder().fromValues(samlData).build();
  }

  private static Map<String, Object> buildClaimsFromAuth(Auth auth) {
    Map<String, Object> claims = new LinkedHashMap<>();
    if (!nullOrEmpty(auth.getNameId())) {
      claims.put("nameId", auth.getNameId());
    }
    Map<String, List<String>> attributes = auth.getAttributes();
    if (attributes != null) {
      for (Map.Entry<String, List<String>> entry : attributes.entrySet()) {
        Collection<String> values = entry.getValue();
        if (values == null || values.isEmpty()) {
          continue;
        }
        if (values.size() == 1) {
          claims.put(entry.getKey(), values.iterator().next());
        } else {
          claims.put(entry.getKey(), values);
        }
      }
    }
    return claims;
  }

  private static String buildServerUrl(HttpServletRequest req) {
    int port = req.getServerPort();
    boolean defaultPort = (port == 80 || port == 443);
    return req.getScheme()
        + "://"
        + req.getServerName()
        + (defaultPort ? "" : ":" + port);
  }

  /**
   * Minimal no-op response used when we only need {@link Auth#processResponse()}
   * to validate an incoming SAMLResponse — OneLogin's Auth requires a non-null
   * response object, but we do not use it during response parsing.
   */
  private static final class DummyResponse implements jakarta.servlet.http.HttpServletResponse {
    @Override
    public void addCookie(jakarta.servlet.http.Cookie cookie) {}

    @Override
    public boolean containsHeader(String name) {
      return false;
    }

    @Override
    public String encodeURL(String url) {
      return url;
    }

    @Override
    public String encodeRedirectURL(String url) {
      return url;
    }

    @Override
    public void sendError(int sc, String msg) {}

    @Override
    public void sendError(int sc) {}

    @Override
    public void sendRedirect(String location) {}

    @Override
    public void setDateHeader(String name, long date) {}

    @Override
    public void addDateHeader(String name, long date) {}

    @Override
    public void setHeader(String name, String value) {}

    @Override
    public void addHeader(String name, String value) {}

    @Override
    public void setIntHeader(String name, int value) {}

    @Override
    public void addIntHeader(String name, int value) {}

    @Override
    public void setStatus(int sc) {}

    @Override
    public int getStatus() {
      return 200;
    }

    @Override
    public String getHeader(String name) {
      return null;
    }

    @Override
    public java.util.Collection<String> getHeaders(String name) {
      return java.util.Collections.emptyList();
    }

    @Override
    public java.util.Collection<String> getHeaderNames() {
      return java.util.Collections.emptyList();
    }

    @Override
    public String getCharacterEncoding() {
      return "UTF-8";
    }

    @Override
    public String getContentType() {
      return null;
    }

    @Override
    public jakarta.servlet.ServletOutputStream getOutputStream() {
      return null;
    }

    @Override
    public java.io.PrintWriter getWriter() {
      return null;
    }

    @Override
    public void setCharacterEncoding(String charset) {}

    @Override
    public void setContentLength(int len) {}

    @Override
    public void setContentLengthLong(long len) {}

    @Override
    public void setContentType(String type) {}

    @Override
    public void setBufferSize(int size) {}

    @Override
    public int getBufferSize() {
      return 0;
    }

    @Override
    public void flushBuffer() {}

    @Override
    public void resetBuffer() {}

    @Override
    public boolean isCommitted() {
      return false;
    }

    @Override
    public void reset() {}

    @Override
    public void setLocale(java.util.Locale loc) {}

    @Override
    public java.util.Locale getLocale() {
      return java.util.Locale.getDefault();
    }
  }
}
