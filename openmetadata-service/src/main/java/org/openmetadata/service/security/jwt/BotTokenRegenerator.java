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

package org.openmetadata.service.security.jwt;

import com.auth0.jwt.JWT;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.UserUtil;

/**
 * Gives JWT bots tokens signed by the configured signing key. The ops command runs it, and an
 * in-server caller can run it the same way. {@link Scope#ALL} replaces every token. With {@link
 * Scope#STALE}, a bot whose stored token already verifies under the configured key, carries the
 * configured {@code kid} and has not expired is left alone, so a re-run changes nothing that is
 * already current. A bot whose token was revoked is skipped in both and stays without a token.
 *
 * <p>Results carry the bot name, an outcome and a detail, and never a token or an exception
 * message, because an in-server caller may return them over HTTP.
 */
@Slf4j
public class BotTokenRegenerator {
  public enum Outcome {
    REGENERATED,
    ALREADY_CURRENT,
    SKIPPED,
    FAILED
  }

  public record BotResult(String botName, Outcome outcome, String detail) {}

  /** Which bot tokens a run replaces. */
  public enum Scope {
    /** Every token: after a token leaked, for a new expiry, or after the cluster name changed. */
    ALL,
    /** Only tokens the configured key does not sign: what a signing key change leaves behind. */
    STALE
  }

  // revokeToken stores an empty token; regenerating one would re-enable a bot an admin shut off
  static final String TOKEN_REVOKED = "Token revoked";
  static final String CHANGED_CONCURRENTLY = "changed concurrently, re-run";
  // the JWKS check compares only the public key; a private key from another pair signs tokens
  // that no server accepts
  static final String KEY_PAIR_MISMATCH = "Private key does not match the public key";

  private final SecretsManager secretsManager;
  private final JWTTokenGenerator generator;

  public BotTokenRegenerator(SecretsManager secretsManager) {
    this(secretsManager, JWTTokenGenerator.getInstance());
  }

  BotTokenRegenerator(SecretsManager secretsManager, JWTTokenGenerator generator) {
    this.secretsManager = secretsManager;
    this.generator = generator;
  }

  public List<BotResult> regenerateAll(JWTTokenExpiry expiry, Scope scope) {
    Objects.requireNonNull(scope, "scope");
    BotRepository botRepository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
    List<Bot> bots =
        botRepository.listAll(
            botRepository.getFields("botUser"), new ListFilter(Include.NON_DELETED));
    return bots.stream().map(bot -> regenerate(bot.getName(), expiry, scope)).toList();
  }

  private BotResult regenerate(String botName, JWTTokenExpiry expiry, Scope scope) {
    try {
      return regenerateUserOf(botName, expiry, scope);
    } catch (PreconditionFailedException e) {
      return new BotResult(botName, Outcome.FAILED, CHANGED_CONCURRENTLY);
    } catch (RuntimeException e) {
      LOG.error("Failed to regenerate token for bot: {}", botName, e);
      return new BotResult(botName, Outcome.FAILED, e.getClass().getSimpleName() + ", see the log");
    }
  }

  private BotResult regenerateUserOf(String botName, JWTTokenExpiry expiry, Scope scope) {
    Optional<User> botUser = findBotUser(botName);
    if (botUser.isEmpty()) {
      return new BotResult(botName, Outcome.SKIPPED, "No bot user associated");
    }
    AuthenticationMechanism mechanism = botUser.get().getAuthenticationMechanism();
    if (mechanism == null || mechanism.getAuthType() != AuthenticationMechanism.AuthType.JWT) {
      return new BotResult(botName, Outcome.SKIPPED, "Not using JWT authentication");
    }
    String storedToken = readToken(secretsManager, mechanism);
    if (storedToken == null || storedToken.isBlank()) {
      return new BotResult(botName, Outcome.SKIPPED, TOKEN_REVOKED);
    }
    if (scope == Scope.STALE && isCurrent(storedToken)) {
      return new BotResult(botName, Outcome.ALREADY_CURRENT, "Token already current");
    }
    return replaceToken(botName, botUser.get(), expiry);
  }

  private Optional<User> findBotUser(String botName) {
    BotRepository botRepository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
    // Fetched individually so that setFields populates the botUser relationship
    Bot bot = botRepository.getByName(null, botName, botRepository.getFields("botUser"));
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    return Optional.ofNullable(bot.getBotUser())
        .map(
            reference ->
                userRepository.getByName(
                    null,
                    reference.getFullyQualifiedName(),
                    userRepository.getFieldsWithUserAuth("*")));
  }

  /**
   * Saves through {@code updateIfCurrent}, so a bot edited since it was read fails with
   * PreconditionFailedException instead of losing that edit. A JSON patch cannot be used: the user
   * repository restores the authentication mechanism on every patch. That save records no change
   * event, which a REST write would, so the audit log gets one here.
   */
  private BotResult replaceToken(String botName, User botUser, JWTTokenExpiry expiry) {
    JWTAuthMechanism token = generator.generateJWTToken(botUser, expiry);
    if (!isCurrent(token.getJWTToken())) {
      return new BotResult(botName, Outcome.FAILED, KEY_PAIR_MISMATCH);
    }
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    User updated = JsonUtils.deepCopy(botUser, User.class);
    updated.setAuthenticationMechanism(
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(token));
    PutResponse<User> saved =
        userRepository.updateIfCurrent(null, botUser, updated, Entity.ADMIN_USER_NAME);
    UserUtil.createUserChangeEvent(
        saved.getEntity(), EventType.ENTITY_UPDATED, saved.getEntity().getUpdatedBy());
    return new BotResult(botName, Outcome.REGENERATED, "Token regenerated");
  }

  /**
   * The bot token as clients send it: decrypted, and resolved through the secrets manager when the
   * stored value is a reference. Null when there is none: an external secrets manager deletes the
   * secret of a revoked token and stores null in its place.
   */
  public static String readToken(SecretsManager secretsManager, AuthenticationMechanism mechanism) {
    JWTAuthMechanism jwtAuthMechanism =
        JsonUtils.convertValue(mechanism.getConfig(), JWTAuthMechanism.class);
    secretsManager.decryptJWTAuthMechanism(jwtAuthMechanism);
    String token = jwtAuthMechanism.getJWTToken();
    return token != null && secretsManager.isSecret(token)
        ? secretsManager.getSecretValue(token)
        : token;
  }

  boolean isCurrent(String token) {
    if (token == null || token.isBlank()) {
      return false;
    }
    try {
      DecodedJWT verified =
          JWT.require(generator.internalVerificationAlgorithm()).build().verify(token);
      return Objects.equals(generator.getKid(), verified.getKeyId());
    } catch (JWTVerificationException e) {
      return false;
    }
  }
}
