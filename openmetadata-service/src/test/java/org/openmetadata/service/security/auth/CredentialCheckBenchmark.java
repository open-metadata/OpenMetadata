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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.github.benmanes.caffeine.cache.Ticker;
import io.micrometer.core.instrument.composite.CompositeMeterRegistry;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.security.interfaces.RSAPublicKey;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.service.security.credentials.CredentialSubject;
import org.openmetadata.service.security.credentials.CredentialVerificationConfig;
import org.openmetadata.service.security.credentials.CredentialVerifierFixture;
import org.openmetadata.service.security.credentials.OmCredential;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/**
 * Interleaved comparison of the legacy stored-credential check ({@link CredentialTokenState}, local
 * mode) with the {@code CredentialVerifier}. Each legacy cell is followed by the matching verifier
 * cell in the same JVM, so machine load falls on both alike. The name does not match the surefire
 * includes, so CI never runs it. Run it from the repository root, once per JVM:
 *
 * <pre>
 * mvn -pl openmetadata-service test -Dtest=CredentialCheckBenchmark \
 *     -Dsurefire.failIfNoSpecifiedTests=false
 * </pre>
 *
 * Results land in {@code openmetadata-service/target/credential-bench/}. {@code rs256Verify} times
 * the work {@code JwtFilter.decodeAndVerify} does (decode, expiry check, signature verify with a
 * fresh {@code Algorithm}) on a token minted by {@link JWTTokenGenerator}. The verifier runs as in
 * production: system ticker, default config, sweep started, and a Prometheus registry behind a
 * composite. A verifier cell is timed from a warmed cache: its principals are read once during
 * warm-up and the cell fails if any later call took the request-thread read path. The principal's
 * {@link CredentialSubject} is built outside the timed call, as the legacy cell builds its name; the
 * {@code credentialSubjectOf} cell prices what {@code JwtFilter} pays to build it per request.
 */
@Tag("benchmark")
class CredentialCheckBenchmark {
  private static final Config SINGLE_THREAD = new Config(20, 30, 100_000);
  private static final Config CONTENDED = new Config(20, 30, 10_000);
  private static final Config VERIFY_SINGLE = new Config(20, 30, 2_000);
  private static final Config VERIFY_CONTENDED = new Config(20, 30, 200);
  private static final int CONTENDED_THREADS = 64;
  private static final int POOL_SIZE = 20;
  private static final int[] TOKENS_PER_USER = {1, 5, 20};
  private static final List<Variant> VARIANTS =
      List.of(
          new Variant("1thread", 1, false, SINGLE_THREAD),
          new Variant("samePrincipal", CONTENDED_THREADS, false, CONTENDED),
          new Variant("distinctPrincipals", CONTENDED_THREADS, true, CONTENDED));

  /** One way of driving a cell: how many threads, and whether each presents its own principal. */
  private record Variant(String name, int threads, boolean distinctPrincipals, Config config) {
    int principals() {
      return distinctPrincipals ? threads : 1;
    }
  }

  /** One matched cell. {@code names} holds the principal each worker presents, built up front. */
  private record Cell(
      CredentialTokenState.Kind kind,
      int tokensPerUser,
      Variant variant,
      List<String> stored,
      String presented) {
    String label(String implementation) {
      return implementation + "/" + kind + "/tokens=" + tokensPerUser + "/" + variant.name();
    }

    String[] names(String implementation) {
      String prefix = label(implementation).replace('/', '-') + "-";
      String[] names = new String[variant.threads()];
      for (int worker = 0; worker < names.length; worker++) {
        names[worker] = prefix + (variant.distinctPrincipals() ? worker : 0);
      }
      return names;
    }
  }

  private final BenchSession session = new BenchSession("credential-check");
  private final CredentialTokenState state =
      new CredentialTokenState(new NoopCacheProvider(), new CacheKeys("bench:legacy"), false);
  private final StringBuilder verifierProof = new StringBuilder();
  private long sweepFingerprintReads;
  private RSAPublicKey publicKey;
  private List<String> botTokens;
  private List<String> patTokens;

