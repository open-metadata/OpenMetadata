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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.ChangePasswordRequest;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.PasswordResetRequest;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.auth.BasicAuthenticator;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.TokenUtil;

/**
 * A new password ends the sign-ins made with the old one. The suite's server does not use basic
 * authentication, so its password endpoints refuse; the authenticator runs here in-process instead,
 * against the server's own stores (ADR:2026-11-03-a-password-change-ends-the-users-sign-ins).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class PasswordChangeIT {
  private static final String PASSWORD = "Sign!In-Passw0rd";
  private static final String NEW_PASSWORD = "Changed!Passw0rd";

  private final BasicAuthenticator authenticator = new BasicAuthenticator();

  @BeforeEach
  void initAuthenticator() {
    // 2.0's BasicAuthenticator reads the authorizer configuration at init; these flows use none of
    // it.
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setAuthorizerConfiguration(new AuthorizerConfiguration());
    authenticator.init(config);
  }

  @Test
  void anAdminsChangeEndsTheUsersRefreshTokens(TestNamespace ns) throws Exception {
    User user = createPasswordUser(ns, "adminpw");
    String refreshToken = signIn(user);

    authenticator.changeUserPwdWithOldPwd(
        null,
        user.getName(),
        new ChangePasswordRequest()
            .withRequestType(ChangePasswordRequest.RequestType.USER)
            .withUsername(user.getName())
            .withNewPassword(NEW_PASSWORD)
            .withConfirmPassword(NEW_PASSWORD));

    assertRefreshRefused(refreshToken);
  }

  @Test
  void theUsersOwnChangeEndsRefreshTokensAndKeepsPersonalAccessTokens(TestNamespace ns)
      throws Exception {
    User user = createPasswordUser(ns, "selfpw");
    String refreshToken = signIn(user);
    String personalAccessToken = createPersonalAccessToken(user, ns);

    authenticator.changeUserPwdWithOldPwd(
        null,
        user.getName(),
        new ChangePasswordRequest()
            .withRequestType(ChangePasswordRequest.RequestType.SELF)
            .withOldPassword(PASSWORD)
            .withNewPassword(NEW_PASSWORD)
            .withConfirmPassword(NEW_PASSWORD));

    assertRefreshRefused(refreshToken);
    assertEquals(
        user.getId(),
        clientWithToken(personalAccessToken)
            .getHttpClient()
            .execute(HttpMethod.GET, "/v1/users/loggedInUser", null, User.class)
            .getId());
  }

  @Test
  void aResetEndsTheUsersRefreshTokens(TestNamespace ns) throws Exception {
    User user = createPasswordUser(ns, "resetpw");
    String refreshToken = signIn(user);
    UUID resetToken = UUID.randomUUID();
    Entity.getTokenRepository()
        .insertToken(TokenUtil.getPasswordResetToken(user.getId(), resetToken));

    authenticator.resetUserPasswordWithToken(
        null,
        new PasswordResetRequest()
            .withUsername(user.getName())
            .withToken(resetToken.toString())
            .withPassword(NEW_PASSWORD)
            .withConfirmPassword(NEW_PASSWORD));

    assertRefreshRefused(refreshToken);
  }

  private static User createPasswordUser(TestNamespace ns, String base) {
    String userName = ns.shortPrefix(base);
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(userName)
                .withEmail(userName + "@example.com")
                .withPassword(PASSWORD)
                .withConfirmPassword(PASSWORD)
                .withCreatePasswordType(CreateUser.CreatePasswordType.ADMIN_CREATE)
                .withIsBot(false));
  }

  /** Signs in with the password and returns the refresh token the sign-in issued. */
  private String signIn(User user) throws Exception {
    return authenticator
        .loginUser(new LoginRequest().withEmail(user.getEmail()).withPassword(PASSWORD))
        .getRefreshToken();
  }

  private void assertRefreshRefused(String refreshToken) {
    assertThrows(
        EntityNotFoundException.class,
        () ->
            authenticator.getNewAccessToken(
                new TokenRefreshRequest().withRefreshToken(refreshToken)));
  }

  private static String createPersonalAccessToken(User user, TestNamespace ns) {
    String accessToken =
        JWTTokenGenerator.getInstance()
            .generateJWTToken(
                user.getName(),
                Set.of(),
                false,
                user.getEmail(),
                3600,
                false,
                ServiceTokenType.OM_USER)
            .getJWTToken();
    String created =
        clientWithToken(accessToken)
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/users/security/token",
                Map.of("tokenName", ns.prefix("pat"), "JWTTokenExpiry", "OneHour"));
    return JsonUtils.readValue(created, PersonalAccessToken.class).getJwtToken();
  }

  private static OpenMetadataClient clientWithToken(String token) {
    return new OpenMetadataClient(
        OpenMetadataConfig.builder()
            .serverUrl(SdkClients.getServerUrl())
            .accessToken(token)
            .build());
  }
}
