/*
 *  Copyright 2026 Collate.
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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.onelogin.saml2.authn.SamlResponse;
import com.onelogin.saml2.http.HttpRequest;
import com.onelogin.saml2.servlet.ServletUtils;
import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.util.Constants;
import com.onelogin.saml2.util.Util;
import java.util.List;
import org.joda.time.DateTime;
import org.joda.time.Instant;
import org.openmetadata.service.exception.AuthenticationException;
import org.w3c.dom.Document;

/**
 * The checks java-saml runs only in strict mode, applied to every response: the assertion must be
 * current and issued to this service provider. A response the identity provider signed is otherwise
 * accepted however long ago it expired, and whichever service provider it was issued for.
 *
 * <p>{@code Destination} is compared with the configured assertion consumer URL rather than the URL
 * the request arrived on: behind a TLS-terminating proxy those differ, which is why strict mode is
 * often turned off.
 */
public final class SamlResponseValidator {
  private static final long ALLOWED_CLOCK_DRIFT_MILLIS = Constants.ALOWED_CLOCK_DRIFT * 1000L;

  private SamlResponseValidator() {}

  public static void validate(
      Saml2Settings settings, javax.servlet.http.HttpServletRequest request) {
    validate(settings, ServletUtils.makeHttpRequest(request));
  }

  static void validate(Saml2Settings settings, HttpRequest request) {
    try {
      validate(settings, new SamlResponse(settings, request));
    } catch (AuthenticationException e) {
      throw e;
    } catch (Exception e) {
      throw rejected(e.getMessage());
    }
  }

  static void validate(Saml2Settings settings, SamlResponse response) throws Exception {
    response.validateTimestamps();
    requireUnexpiredSubjectConfirmation(response.getAssertionNotOnOrAfter());
    DateTime sessionNotOnOrAfter = response.getSessionNotOnOrAfter();
    if (sessionNotOnOrAfter != null && sessionNotOnOrAfter.isBeforeNow()) {
      throw rejected("the session it grants has expired");
    }
    List<String> audiences = response.getAudiences();
    if (!audiences.isEmpty() && !audiences.contains(settings.getSpEntityId())) {
      throw rejected("it was issued for another service provider");
    }
    String destination = destinationOf(response);
    if (destination != null
        && !destination.equals(String.valueOf(settings.getSpAssertionConsumerServiceUrl()))) {
      throw rejected("it was sent to another assertion consumer service");
    }
  }

  /** The SAML browser profile requires NotOnOrAfter on the bearer confirmation data. */
  private static void requireUnexpiredSubjectConfirmation(List<Instant> notOnOrAfters) {
    if (nullOrEmpty(notOnOrAfters)) {
      throw rejected("its subject confirmation carries no NotOnOrAfter");
    }
    for (Instant notOnOrAfter : notOnOrAfters) {
      if (notOnOrAfter == null || !notOnOrAfter.plus(ALLOWED_CLOCK_DRIFT_MILLIS).isAfterNow()) {
        throw rejected("the assertion has expired");
      }
    }
  }

  private static String destinationOf(SamlResponse response) {
    Document document = Util.loadXML(response.getSAMLResponseXml());
    if (document == null || !document.getDocumentElement().hasAttribute("Destination")) {
      return null;
    }
    return document.getDocumentElement().getAttribute("Destination");
  }

  private static AuthenticationException rejected(String reason) {
    return new AuthenticationException("SAML response rejected: " + reason);
  }
}
