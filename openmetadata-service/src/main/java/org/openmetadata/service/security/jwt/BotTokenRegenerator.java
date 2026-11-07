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
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.secrets.SecretsManager;

/**
 * Gives every JWT bot a token signed by the configured signing key. The ops command runs it after
 * the key was replaced, and an in-server caller can run it the same way. A bot whose stored token
 * already verifies under the configured key, carries the configured {@code kid} and has not
 * expired is left alone, so a re-run changes nothing that is already current.
 *
 * <p>Results carry the bot name, an outcome and a detail, and never a token.
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

  static final String CHANGED_CONCURRENTLY = "changed concurrently, re-run";
  private static final String UPDATED_BY = "admin";

  private final SecretsManager secretsManager;
  private final JWTTokenGenerator generator;

  public BotTokenRegenerator(SecretsManager secretsManager) {
    this(secretsManager, JWTTokenGenerator.getInstance());
  }

  BotTokenRegenerator(SecretsManager secretsManager, JWTTokenGenerator generator) {
    this.secretsManager = secretsManager;
    this.generator = generator;
  }

  public List<BotResult> regenerateAll(JWTTokenExpiry expiry) {
    BotRepository botRepository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    List<Bot> bots =
        botRepository.listAll(
            botRepository.getFields("botUser"), new ListFilter(Include.NON_DELETED));
    List<BotResult> results = new ArrayList<>();
    for (Bot listedBot : bots) {
      results.add(regenerate(botRepository, userRepository, listedBot.getName(), expiry));
    }
    return results;
  }

  private BotResult regenerate(
      BotRepository botRepository,
      UserRepository userRepository,
      String botName,
      JWTTokenExpiry expiry) {
    try {
      // Fetched individually so that setFields populates the botUser relationship
      Bot bot = botRepository.getByName(null, botName, botRepository.getFields("botUser"));
      if (bot.getBotUser() == null) {
        return new BotResult(botName, Outcome.SKIPPED, "No bot user associated");
      }
      User botUser =
          userRepository.getByName(
              null,
              bot.getBotUser().getFullyQualifiedName(),
              userRepository.getFieldsWithUserAuth("*"));
      AuthenticationMechanism mechanism = botUser.getAuthenticationMechanism();
      if (mechanism == null || mechanism.getAuthType() != AuthenticationMechanism.AuthType.JWT) {
        return new BotResult(botName, Outcome.SKIPPED, "Not using JWT authentication");
      }
      if (isCurrent(readToken(secretsManager, mechanism))) {
        return new BotResult(botName, Outcome.ALREADY_CURRENT, "Token already current");
      }
      User updated = JsonUtils.deepCopy(botUser, User.class);
      updated.setAuthenticationMechanism(
          new AuthenticationMechanism()
              .withAuthType(AuthenticationMechanism.AuthType.JWT)
              .withConfig(generator.generateJWTToken(botUser, expiry)));
      userRepository.updateIfCurrent(null, botUser, updated, UPDATED_BY);
      return new BotResult(botName, Outcome.REGENERATED, "Token regenerated");
    } catch (PreconditionFailedException e) {
      return new BotResult(botName, Outcome.FAILED, CHANGED_CONCURRENTLY);
    } catch (Exception e) {
      LOG.error("Failed to regenerate token for bot: {}", botName, e);
      return new BotResult(botName, Outcome.FAILED, e.getMessage());
    }
  }

  /**
   * The bot token as clients send it: decrypted, and resolved through the secrets manager when the
   * stored value is a reference.
   */
  public static String readToken(SecretsManager secretsManager, AuthenticationMechanism mechanism) {
    JWTAuthMechanism jwtAuthMechanism =
        JsonUtils.convertValue(mechanism.getConfig(), JWTAuthMechanism.class);
    secretsManager.decryptJWTAuthMechanism(jwtAuthMechanism);
    String token = jwtAuthMechanism.getJWTToken();
    return secretsManager.isSecret(token) ? secretsManager.getSecretValue(token) : token;
  }

  boolean isCurrent(String token) {
    if (token == null || token.isBlank()) {
      return false;
    }
    try {
      DecodedJWT verified =
          JWT.require(generator.internalVerificationAlgorithm()).build().verify(token);
      return generator.getKid().equals(verified.getKeyId());
    } catch (JWTVerificationException e) {
      return false;
    }
  }
}
