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

package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.security.interfaces.RSAPublicKey;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntPredicate;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.service.bench.BenchSession;
import org.openmetadata.service.bench.BenchSession.Config;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/**
 * Baseline for the bot and personal-access-token check that {@link CredentialTokenState} performs
 * in local mode, taken before the class is replaced. The name does not match the surefire includes,
 * so CI never runs it. Run it from the repository root, once per JVM:
 *
 * <pre>
 * mvn -pl openmetadata-service test -Dtest=LegacyCredentialCheckBenchmark \
 *     -Dsurefire.failIfNoSpecifiedTests=false
 * </pre>
 *
 * Results land in {@code openmetadata-service/target/credential-bench/}. {@code rs256Verify} times
 * the work {@code JwtFilter.decodeAndVerify} does (decode, expiry check, signature verify with a
 * fresh {@code Algorithm}) on a token minted by {@link JWTTokenGenerator}. The check is CPU bound
 * (SHA-256 of the presented token, then a split and compare) and the verify is CPU bound (RSA).
 * An end-to-end case through {@code JwtFilter} is left out: its test setup mocks the user
 * repository and the bot-token cache statics, so it would time the mocks.
 */
@Tag("benchmark")
class LegacyCredentialCheckBenchmark {
  private static final Config SINGLE_THREAD = new Config(20, 30, 100_000);
  private static final Config CONTENDED = new Config(20, 30, 10_000);
  private static final Config VERIFY_SINGLE = new Config(20, 30, 2_000);
  private static final Config VERIFY_CONTENDED = new Config(20, 30, 200);
  private static final int CONTENDED_THREADS = 64;
  private static final int POOL_SIZE = 20;
  private static final int[] TOKENS_PER_USER = {1, 5, 20};

  private final BenchSession session = new BenchSession("legacy-credential-check");
  private final CredentialTokenState state =
      new CredentialTokenState(new NoopCacheProvider(), new CacheKeys("bench:legacy"), false);
  private RSAPublicKey publicKey;
  private List<String> botTokens;
  private List<String> patTokens;

  @Test
  void measureLegacyCredentialCheck() throws Exception {
    mintTokens();
    rs256Verify();
    for (CredentialTokenState.Kind kind : CredentialTokenState.Kind.values()) {
      for (int tokensPerUser : TOKENS_PER_USER) {
        legacyLocalHit(kind, tokensPerUser);
      }
    }
    System.out.println(session.finish());
  }

  private void mintTokens() throws URISyntaxException {
    JWTTokenConfiguration configuration =
        new JWTTokenConfiguration()
            .withJwtissuer("open-metadata.org")
            .withKeyId("bench-signing-key")
            .withRsaprivateKeyFilePath(resourcePath("private_key.der"))
            .withRsapublicKeyFilePath(resourcePath("public_key.der"));
    JWTTokenGenerator generator = JWTTokenGenerator.getInstance();
    generator.init(
        new AuthenticationConfiguration()
            .withTokenValidationAlgorithm(
                AuthenticationConfiguration.TokenValidationAlgorithm.RS_256),
        configuration);
    publicKey = generator.getPublicKey();
    botTokens = mint(generator, "bench-bot-", true, ServiceTokenType.BOT);
    patTokens = mint(generator, "bench-pat-", false, ServiceTokenType.PERSONAL_ACCESS);
  }

  private static List<String> mint(
      JWTTokenGenerator generator, String prefix, boolean isBot, ServiceTokenType type) {
    List<String> tokens = new ArrayList<>();
    long oneDaySeconds = 24 * 3600L;
    for (int i = 0; i < POOL_SIZE; i++) {
      tokens.add(
          generator
              .generateJWTToken(
                  prefix + i,
                  new HashSet<>(Set.of("IngestionBotRole")),
                  false,
                  prefix + i + "@open-metadata.org",
                  oneDaySeconds,
                  isBot,
                  type)
              .getJWTToken());
    }
    return tokens;
  }

  private static String resourcePath(String name) throws URISyntaxException {
    return Path.of(Thread.currentThread().getContextClassLoader().getResource(name).toURI())
        .toString();
  }

  private void rs256Verify() {
    String token = botTokens.get(0);
    IntPredicate verify = worker -> verifyLikeJwtFilter(token);
    session.run("rs256Verify", 1, VERIFY_SINGLE, verify);
    session.run("rs256Verify", CONTENDED_THREADS, VERIFY_CONTENDED, verify);
  }

  private boolean verifyLikeJwtFilter(String token) {
    DecodedJWT jwt = JWT.decode(token);
    if (jwt.getExpiresAt().before(new Date())) {
      return false;
    }
    Algorithm.RSA256(publicKey, null).verify(jwt);
    return true;
  }

  private void legacyLocalHit(CredentialTokenState.Kind kind, int tokensPerUser) {
    List<String> pool = kind == CredentialTokenState.Kind.BOT ? botTokens : patTokens;
    Set<String> stored = new HashSet<>(pool.subList(0, tokensPerUser));
    String presented = pool.get(tokensPerUser / 2);
    String label = "legacyLocalHit/" + kind + "/tokens=" + tokensPerUser;
    runCell(label + "/1thread", kind, stored, presented, 1, false, SINGLE_THREAD);
    runCell(label + "/samePrincipal", kind, stored, presented, CONTENDED_THREADS, false, CONTENDED);
    runCell(
        label + "/distinctPrincipals", kind, stored, presented, CONTENDED_THREADS, true, CONTENDED);
  }

  /**
   * The loader may run once per principal, during the first warm-up call. Any later load means an
   * entry was evicted or expired mid-run and the measured calls did not take the hit path.
   */
  private void runCell(
      String label,
      CredentialTokenState.Kind kind,
      Set<String> stored,
      String presented,
      int threads,
      boolean distinctPrincipals,
      Config config) {
    AtomicInteger loads = new AtomicInteger();
    int principals = distinctPrincipals ? threads : 1;
    String cell = label.replace('/', '-');
    IntPredicate hit =
        worker -> {
          String user = cell + "-" + (distinctPrincipals ? worker : 0);
          return state.isTokenValid(
              kind,
              user,
              presented,
              () -> {
                loads.incrementAndGet();
                return stored;
              });
        };
    session.run(label, threads, config, hit);
    assertEquals(principals, loads.get(), label + ": loader calls beyond the warm-up loads");
  }
}
