/*
 *  Copyright 2025 Collate.
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

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.authn.AuthnRequestParams;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.service.security.SamlIdentityResolver;
import org.openmetadata.service.security.auth.TestLoginService;
import org.openmetadata.service.security.auth.TestLoginStageRecorder;

/**
 * The SAML leg of a Test Login. It sends the admin to the CANDIDATE identity provider and, when the
 * provider posts back to the ACS, validates the assertion against the candidate's certificate and
 * settings exactly as {@link org.openmetadata.service.security.auth.SamlAuthServletHandler} does for
 * a real login — using settings built by the same {@link SamlSettingsHolder#buildSettings}, and never
 * installing them over the live ones. It stops before any user is provisioned or token issued.
 */
@Slf4j
public final class TestLoginSamlHandler {
  private static final String SAML_RESPONSE_PARAMETER = "SAMLResponse";

  private TestLoginSamlHandler() {}

  /**
   * The SP-initiated sign-in URL at the candidate provider, carrying the Test Login marker as
   * RelayState. With a RelayState supplied and {@code stay=true}, OneLogin neither reads a request
   * nor writes a response — it only builds, and when configured signs, the redirect URL.
   */
  @SneakyThrows
  public static String authorize(SamlSSOClientConfig candidate, String marker) {
    Auth auth = new Auth(SamlSettingsHolder.buildSettings(candidate), null, null);
    return auth.login(marker, new AuthnRequestParams(false, false, true), true);
  }

  /** Validates the posted response against the candidate and resolves the identity it carries. */
  public static TestLoginResult complete(
      SecurityConfiguration candidate, HttpServletRequest request, HttpServletResponse response) {
    TestLoginStageRecorder recorder = TestLoginStageRecorder.forProtocol(TestLoginProtocol.SAML);
    recorder.pass(TestLoginStage.STARTED);
    recorder.pass(TestLoginStage.REDIRECTED);
    Optional<Auth> validated =
        hasSamlResponse(request, recorder)
            ? validate(candidate, request, response, recorder)
            : Optional.empty();
    return validated
        .map(
            auth ->
                TestLoginService.resolveSamlIdentity(
                    candidate,
                    assertionOf(auth),
                    SamlSettingsHolder.domainFor(candidate.getAuthorizerConfiguration()),
                    teamsOf(auth, candidate),
                    recorder))
        .orElseGet(() -> TestLoginService.failure(TestLoginProtocol.SAML, recorder));
  }

  private static boolean hasSamlResponse(
      HttpServletRequest request, TestLoginStageRecorder recorder) {
    boolean present = !nullOrEmpty(request.getParameter(SAML_RESPONSE_PARAMETER));
    if (present) {
      recorder.pass(TestLoginStage.TOKEN_RECEIVED);
    } else {
      recorder.fail(TestLoginStage.TOKEN_RECEIVED, "The identity provider posted no SAMLResponse.");
    }
    return present;
  }

  private static Optional<Auth> validate(
      SecurityConfiguration candidate,
      HttpServletRequest request,
      HttpServletResponse response,
      TestLoginStageRecorder recorder) {
    Optional<Auth> validated = Optional.empty();
    try {
      Auth auth =
          new Auth(
              SamlSettingsHolder.buildSettings(
                  candidate.getAuthenticationConfiguration().getSamlConfiguration()),
              new HttpServletRequestWrapper(request),
              new HttpServletResponseWrapper(response));
      auth.processResponse();
      if (isAccepted(auth)) {
        validated = Optional.of(auth);
        recorder.pass(TestLoginStage.TOKEN_VALIDATED);
      } else {
        recorder.fail(TestLoginStage.TOKEN_VALIDATED, rejectionOf(auth));
      }
    } catch (Exception e) {
      // processResponse declares Exception; settings, signature and XML failures all arrive here.
      LOG.debug("Test login could not validate the SAML response", e);
      recorder.fail(
          TestLoginStage.TOKEN_VALIDATED,
          "The SAML response was not accepted: " + TestLoginService.rootMessage(e));
    }
    return validated;
  }

  /** The same acceptance rule the live ACS handler applies. */
  private static boolean isAccepted(Auth auth) {
    return auth.isAuthenticated() && auth.getErrors().isEmpty();
  }

  private static String rejectionOf(Auth auth) {
    String reason = auth.getLastErrorReason();
    return "The SAML response was not accepted: "
        + (nullOrEmpty(reason) ? String.join(", ", auth.getErrors()) : reason);
  }

  private static SamlIdentityResolver.SamlAssertionAccessor assertionOf(Auth auth) {
    return new SamlIdentityResolver.SamlAssertionAccessor() {
      @Override
      public Collection<String> getAttribute(String attributeName) {
        return auth.getAttribute(attributeName);
      }

      @Override
      public String getNameId() {
        return auth.getNameId();
      }
    };
  }

  /** Mirrors the live handler: the attribute named by jwtTeamClaimMapping carries the teams. */
  private static List<String> teamsOf(Auth auth, SecurityConfiguration candidate) {
    String teamClaimMapping = candidate.getAuthenticationConfiguration().getJwtTeamClaimMapping();
    Collection<String> teams =
        nullOrEmpty(teamClaimMapping) ? null : auth.getAttribute(teamClaimMapping);
    return teams == null ? List.of() : List.copyOf(teams);
  }
}
