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

package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.auth0.jwt.interfaces.Claim;
import com.github.benmanes.caffeine.cache.Ticker;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.credentials.CredentialVerificationConfig;
import org.openmetadata.service.security.credentials.CredentialVerifierFixture;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/**
 * Mints a token with each call the server issues tokens with, then runs the stored-credential
 * check on it through {@link JwtFilter#validateJwtAndGetClaims}. The filter rejects as unrecognized
 * any claim combination outside the table in {@code OmCredential.classify}, so a mint call that
 * changes its claims fails here first.
 */
class MintedTokensAreRecognizedTest {
  private static final String BOT = "ingestion-bot";
  private static final String USER = "sam";

  /** The {@code jwtTokenExpiryTime} default that login, refresh and session tokens use. */
  private static final long LOGIN_TOKEN_SECONDS = 3600L;

  /** {@code UserSSOOAuthProvider} mints its access tokens for ten minutes. */
  private static final long MCP_ACCESS_TOKEN_SECONDS = 600L;

  private static final String MCP_CLIENT_ID = "mcp-client";

  private static JWTTokenGenerator generator;
  private CredentialVerifierFixture credentials;
  private JwtFilter filter;

  @BeforeAll
  static void signWithTheServerKey() {
    generator = OpenMetadataSigningKey.install();
  }

  @BeforeEach
  void newVerifier() {
    credentials =
        new CredentialVerifierFixture(
            new SimpleMeterRegistry(),
            Ticker.systemTicker(),
            CredentialVerificationConfig.defaults());
    filter =
        new JwtFilter(
            OpenMetadataSigningKey.keyLookup(),
            List.of("sub", "email"),
            "openmetadata.org",
            false,
            credentials::verifier);
  }

  @AfterEach
  void stopVerifier() {
    credentials.close();
  }

  @ParameterizedTest
  @EnumSource(MintedToken.class)
  void mintedTokenIsAcceptedAndReadBackOnlyWhenKeptForTheVerifier(MintedToken minted) {
    String token = minted.mint.apply(generator).getJWTToken();
    minted.storage.store(credentials, minted.principal, token);

    Map<String, Claim> claims = filter.validateJwtAndGetClaims(token);

    assertEquals(minted.principal, claims.get("sub").asString());
    assertEquals(minted.storage.readsOnFirstCheck, credentials.fullReadsOf(minted.principal));
  }

  /**
   * Where the server keeps a minted token for the verifier. A check reads back only what is kept
   * there.
   */
  private enum Storage {
    AUTHENTICATION_MECHANISM(1),
    PERSONAL_ACCESS_TOKEN_ROW(1),
    NONE(0);

    private final int readsOnFirstCheck;

    Storage(int readsOnFirstCheck) {
      this.readsOnFirstCheck = readsOnFirstCheck;
    }

    void store(CredentialVerifierFixture credentials, String principal, String token) {
      switch (this) {
        case AUTHENTICATION_MECHANISM -> credentials.withJwtMechanisms(Map.of(principal, token));
        case PERSONAL_ACCESS_TOKEN_ROW -> credentials.withPats(Map.of(principal, List.of(token)));
        case NONE -> {}
      }
    }
  }

  /** Each issuing call, made with the arguments its call site passes. */
  private enum MintedToken {
    /**
     * Bootstrap ({@code UserUtil}), bot create or update ({@code UserResource}), app bots ({@code
     * AppRepository}) and {@code OpenMetadataOperations.regenerateBotTokens}.
     */
    BOT_TOKEN(
        BOT,
        Storage.AUTHENTICATION_MECHANISM,
        tokens -> tokens.generateJWTToken(user(BOT, true), JWTTokenExpiry.Unlimited)),

    /** {@code UserResource.createAccessToken}, behind {@code PUT /v1/users/security/token}. */
    PERSONAL_ACCESS_TOKEN(
        USER,
        Storage.PERSONAL_ACCESS_TOKEN_ROW,
        tokens ->
            tokens.getJwtAuthMechanism(
                USER,
                new HashSet<>(),
                false,
                emailOf(USER),
                false,
                ServiceTokenType.PERSONAL_ACCESS,
                JWTTokenGenerator.getExpiryDate(JWTTokenExpiry.Seven),
                null)),

    /** Browser login: {@code BasicAuthServletHandler}, {@code LdapAuthServletHandler}, SAML. */
    SESSION_BOUND_TOKEN(
        USER,
        Storage.NONE,
        tokens ->
            tokens.generateJWTTokenForSession(
                USER,
                new HashSet<>(),
                false,
                emailOf(USER),
                LOGIN_TOKEN_SECONDS,
                ServiceTokenType.OM_USER,
                UUID.randomUUID().toString())),

    /**
     * {@code AuthenticatorHandler.getJwtResponse} behind {@code /v1/users/login}, and {@code
     * getNewAccessToken} of the basic and LDAP authenticators behind {@code /v1/users/refresh}.
     */
    LOGIN_OR_REFRESH_TOKEN(
        USER,
        Storage.NONE,
        tokens ->
            tokens.generateJWTToken(
                USER,
                new HashSet<>(),
                false,
                emailOf(USER),
                LOGIN_TOKEN_SECONDS,
                false,
                ServiceTokenType.OM_USER)),

    /**
     * The MCP module's {@code UserSSOOAuthProvider.issueAccessToken}. The server keeps the token in
     * {@code oauth_access_tokens}, which {@code JwtFilter} looks up itself, so the verifier keeps
     * nothing for it.
     */
    MCP_OAUTH_ACCESS_TOKEN(
        USER,
        Storage.NONE,
        tokens ->
            tokens.generateJWTToken(
                USER,
                new HashSet<>(),
                false,
                emailOf(USER),
                MCP_ACCESS_TOKEN_SECONDS,
                false,
                ServiceTokenType.OM_USER,
                List.of("openid", "profile", "email"),
                MCP_CLIENT_ID));

    private final String principal;
    private final Storage storage;
    private final Function<JWTTokenGenerator, JWTAuthMechanism> mint;

    MintedToken(
        String principal, Storage storage, Function<JWTTokenGenerator, JWTAuthMechanism> mint) {
      this.principal = principal;
      this.storage = storage;
      this.mint = mint;
    }
  }

  private static User user(String name, boolean isBot) {
    return new User().withName(name).withEmail(emailOf(name)).withIsBot(isBot).withIsAdmin(false);
  }

  private static String emailOf(String name) {
    return name + "@openmetadata.org";
  }
}
