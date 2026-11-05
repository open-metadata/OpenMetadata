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

package org.openmetadata.it.tests.security.scale;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.IntFunction;
import org.openmetadata.it.tests.CredentialFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/**
 * Principals in bulk. Users go through the REST API; their personal access tokens are signed by the
 * server's own generator and stored through {@link TokenRepository}, the call the create-token
 * endpoint makes, because 80,000 REST round trips would dwarf the thing being measured. The rows
 * are the ones the endpoint writes.
 *
 * <p>Uses only classes that every OpenMetadata version has, so a benchmark built on it also runs
 * against a build without the credential verifier.
 */
final class CredentialPopulation {
  private static final int SETUP_PARALLELISM = 16;

  private CredentialPopulation() {}

  /** A principal and the tokens that are valid for it; the first is the one a request presents. */
  static final class Principal {
    private final String name;
    private final List<PersonalAccessToken> pats;
    private final String botToken;

    Principal(String name, List<PersonalAccessToken> pats, String botToken) {
      this.name = name;
      this.pats = pats;
      this.botToken = botToken;
    }

    String name() {
      return name;
    }

    String rawToken() {
      return botToken != null ? botToken : pats.get(0).getJwtToken();
    }

    int patCount() {
      return pats.size();
    }

    /** Removes the stored rows beyond the first {@code keep}, as a revoke of the others would. */
    void keepPats(int keep, TokenRepository tokens) {
      while (pats.size() > keep) {
        tokens.deleteToken(pats.remove(pats.size() - 1).getToken().toString());
      }
    }
  }

  static List<Principal> users(TestNamespace ns, String base, int count, int patsEach) {
    TokenRepository tokens = new TokenRepository();
    return inParallel(count, SETUP_PARALLELISM, i -> user(ns, base + i, patsEach, tokens));
  }

  static List<Principal> bots(TestNamespace ns, String base, int count) {
    return inParallel(
        count,
        SETUP_PARALLELISM,
        i -> {
          User bot = CredentialFixtures.createBot(ns, base + i);
          return new Principal(bot.getName(), List.of(), CredentialFixtures.botToken(bot));
        });
  }

  private static Principal user(TestNamespace ns, String base, int pats, TokenRepository tokens) {
    String name = base + ns.shortPrefix();
    User user =
        SdkClients.adminClient()
            .users()
            .create(new CreateUser().withName(name).withEmail(name + "@open-metadata.org"));
    List<PersonalAccessToken> created = new ArrayList<>();
    for (int p = 0; p < pats; p++) {
      PersonalAccessToken pat = signedPat(user, "pat" + p);
      tokens.insertToken(pat);
      created.add(pat);
    }
    return new Principal(user.getName(), created, null);
  }

  private static PersonalAccessToken signedPat(User user, String tokenName) {
    JWTAuthMechanism jwt =
        JWTTokenGenerator.getInstance()
            .getJwtAuthMechanism(
                user.getName(),
                Set.of(),
                false,
                user.getEmail(),
                false,
                ServiceTokenType.PERSONAL_ACCESS,
                JWTTokenGenerator.getExpiryDate(JWTTokenExpiry.Seven),
                null);
    return new PersonalAccessToken()
        .withToken(UUID.randomUUID())
        .withTokenName(tokenName)
        .withUserId(user.getId())
        .withTokenType(TokenType.PERSONAL_ACCESS_TOKEN)
        .withJwtToken(jwt.getJWTToken())
        .withExpiryDate(jwt.getJWTTokenExpiresAt());
  }

  /**
   * Runs {@code create} for 0 to {@code count - 1} on {@code width} platform threads and returns the
   * results in order. A fixed width matters to callers that exercise a bounded resource.
   */
  static <T> List<T> inParallel(int count, int width, IntFunction<T> create) {
    try (ExecutorService pool = Executors.newFixedThreadPool(width)) {
      List<Future<T>> pending = new ArrayList<>();
      for (int i = 0; i < count; i++) {
        int index = i;
        pending.add(pool.submit(() -> create.apply(index)));
      }
      return await(pending);
    }
  }

  private static <T> List<T> await(List<Future<T>> pending) {
    List<T> done = new ArrayList<>();
    try {
      for (Future<T> future : pending) {
        done.add(future.get());
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while creating principals", interrupted);
    } catch (ExecutionException failure) {
      throw new IllegalStateException("Creating a principal failed", failure.getCause());
    }
    return done;
  }
}
