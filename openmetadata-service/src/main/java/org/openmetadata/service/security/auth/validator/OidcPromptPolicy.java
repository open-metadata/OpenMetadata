/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.security.auth.validator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationErrorBuilder.FieldPaths;

/**
 * Single source of truth for validating the OIDC {@code prompt} parameter across providers.
 *
 * <p>{@code prompt} controls whether the identity provider shows an interactive login. The value
 * {@code none} requests a silent sign-in that succeeds only when the user already has a live
 * session with the IdP; when the session is missing, stale, or expired the IdP hard-fails (e.g.
 * Azure {@code AADSTS50058}) and the user is locked out with no login screen. That failure depends
 * on per-user session state, so a config-time connectivity check cannot catch it — {@code none} is
 * therefore rejected here for every provider. Values a provider does not accept are rejected too.
 *
 * <p>An empty {@code prompt} is intentionally allowed: existing deployments rely on it and many
 * IdPs show a login screen by default. The empty case is handled by the interactive login gate and
 * the UI's recommended-default pre-fill rather than by blocking here.
 */
public final class OidcPromptPolicy {
  private static final String NONE = "none";

  // Interactive value recommended when prompt is left empty. It always forces a login screen, so it
  // can never trigger the silent-sign-in lockout that 'none' (and an unlucky empty value) can.
  private static final String RECOMMENDED = "select_account";

  // OIDC prompt values each provider accepts at its authorization endpoint. Google does not accept
  // 'login'; Cognito's hosted UI does not accept 'consent'.
  private static final Map<AuthProvider, Set<String>> SUPPORTED =
      Map.of(
          AuthProvider.AZURE, Set.of("login", "consent", "select_account", NONE),
          AuthProvider.GOOGLE, Set.of("consent", "select_account", NONE),
          AuthProvider.OKTA, Set.of("login", "consent", "select_account", NONE),
          AuthProvider.AWS_COGNITO, Set.of("login", "select_account", NONE),
          AuthProvider.AUTH_0, Set.of("login", "consent", "select_account", NONE),
          AuthProvider.CUSTOM_OIDC, Set.of("login", "consent", "select_account", NONE));

  private OidcPromptPolicy() {}

  /**
   * Validate an OIDC {@code prompt} value for the given provider.
   *
   * @return a {@link FieldError} describing the first problem, or {@code null} when the value is
   *     safe to apply (including when it is empty or the provider is not OIDC).
   */
  public static FieldError validate(AuthProvider provider, String prompt) {
    FieldError result = null;
    if (!nullOrEmpty(prompt) && SUPPORTED.containsKey(provider)) {
      String[] tokens = prompt.trim().toLowerCase(Locale.ROOT).split("\\s+");
      result = validateTokens(provider, tokens);
    }
    return result;
  }

  private static FieldError validateTokens(AuthProvider provider, String[] tokens) {
    FieldError result = unsupportedValueError(provider, tokens);
    if (result == null && Arrays.asList(tokens).contains(NONE)) {
      result = noneError(tokens);
    }
    return result;
  }

  private static FieldError unsupportedValueError(AuthProvider provider, String[] tokens) {
    Set<String> supported = SUPPORTED.get(provider);
    FieldError result = null;
    for (String token : tokens) {
      if (!token.isEmpty() && !supported.contains(token)) {
        result =
            error(
                provider
                    + " does not accept prompt value '"
                    + token
                    + "'. Supported values: "
                    + String.join(", ", supported)
                    + " (recommended: "
                    + RECOMMENDED
                    + ").");
        break;
      }
    }
    return result;
  }

  private static FieldError noneError(String[] tokens) {
    String message;
    if (tokens.length > 1) {
      message = "Prompt value 'none' cannot be combined with other values.";
    } else {
      message =
          "Prompt 'none' requests a silent sign-in that only succeeds when the user already has a "
              + "live session with the identity provider; users with an expired or missing session "
              + "are locked out with no login screen. Use '"
              + RECOMMENDED
              + "' or 'login' instead.";
    }
    return error(message);
  }

  private static FieldError error(String message) {
    return ValidationErrorBuilder.createFieldError(FieldPaths.OIDC_PROMPT, message);
  }
}