  @Test
  void measureCredentialCheck() throws Exception {
    mintTokens();
    rs256Verify();
    credentialSubjectOf();
    for (CredentialTokenState.Kind kind : CredentialTokenState.Kind.values()) {
      for (int tokensPerUser : TOKENS_PER_USER) {
        matchedCells(kind, tokensPerUser);
      }
    }
    System.out.println(session.finish());
    System.out.println(verifierProof);
    System.out.println("sweepFingerprintReadsTotal=" + sweepFingerprintReads);
    assertTrue(sweepFingerprintReads > 0, "the sweep never ran during the verifier cells");
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

  private void credentialSubjectOf() {
    IntPredicate build =
        worker -> {
          OmCredential.Stored stored =
              new OmCredential.Stored(CredentialSubject.of("credentialSubjectOf-bench-bot-0"));
          return !stored.subject().principal().isEmpty();
        };
    session.run("credentialSubjectOf/1thread", 1, SINGLE_THREAD, build);
  }

  private void matchedCells(CredentialTokenState.Kind kind, int tokensPerUser) {
    List<String> pool = kind == CredentialTokenState.Kind.BOT ? botTokens : patTokens;
    List<String> stored = pool.subList(0, tokensPerUser);
    String presented = pool.get(tokensPerUser / 2);
    for (Variant variant : VARIANTS) {
      Cell cell = new Cell(kind, tokensPerUser, variant, stored, presented);
      legacyCell(cell);
      verifierCell(cell);
    }
  }

  /**
   * The loader may run once per principal, during the first warm-up call. Any later load means an
   * entry was evicted or expired mid-run and the measured calls did not take the hit path.
   */
  private void legacyCell(Cell cell) {
    String label = cell.label("legacyLocalHit");
    String[] names = cell.names("legacyLocalHit");
    Set<String> stored = new HashSet<>(cell.stored());
    AtomicInteger loads = new AtomicInteger();
    IntPredicate hit =
        worker ->
            state.isTokenValid(
                cell.kind(),
                names[worker],
                cell.presented(),
                () -> {
                  loads.incrementAndGet();
                  return stored;
                });
    session.run(label, cell.variant().threads(), cell.variant().config(), hit);
    assertEquals(
        cell.variant().principals(),
        loads.get(),
        label + ": loader calls beyond the warm-up loads");
  }

  /**
   * A bot principal's entry holds its one mechanism digest; a personal-access-token principal's
   * entry holds every stored token. The check throws on rejection, so the session's accepted-equals-
   * invoked check also holds. Each principal is warmed by one call on this thread, because 64
   * threads missing together at the first sample would race to read it a varying number of times.
   * Request-thread reads, counted from the verifier's own meters, must equal the principals warmed.
   */
  private void verifierCell(Cell cell) {
    String label = cell.label("verifierHit");
    String[] names = cell.names("verifierHit");
    CompositeMeterRegistry registry = new CompositeMeterRegistry();
    registry.add(new PrometheusMeterRegistry(PrometheusConfig.DEFAULT));
    try (CredentialVerifierFixture fixture =
        new CredentialVerifierFixture(
            registry, Ticker.systemTicker(), CredentialVerificationConfig.defaults())) {
      store(fixture, cell, names);
      fixture.start();
      OmCredential[] credentials = credentials(names);
      for (OmCredential credential : credentials) {
        fixture.verifier().require(credential, cell.presented(), "bench");
      }
      IntPredicate hit =
          worker -> {
            fixture.verifier().require(credentials[worker], cell.presented(), "bench");
            return true;
          };
      session.run(label, cell.variant().threads(), cell.variant().config(), hit);
      recordProof(label, cell, registry, fixture);
    } finally {
      registry.close();
    }
  }

  private static void store(CredentialVerifierFixture fixture, Cell cell, String[] names) {
    Map<String, List<String>> pats = new LinkedHashMap<>();
    Map<String, String> mechanisms = new LinkedHashMap<>();
    for (String name : names) {
      if (cell.kind() == CredentialTokenState.Kind.BOT) {
        mechanisms.put(name, cell.presented());
      } else {
        pats.put(name, cell.stored());
      }
    }
    fixture.withPats(pats).withJwtMechanisms(mechanisms);
  }

  private static OmCredential[] credentials(String[] names) {
    OmCredential[] credentials = new OmCredential[names.length];
    for (int i = 0; i < names.length; i++) {
      credentials[i] = new OmCredential.Stored(CredentialSubject.of(names[i]));
    }
    return credentials;
  }

  private void recordProof(
      String label, Cell cell, CompositeMeterRegistry registry, CredentialVerifierFixture fixture) {
    long requestReads =
        readsOnRequestThread(registry, "miss") + readsOnRequestThread(registry, "stale");
    int fingerprintReads = fixture.fingerprintReads();
    sweepFingerprintReads += fingerprintReads;
    verifierProof.append(
        String.format(
            "proof %s requestThreadReads=%d fingerprintReads=%d%n",
            label, requestReads, fingerprintReads));
    assertEquals(
        cell.variant().principals(),
        requestReads,
        label + ": request-thread reads beyond the warm-up reads");
  }

  private static long readsOnRequestThread(CompositeMeterRegistry registry, String reason) {
    return registry.get("om.credential.read").tag("reason", reason).timer().count();
  }
}
