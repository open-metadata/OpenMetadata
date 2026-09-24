/*
 *  Copyright 2026 Collate
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

import com.onelogin.saml2.authn.SamlResponse;
import com.onelogin.saml2.factory.SamlMessageFactory;
import com.onelogin.saml2.http.HttpRequest;
import com.onelogin.saml2.settings.Saml2Settings;

/**
 * Validates a SAML response against the Assertion Consumer Service URL the login actually sent the
 * identity provider.
 *
 * <p>In strict mode onelogin checks the response's {@code Destination} and {@code Recipient} against
 * the URL the request arrived on as the servlet container sees it. Behind a load balancer that is
 * the internal hop, never the public ACS URL the identity provider posted to, so every response
 * would be rejected. The ACS in {@code settings} is the one this login's AuthnRequest carried.
 */
public final class AcsDestinationSamlMessageFactory implements SamlMessageFactory {

  @Override
  public SamlResponse createSamlResponse(Saml2Settings settings, HttpRequest request)
      throws Exception {
    SamlResponse response = new SamlResponse(settings, request);
    response.setDestinationUrl(settings.getSpAssertionConsumerServiceUrl().toString());
    return response;
  }
}
