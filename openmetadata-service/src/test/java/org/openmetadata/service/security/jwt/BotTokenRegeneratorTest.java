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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.lang.reflect.Constructor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.service.secrets.InMemorySecretsManager;
import org.openmetadata.service.secrets.SecretsManager;

class BotTokenRegeneratorTest {
  private static final long ONE_HOUR = 3600;
  @TempDir static Path dir;
  private static KeyPair keyA;
  private static KeyPair keyB;
  private final JWTTokenGenerator tokenGenerator = newTokenGenerator();
  private final BotTokenRegenerator regenerator = new BotTokenRegenerator(null, tokenGenerator);

  @BeforeAll
  static void generateKeys() throws Exception {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    keyA = generator.generateKeyPair();
    keyB = generator.generateKeyPair();
  }

  private void configure(KeyPair pair, String kid) throws Exception {
    Path privateKey =
        Files.write(dir.resolve(kid + ".private.der"), pair.getPrivate().getEncoded());
    Path publicKey = Files.write(dir.resolve(kid + ".public.der"), pair.getPublic().getEncoded());
    tokenGenerator.init(
        new AuthenticationConfiguration()
            .withTokenValidationAlgorithm(
                AuthenticationConfiguration.TokenValidationAlgorithm.RS_256),
        new JWTTokenConfiguration()
            .withRsaprivateKeyFilePath(privateKey.toString())
            .withRsapublicKeyFilePath(publicKey.toString())
            .withJwtissuer("open-metadata.org")
            .withKeyId(kid));
  }

  private String mint(long expiryInSeconds) {
    return tokenGenerator
        .generateJWTToken(
            "bot",
            Set.of(),
            false,
            "bot@open-metadata.org",
            expiryInSeconds,
            true,
            ServiceTokenType.BOT)
        .getJWTToken();
  }

  private static JWTTokenGenerator newTokenGenerator() {
    try {
      final Constructor<JWTTokenGenerator> constructor =
          JWTTokenGenerator.class.getDeclaredConstructor();
      constructor.setAccessible(true);
      return constructor.newInstance();
    } catch (ReflectiveOperationException exception) {
      throw new AssertionError("Could not construct an isolated JWTTokenGenerator", exception);
    }
  }

  @Test
  void aTokenFromTheConfiguredKeyAndKidIsCurrent() throws Exception {
    configure(keyA, "kid-a");
    String token = mint(ONE_HOUR);

    assertTrue(regenerator.isCurrent(token));
  }

  @Test
  void aTokenFromAnotherKeyIsNotCurrent() throws Exception {
    configure(keyA, "kid-a");
    String token = mint(ONE_HOUR);

    configure(keyB, "kid-a");

    assertFalse(regenerator.isCurrent(token));
  }

  @ParameterizedTest
  @EnumSource(
      value = AuthenticationConfiguration.TokenValidationAlgorithm.class,
      names = {"RS_256", "RS_384", "RS_512"})
  void aLegacyRsaTokenRemainsCurrent(AuthenticationConfiguration.TokenValidationAlgorithm algorithm)
      throws Exception {
    configure(keyA, "kid-a");
    String token =
        JWT.create()
            .withKeyId("kid-a")
            .withExpiresAt(Instant.now().plusSeconds(ONE_HOUR))
            .sign(
                JWTTokenGenerator.getAlgorithm(
                    algorithm, (RSAPublicKey) keyA.getPublic(), (RSAPrivateKey) keyA.getPrivate()));

    assertTrue(regenerator.isCurrent(token));
  }

  @Test
  void unsupportedAlgorithmsAreNotCurrent() throws Exception {
    configure(keyA, "kid-a");

    assertFalse(regenerator.isCurrent(JWT.create().withKeyId("kid-a").sign(Algorithm.none())));
    assertFalse(
        regenerator.isCurrent(
            JWT.create()
                .withKeyId("kid-a")
                .sign(Algorithm.HMAC256(keyA.getPublic().getEncoded()))));
  }

  @Test
  void aTokenWithAnotherKidIsNotCurrent() throws Exception {
    configure(keyA, "kid-a");
    String token = mint(ONE_HOUR);

    configure(keyA, "kid-b");

    assertFalse(regenerator.isCurrent(token));
  }

  @Test
  void anExpiredTokenIsNotCurrent() throws Exception {
    configure(keyA, "kid-a");
    String token = mint(-60);

    assertFalse(regenerator.isCurrent(token));
  }

  @Test
  void aMissingOrMalformedTokenIsNotCurrent() throws Exception {
    configure(keyA, "kid-a");

    assertFalse(regenerator.isCurrent(null));
    assertFalse(regenerator.isCurrent(""));
    assertFalse(regenerator.isCurrent("not-a-jwt"));
  }

  @Test
  void aTokenThatAnExternalSecretsManagerClearedOnRevokeReadsAsNoToken() {
    SecretsManager externalSecretsManager =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null)) {};
    AuthenticationMechanism revoked =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism());

    assertNull(BotTokenRegenerator.readToken(externalSecretsManager, revoked));
  }
}
