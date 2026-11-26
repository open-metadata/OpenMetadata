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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.macasaet.fernet.Key;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.ForkedOperations;
import org.openmetadata.it.bootstrap.ForkedOperations.Outcome;
import org.openmetadata.it.bootstrap.ForkedServerNode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.FernetStoreScan.Scan;
import org.openmetadata.it.tests.FernetStoreScan.Token;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.Opening;
import org.openmetadata.service.jdbi3.OAuthDAOs;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * {@code OpenMetadataOperations rotate-fernet-key} re-encrypts every stored Fernet token under the
 * primary key of a key list and reports whether anything still needs an older key. The test runs a
 * rotation the way an operator does, against a database that a server wrote under an old key.
 *
 * <p>NEW is the suite's own key and OLD is a throwaway key. A node keyed {@code OLD,NEW} writes the
 * old world, the same node keyed {@code NEW,OLD} runs while the command rotates, and the suite's
 * server, which never held OLD, proves afterwards that everything works without it. Every later
 * class of the lane therefore finds all values under the key it holds.
 *
 * <p>The judge is {@link FernetStoreScan}, which shares no code with the command: its own schema
 * query over every text, JSON and binary column, a Redis scan, and its own token pattern.
 *
 * <p>While the node keyed {@code OLD,NEW} runs, the suite's server shares the database and may log
 * that it cannot decrypt a value the node wrote. No assertion depends on the suite's server before
 * the rotation has finished.
 *
 * <p>The class rewrites every token in the shared database, so it runs in the multi-node lane,
 * which runs one class at a time.
 */
@Tag("multi-node")
@ExtendWith(TestNamespaceExtension.class)
class OpsFernetKeyRotationIT {
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final Duration SERVER_CALL = Duration.ofSeconds(60);
  private static final Duration WAIT = Duration.ofSeconds(60);
  private static final String CLI = "rotate-fernet-key";
  private static final String UNLISTED_TABLE = "fernet_it_unlisted";
  private static final String TABLE_WITH_UNREADABLE_TOKEN = "fernet_it_nokey";
  private static final String APPS_HISTORY_TABLE = "apps_extension_time_series";
  private static final String VERSIONS_TABLE = "entity_extension";
  private static final int OLDER_KEY_CELL = 4;
  private static final int NO_KEY_CELL = 5;
  private static final int UNREWRITABLE_CELL = 6;
  private static final String SESSION_PASSWORD = "Str0ng!FernetIt";
  // A run without --every-table names the large tables it left out on a line that starts so.
  private static final Pattern LEFT_OUT_LINE = Pattern.compile("^Large tables left out");
  private static final Pattern IDENTIFIER =
      Pattern.compile("[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+");

  /** What the class leaves behind, undone in {@link #removeWhatTheClassMade()}. */
  private static final List<Runnable> UNDO = new CopyOnWriteArrayList<>();

  private static volatile String oldKey;
  private static volatile String newKey;

  /** What the old world holds, by name. */
  private static final class Seed {
    final Map<String, String> secrets = new LinkedHashMap<>();
    UUID serviceId;
    UUID pipelineId;
    UUID alertId;
    UUID workflowDefinitionId;
    String botJwt;
    String sessionEmail;
    String mcpToken;
    String ssoSessionId;
    SessionClient session;
  }

  @Test
  void everyStoredTokenMovesToThePrimaryKeyAndNothingStillNeedsTheOldOne(TestNamespace ns)
      throws Exception {
    newKey = suiteFernetKey();
    oldKey = randomKey();
    String oldWorldKeys = oldKey + "," + newKey;
    String rotatedKeys = newKey + "," + oldKey;

    requireSuiteDatabaseOpensWithTheSuiteKey();

    try (HeaderReceiver receiver = new HeaderReceiver()) {
      Seed seed;
      // The procedure restarts every server on the new list before --apply, so no node that writes
      // old-key tokens may outlive the seeding.
      try (ForkedServerNode oldWorld =
          ForkedServerNode.start(ForkedServerNode.Settings.DEFAULT.withFernetKey(oldWorldKeys))) {
        seed = seedOldWorld(ns, oldWorld.apiBase(), receiver);
      }
      seedWhatNeedsNoApi(ns, seed);
      Scan seeded = FernetStoreScan.take(true);
      requireSeedHoldsOnlyOldKeyTokens(seed, seeded);
      runRotation(seed, seeded, rotatedKeys, receiver);
    }
  }

  private void runRotation(Seed seed, Scan seeded, String rotatedKeys, HeaderReceiver receiver)
      throws Exception {
    Set<String> tablesWithOldTokens = tablesHoldingOldTokens(seeded);
    assertTrue(
        tablesWithOldTokens.contains(UNLISTED_TABLE),
        "the table nobody listed holds an old-key token, so the rotation has something to find");

    try (ForkedServerNode rotating =
        ForkedServerNode.start(ForkedServerNode.Settings.DEFAULT.withFernetKey(rotatedKeys))) {
      reportOnly(rotatedKeys, tablesWithOldTokens);
      warmCachedAlertBeforeApply(rotating, seed);
      rotateWhileTheNodeKeepsWorking(rotating, seed, rotatedKeys);
      requireEverythingOpensWithTheNewKeyAlone(seed);
      requireRedisKeptItsTtl(seed);
    }
    requireSecondRunIsANoOp(rotatedKeys);
    requireTheConfirmingRunOfEveryTableClearsTheOldKey(rotatedKeys);
    requireSuiteServerWorksWithoutTheOldKey(seed, receiver);
    requireTheLeftOutTablesHoldNoToken();
  }

  /**
   * Step 3: the default report and a report of every table both name every store that holds an
   * old-key value, and neither changes anything. Neither does {@code --apply} without a terminal
   * to confirm on and without {@code --yes}.
   */
  private void reportOnly(String rotatedKeys, Set<String> tablesWithOldTokens) {
    // Taken here, not before the node started: a starting node re-issues the bots' JWTs.
    List<String> before = FernetStoreScan.take(false).sqlFingerprint();
    Outcome report = rotate(rotatedKeys);

    requireOlderKeyValuesShown(report, tablesWithOldTokens);
    assertTrue(
        cell(report.output(), VERSIONS_TABLE, OLDER_KEY_CELL) > 0,
        "the versions of the entities that were read show older-key values, "
            + tail(report.output()));
    assertEquals(
        before,
        FernetStoreScan.take(false).sqlFingerprint(),
        "a report without --apply writes nothing");

    Outcome everyTable = rotate(rotatedKeys, "--every-table");

    requireOlderKeyValuesShown(everyTable, tablesWithOldTokens);
    assertEquals(
        before,
        FernetStoreScan.take(false).sqlFingerprint(),
        "a report of every table writes nothing");

    Outcome unconfirmed = rotate(rotatedKeys, "--apply");

    assertEquals(
        2,
        unconfirmed.exitCode(),
        "--apply without a terminal or --yes is refused, " + tail(unconfirmed.output()));
    assertEquals(
        before, FernetStoreScan.take(false).sqlFingerprint(), "a refused --apply writes nothing");
  }

  private static void requireOlderKeyValuesShown(Outcome report, Set<String> tables) {
    assertEquals(3, report.exitCode(), "old-key values remain, " + tail(report.output()));
    for (String table : tables) {
      assertTrue(
          cell(report.output(), table, OLDER_KEY_CELL) > 0,
          "the report shows older-key values in " + table + ", " + tail(report.output()));
    }
  }

  /** Step 4: values are rewritten while the node keeps editing and a user keeps a session open. */
  private void rotateWhileTheNodeKeepsWorking(ForkedServerNode node, Seed seed, String rotatedKeys)
      throws Exception {
    AtomicBoolean stop = new AtomicBoolean();
    AtomicReference<Throwable> failure = new AtomicReference<>();
    AtomicInteger patches = new AtomicInteger();
    AtomicInteger refreshes = new AtomicInteger();
    ExecutorService workers = Executors.newFixedThreadPool(2);
    try {
      workers.submit(
          () -> keepRunning(stop, failure, () -> patchServiceDescription(node, seed, patches)));
      workers.submit(() -> keepRunning(stop, failure, () -> refreshSession(node, seed, refreshes)));
      Awaitility.await("both workers completed a call against the node")
          .atMost(WAIT)
          .pollInterval(50, TimeUnit.MILLISECONDS)
          .until(() -> (patches.get() > 0 && refreshes.get() > 0) || failure.get() != null);
      if (failure.get() != null) {
        throw new AssertionError("Worker failed before rotation started", failure.get());
      }

      // The tight PATCH loop on the same databaseService row can contend all 3 CAS attempts or
      // commit an in-flight read taken before the rewrite, so the first run may legitimately exit 3
      // with only CONTENDED / OLDER_KEY findings before a rerun converges to 0.
      Outcome applied = rotate(rotatedKeys, "--apply", "--yes");
      assertTrue(
          applied.exitCode() == 0 || applied.exitCode() == 3,
          "first apply must succeed or report concurrent write contention, "
              + tail(applied.output()));
      if (applied.exitCode() == 3) {
        assertTrue(
            cell(applied.output(), APPS_HISTORY_TABLE, UNREWRITABLE_CELL) <= 0,
            "app history must not be unrewritable, " + tail(applied.output()));
      }
      int runs = 1;
      for (int rerun = 0; rerun < 2 && applied.exitCode() == 3; rerun++) {
        applied = rotate(rotatedKeys, "--apply", "--yes");
        runs++;
      }
      assertEquals(
          0, applied.exitCode(), "applied after " + runs + " run(s), " + tail(applied.output()));
    } finally {
      stop.set(true);
      workers.shutdown();
      assertTrue(workers.awaitTermination(30, TimeUnit.SECONDS), "workers stopped");
    }
    assertNull(failure.get(), "the node answered every call during the rotation");
  }

  /** Step 5: the independent scan finds only tokens that the new key alone opens. */
  private void requireEverythingOpensWithTheNewKeyAlone(Seed seed) {
    Scan scan = FernetStoreScan.take(true);

    List<String> problems = problemsOpeningWithTheNewKeyAlone(scan);
    assertTrue(problems.isEmpty(), "tokens the new key alone does not open: " + problems);
    Set<String> plaintexts = plaintextsOpenedByTheNewKey(scan);
    Set<String> missing = new TreeSet<>();
    seed.secrets.forEach(
        (label, plaintext) -> {
          if (!plaintexts.contains(plaintext)) {
            missing.add(label);
          }
        });
    assertTrue(missing.isEmpty(), "recorded plaintexts that did not come back: " + missing);
  }

  /** Step 6: a second run re-encrypts nothing. */
  private void requireSecondRunIsANoOp(String rotatedKeys) {
    List<String> before = FernetStoreScan.take(false).sqlFingerprint();

    Outcome again = rotate(rotatedKeys, "--apply", "--yes");

    assertEquals(0, again.exitCode(), "second run, " + tail(again.output()));
    assertEquals(before, FernetStoreScan.take(false).sqlFingerprint(), "no cell changed");
  }

  /** Step 6b: the confirming run reads every table, exits 0 and names the key that can go. */
  private void requireTheConfirmingRunOfEveryTableClearsTheOldKey(String rotatedKeys) {
    List<String> fingerprints = KeyRing.parse(rotatedKeys).fingerprints();
    String redisNote =
        TestSuiteBootstrap.isRedisEnabled()
            ? ""
            : " Redis was not read (cache.provider is not redis on this host); if the servers use Redis, run with cache.provider=redis before removing the key.";
    String verdict =
        "Every stored value opens with key "
            + fingerprints.getFirst()
            + ". Key "
            + fingerprints.getLast()
            + " can be removed from the servers."
            + redisNote;

    Outcome confirmed = rotate(rotatedKeys, "--every-table");

    assertEquals(0, confirmed.exitCode(), "confirming run, " + tail(confirmed.output()));
    assertTrue(
        confirmed.output().lines().anyMatch(verdict::equals),
        "the confirming run names the key that can go, " + tail(confirmed.output()));
    assertFalse(
        confirmed.output().lines().anyMatch(line -> LEFT_OUT_LINE.matcher(line).find()),
        "a run of every table leaves nothing out, " + tail(confirmed.output()));
  }

  /**
   * Populates Redis with the seeded alert's old-key JSON right before {@code --apply}, because
   * writers evict and only reads call {@code CachedEntityDao.putBase}.
   */
  private void warmCachedAlertBeforeApply(ForkedServerNode rotating, Seed seed) {
    if (!TestSuiteBootstrap.isRedisEnabled()) {
      return;
    }
    call(rotating.apiBase(), "GET", "/api/v1/events/subscriptions/" + seed.alertId, null);
    String keyspace =
        TestSuiteBootstrap.createApplicationConfigCopy().getCacheConfig().redis.keyspace;
    List<String> keys = cachedAlertKeys(keyspace, seed.alertId);
    assertFalse(keys.isEmpty(), "the seeded alert is cached in Redis before --apply");
    KeyRing oldOnly = KeyRing.parse(oldKey);
    KeyRing newOnly = KeyRing.parse(newKey);
    boolean holdsOldToken = false;
    for (String alertKey : keys) {
      String base =
          FernetStoreScan.redis("redis-cli --raw hget '" + alertKey + "' base").getStdout();
      for (String token : tokensIn(base)) {
        if (newOnly.open(token) instanceof Opening.NoKey
            && oldOnly.open(token) instanceof Opening.Primary) {
          holdsOldToken = true;
        }
      }
    }
    assertTrue(holdsOldToken, "the cached alert in Redis holds an old-key token before --apply");
  }

  private static List<String> cachedAlertKeys(String keyspace, UUID alertId) {
    String alertKeys =
        FernetStoreScan.redis("redis-cli --scan --pattern '" + keyspace + ":e:*:" + alertId + "'")
            .getStdout();
    return alertKeys.lines().filter(line -> !line.isBlank()).toList();
  }

  /** Step 11: Redis values hold new-key tokens and still expire. */
  private void requireRedisKeptItsTtl(Seed seed) {
    if (!TestSuiteBootstrap.isRedisEnabled()) {
      return;
    }
    String keyspace =
        TestSuiteBootstrap.createApplicationConfigCopy().getCacheConfig().redis.keyspace;
    String sessionKey = keyspace + ":session:" + seed.session.sessionId();
    String sessionValue =
        FernetStoreScan.redis("redis-cli --raw get '" + sessionKey + "'").getStdout();
    List<String> sessionTokens = tokensIn(sessionValue);
    assertFalse(sessionTokens.isEmpty(), "the seeded session holds a refresh token in Redis");
    KeyRing newOnly = KeyRing.parse(newKey);
    sessionTokens.forEach(
        token ->
            assertTrue(newOnly.open(token) instanceof Opening.Primary, "session token is new"));
    assertTrue(pttl(sessionKey) > 0, "the session still expires");

    List<String> keys = cachedAlertKeys(keyspace, seed.alertId);
    assertFalse(keys.isEmpty(), "the seeded alert is cached in Redis");
    for (String alertKey : keys) {
      String base =
          FernetStoreScan.redis("redis-cli --raw hget '" + alertKey + "' base").getStdout();
      for (String token : tokensIn(base)) {
        assertTrue(
            newOnly.open(token) instanceof Opening.Primary,
            "the cached alert holds only new-key tokens");
      }
      assertTrue(pttl(alertKey) > 0, "the cached alert still expires");
    }
  }

  private static long pttl(String key) {
    return Long.parseLong(FernetStoreScan.redis("redis-cli pttl '" + key + "'").getStdout().trim());
  }

  /** Step 7: the suite's server, which never held the old key, serves every secret. */
  private void requireSuiteServerWorksWithoutTheOldKey(Seed seed, HeaderReceiver receiver)
      throws Exception {
    assertEquals(
        200,
        CredentialFixtures.status(LOGGED_IN_USER, seed.botJwt),
        "the bot's token authenticates");

    var ingestionBot = SdkClients.ingestionBotClient().getHttpClient();
    String service =
        ingestionBot.executeForString(
            HttpMethod.GET, "/v1/services/databaseServices/" + seed.serviceId, null);
    assertTrue(
        service.contains(seed.secrets.get("service password")), "the bot reads the service secret");
    String pipeline =
        ingestionBot.executeForString(
            HttpMethod.GET, "/v1/services/ingestionPipelines/" + seed.pipelineId, null);
    assertTrue(
        pipeline.contains(seed.secrets.get("pipeline secret")),
        "the bot reads the pipeline secret");

    sendTestMessage(seed, receiver);

    assertEquals(
        seed.secrets.get("smtp password"),
        Fernet.getInstance().decrypt(storedSmtpPassword()),
        "the stored SMTP password decrypts");
    assertEquals(200, seed.session.refresh(TestSuiteBootstrap.getBaseUrl()), "session refreshes");
    var token =
        Entity.getCollectionDAO()
            .oauthAccessTokenDAO()
            .findByTokenHash(OAuthDAOs.hashToken(seed.mcpToken));
    assertEquals(
        seed.mcpToken,
        Fernet.getInstance().decrypt(token.accessTokenEncrypted()),
        "the MCP access token decrypts");
    assertEquals(
        200,
        status(
            URI.create(TestSuiteBootstrap.getBaseUrl()),
            "/api/v1/governance/workflowDefinitions/" + seed.workflowDefinitionId),
        "the workflow definition reads");
    assertEquals(
        seed.secrets.get("sink token"),
        bpmnTokensOpenedByTheNewKey().stream()
            .filter(seed.secrets.get("sink token")::equals)
            .findFirst()
            .orElse(null),
        "the deployed BPMN holds a new-key token of the sink secret");
    assertEquals(
        seed.secrets.get("sso pending state"),
        Fernet.getInstance().decrypt(ssoPendingState(seed.ssoSessionId)),
        "the SSO test login state decrypts");
  }

  @Test
  void blankOrMalformedKeyRefusesWithExitTwoAndExternalSecretsConfigDoesNotBlockRotation() {
    String suiteKey = suiteFernetKey();

    Outcome blank = rotate("");
    assertEquals(
        2, blank.exitCode(), "blank FERNET_KEY refuses with exit 2, " + tail(blank.output()));

    Outcome leadingComma = rotate("," + suiteKey);
    assertEquals(
        2,
        leadingComma.exitCode(),
        "leading comma FERNET_KEY refuses with exit 2, " + tail(leadingComma.output()));

    Outcome malformed = rotate(suiteKey + ",not-a-key");
    assertEquals(
        2,
        malformed.exitCode(),
        "malformed FERNET_KEY refuses with exit 2, " + tail(malformed.output()));

    Outcome withExternalSecretsAndUnreachableSearch =
        ForkedOperations.runCapturing(
            config -> {
              ((ObjectNode) config.path("fernetConfiguration")).put("fernetKey", suiteKey);
              ObjectNode secrets = config.putObject("secretsManagerConfiguration");
              secrets.put("secretsManager", "kubernetes");
              ((ObjectNode) config.path("elasticsearch")).put("host", "127.0.0.1").put("port", 1);
            },
            CLI);
    assertEquals(
        0,
        withExternalSecretsAndUnreachableSearch.exitCode(),
        "DB+Redis-only ops host succeeds even with external secrets manager and unreachable search, "
            + tail(withExternalSecretsAndUnreachableSearch.output()));
  }

  @Test
  void theSuiteKeyAloneIsCleanAndAnUnrelatedKeyAloneNeverExitsZero() {
    String suiteKey = suiteFernetKey();
    String unrelatedKey = Key.generateKey().serialise();

    Outcome newAlone = rotate(suiteKey);
    assertEquals(0, newAlone.exitCode(), "suite key alone, " + tail(newAlone.output()));

    Outcome wrongAlone = rotate(unrelatedKey);
    assertEquals(4, wrongAlone.exitCode(), "unrelated key alone, " + tail(wrongAlone.output()));
    assertTrue(
        cell(wrongAlone.output(), "user_entity", NO_KEY_CELL) > 0,
        "stored tokens do not open with an unrelated key, " + tail(wrongAlone.output()));
  }

  @Test
  void aTokenNoConfiguredKeyOpensExitsFourAndIsLeftAlone() {
    String suiteKey = suiteFernetKey();
    String rotatedKeys = suiteKey + "," + Key.generateKey().serialise();
    String token =
        KeyRing.parse(Key.generateKey().serialise()).seal("a secret of a key nobody lists");
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              handle.execute("DROP TABLE IF EXISTS " + TABLE_WITH_UNREADABLE_TOKEN);
              handle.execute(
                  "CREATE TABLE "
                      + TABLE_WITH_UNREADABLE_TOKEN
                      + " (id int primary key, note text)");
              handle
                  .createUpdate(
                      "INSERT INTO "
                          + TABLE_WITH_UNREADABLE_TOKEN
                          + " (id, note) VALUES (1, :note)")
                  .bind("note", token)
                  .execute();
            });
    try {
      Outcome report = rotate(rotatedKeys);
      Outcome applied = rotate(rotatedKeys, "--apply", "--yes");

      assertEquals(4, report.exitCode(), "report, " + tail(report.output()));
      assertEquals(1, cell(report.output(), TABLE_WITH_UNREADABLE_TOKEN, NO_KEY_CELL));
      assertEquals(4, applied.exitCode(), "applied, " + tail(applied.output()));
      assertEquals(
          token,
          TestSuiteBootstrap.getJdbi()
              .withHandle(
                  handle ->
                      handle
                          .createQuery(
                              "SELECT note FROM " + TABLE_WITH_UNREADABLE_TOKEN + " WHERE id = 1")
                          .mapTo(String.class)
                          .one()),
          "a token no key opens is left byte for byte as it was");
    } finally {
      dropTable(TABLE_WITH_UNREADABLE_TOKEN);
    }
  }

  /** Step 10: the large tables a default run leaves out hold no token in the suite database. */
  private void requireTheLeftOutTablesHoldNoToken() {
    Outcome defaultRead = rotate(newKey);
    assertEquals(0, defaultRead.exitCode(), "default read, " + tail(defaultRead.output()));

    Set<String> schema = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    schema.addAll(FernetStoreScan.tables());
    Set<String> named = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    defaultRead
        .output()
        .lines()
        .filter(line -> LEFT_OUT_LINE.matcher(line).find())
        .forEach(
            line -> {
              Matcher words = IDENTIFIER.matcher(line);
              while (words.find()) {
                named.add(words.group());
              }
            });
    assertFalse(
        named.isEmpty(), "the report names the tables it left out, " + tail(defaultRead.output()));
    Set<String> notTables = new TreeSet<>(named);
    notTables.removeAll(schema);
    assertTrue(notTables.isEmpty(), "every left-out name is a table of the schema: " + notTables);
    Set<String> holdingTokens = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    FernetStoreScan.take(false).tokens().forEach(token -> holdingTokens.add(token.table()));
    holdingTokens.retainAll(named);
    assertTrue(holdingTokens.isEmpty(), "left-out tables that hold a token: " + holdingTokens);
  }

  @AfterAll
  static void removeWhatTheClassMade() {
    UNDO.reversed().forEach(OpsFernetKeyRotationIT::bestEffort);
    UNDO.clear();
    if (oldKey == null || newKey == null) {
      return;
    }
    bestEffort(
        () -> {
          if (holdsAnOldKeyToken()) {
            rotate(newKey + "," + oldKey, "--apply", "--yes");
          }
        });
    // The shared database must leave this class without an old-key token, or the next class breaks.
    boolean left = holdsAnOldKeyToken();
    assertFalse(left, "the database still holds a token only the throwaway key opens");
  }

  private static void bestEffort(Runnable action) {
    try {
      action.run();
    } catch (RuntimeException failure) {
      System.err.println("OpsFernetKeyRotationIT cleanup step failed: " + failure);
    }
  }

  private static boolean holdsAnOldKeyToken() {
    KeyRing old = KeyRing.parse(oldKey);
    KeyRing current = KeyRing.parse(newKey);
    return FernetStoreScan.take(true).tokens().stream()
        .anyMatch(
            token ->
                current.open(token.text()) instanceof Opening.NoKey
                    && !(old.open(token.text()) instanceof Opening.NoKey));
  }

  // ---- seeding ----

  private Seed seedOldWorld(TestNamespace ns, URI node, HeaderReceiver receiver) throws Exception {
    Seed seed = new Seed();
    seedServiceAndPipeline(ns, node, seed);
    seedBot(ns, node, seed);
    seedAlert(node, seed, receiver);
    seedProfileWebhooks(ns, node, seed);
    seedWorkflows(ns, node, seed);
    seedSmtp(node, seed);
    seedSession(ns, node, seed);
    return seed;
  }

  private void seedServiceAndPipeline(TestNamespace ns, URI node, Seed seed) {
    String password = secret("service password", seed);
    JsonNode service =
        call(
            node,
            "POST",
            "/api/v1/services/databaseServices",
            Map.of(
                "name",
                ns.prefix("fernet_service"),
                "serviceType",
                "Mysql",
                "connection",
                Map.of(
                    "config",
                    Map.of(
                        "type",
                        "Mysql",
                        "hostPort",
                        "localhost:3306",
                        "username",
                        "fernet_it",
                        "authType",
                        Map.of("password", password)))));
    seed.serviceId = UUID.fromString(service.path("id").asText());
    ns.trackRoot(Entity.DATABASE_SERVICE, seed.serviceId);
    patchDescription(node, "/api/v1/services/databaseServices/" + seed.serviceId, "add", "one");
    patchDescription(node, "/api/v1/services/databaseServices/" + seed.serviceId, "replace", "two");

    String pipelineSecret = secret("pipeline secret", seed);
    JsonNode pipeline =
        call(
            node,
            "POST",
            "/api/v1/services/ingestionPipelines",
            Map.of(
                "name",
                ns.prefix("fernet_pipeline"),
                "pipelineType",
                "dbt",
                "service",
                Map.of("id", seed.serviceId.toString(), "type", "databaseService"),
                "sourceConfig",
                Map.of(
                    "config",
                    Map.of(
                        "type",
                        "DBT",
                        "dbtConfigSource",
                        Map.of(
                            "dbtConfigType",
                            "s3",
                            "dbtSecurityConfig",
                            Map.of(
                                "awsAccessKeyId",
                                "AKIAFERNETIT",
                                "awsSecretAccessKey",
                                pipelineSecret,
                                "awsRegion",
                                "eu-west-2")))),
                "airflowConfig",
                Map.of("startDate", "2022-06-10T15:06:47Z")));
    seed.pipelineId = UUID.fromString(pipeline.path("id").asText());
  }

  private void seedBot(TestNamespace ns, URI node, Seed seed) {
    String botUser = "fernetbot" + ns.shortPrefix();
    JsonNode user =
        call(
            node,
            "POST",
            "/api/v1/users",
            Map.of(
                "name",
                botUser,
                "email",
                botUser + "@test.com",
                "isBot",
                true,
                "authenticationMechanism",
                Map.of("authType", "JWT", "config", Map.of("JWTTokenExpiry", "Unlimited"))));
    ns.trackRoot(Entity.USER, UUID.fromString(user.path("id").asText()));
    JsonNode bot =
        call(
            node,
            "POST",
            "/api/v1/bots",
            Map.of("name", ns.prefix("fernet_bot"), "botUser", botUser));
    ns.trackRoot(Entity.BOT, UUID.fromString(bot.path("id").asText()));
    JsonNode stored = JsonUtils.readTree(storedUserJson(botUser));
    String token = stored.at("/authenticationMechanism/config/JWTToken").asText();
    Opening opening = KeyRing.parse(oldKey).open(token);
    seed.botJwt = ((Opening.Primary) opening).plaintext();
    seed.secrets.put("bot jwt", seed.botJwt);
  }

  private void seedAlert(URI node, Seed seed, HeaderReceiver receiver) {
    String header = secret("alert header", seed);
    String signingKey = secret("alert signing key", seed);
    String endpoint = receiver.url("/fernet-it/" + UUID.randomUUID());
    seed.secrets.put("alert endpoint", endpoint);
    Map<String, Object> destination =
        Map.of(
            "type",
            "Webhook",
            "category",
            "External",
            "config",
            Map.of(
                "endpoint",
                endpoint,
                "headers",
                Map.of("X-Key", header),
                "authType",
                Map.of("type", "bearer", "secretKey", signingKey)));
    JsonNode alert =
        call(
            node,
            "POST",
            "/api/v1/events/subscriptions",
            Map.of(
                "name",
                "fernet_it_alert_" + UUID.randomUUID().toString().substring(0, 8),
                "alertType",
                "Notification",
                "resources",
                List.of("table"),
                "enabled",
                true,
                "batchSize",
                100,
                "pollInterval",
                86400,
                "destinations",
                List.of(destination)));
    seed.alertId = UUID.fromString(alert.path("id").asText());
    UNDO.add(
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(
                    HttpMethod.DELETE,
                    "/v1/events/subscriptions/" + seed.alertId + "?hardDelete=true",
                    null));
    patchDescription(node, "/api/v1/events/subscriptions/" + seed.alertId, "add", "one");
    patchDescription(node, "/api/v1/events/subscriptions/" + seed.alertId, "replace", "two");
  }

  private void seedProfileWebhooks(TestNamespace ns, URI node, Seed seed) {
    String userSecret = secret("user webhook secret", seed);
    String teamSecret = secret("team webhook secret", seed);
    String userName = "fernetprofile" + ns.shortPrefix();
    JsonNode user =
        call(
            node,
            "POST",
            "/api/v1/users",
            Map.of("name", userName, "email", userName + "@open-metadata.org"));
    UUID userId = UUID.fromString(user.path("id").asText());
    ns.trackRoot(Entity.USER, userId);
    call(
        node,
        "PATCH",
        "/api/v1/users/" + userId,
        List.of(
            Map.of(
                "op",
                "add",
                "path",
                "/profile",
                "value",
                Map.of("subscription", Map.of("generic", webhook(userName, userSecret))))));
    JsonNode team =
        call(
            node,
            "POST",
            "/api/v1/teams",
            Map.of(
                "name",
                ns.prefix("fernet_team"),
                "teamType",
                "Group",
                "profile",
                Map.of("subscription", Map.of("generic", webhook("team", teamSecret)))));
    UUID teamId = UUID.fromString(team.path("id").asText());
    ns.trackRoot(Entity.TEAM, teamId);
  }

  private static Map<String, Object> webhook(String name, String signingKey) {
    return Map.of(
        "endpoint",
        "https://hooks.example.com/" + name,
        "authType",
        Map.of("type", "bearer", "secretKey", signingKey));
  }

  private void seedWorkflows(TestNamespace ns, URI node, Seed seed) {
    String sinkToken = secret("sink token", seed);
    Map<String, Object> sinkNode =
        Map.of(
            "type",
            "automatedTask",
            "subType",
            "sinkTask",
            "name",
            "gitSink",
            "config",
            Map.of(
                "sinkType",
                "git",
                "sinkConfig",
                Map.of(
                    "repositoryUrl",
                    "https://github.com/open-metadata/fernet-rotation-it.git",
                    "credentials",
                    Map.of("type", "token", "token", sinkToken))));
    JsonNode workflow =
        call(
            node,
            "POST",
            "/api/v1/governance/workflowDefinitions",
            Map.of(
                "name",
                ns.prefix("fernet_workflow"),
                "displayName",
                "Fernet rotation",
                "description",
                "Holds a sink secret",
                "type",
                "periodicBatchEntity",
                "trigger",
                Map.of(
                    "type",
                    "periodicBatchEntity",
                    "config",
                    Map.of(
                        "entityTypes",
                        List.of("table"),
                        "batchSize",
                        100,
                        "schedule",
                        Map.of("scheduleTimeline", "None"))),
                "nodes",
                List.of(
                    Map.of("type", "startEvent", "subType", "startEvent", "name", "start"),
                    sinkNode,
                    Map.of("type", "endEvent", "subType", "endEvent", "name", "end")),
                "edges",
                List.of(
                    Map.of("from", "start", "to", "gitSink"),
                    Map.of("from", "gitSink", "to", "end")),
                "config",
                Map.of("storeStageStatus", false)));
    seed.workflowDefinitionId = UUID.fromString(workflow.path("id").asText());
    UNDO.add(
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(
                    HttpMethod.DELETE,
                    "/v1/governance/workflowDefinitions/"
                        + seed.workflowDefinitionId
                        + "?hardDelete=true&recursive=true",
                    null));

    JsonNode testConnection =
        call(
            node,
            "POST",
            "/api/v1/automations/workflows",
            Map.of(
                "name",
                ns.prefix("fernet_test_connection"),
                "workflowType",
                "TEST_CONNECTION",
                "request",
                Map.of(
                    "serviceType",
                    "Database",
                    "connectionType",
                    "Mysql",
                    "connection",
                    Map.of(
                        "config",
                        Map.of(
                            "type",
                            "Mysql",
                            "hostPort",
                            "localhost:3306",
                            "username",
                            "fernet_it",
                            "authType",
                            Map.of("password", secret("test connection password", seed)))))));
    String testConnectionId = testConnection.path("id").asText();
    UNDO.add(
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(
                    HttpMethod.DELETE,
                    "/v1/automations/workflows/" + testConnectionId + "?hardDelete=true",
                    null));
  }

  private void seedSmtp(URI node, Seed seed) {
    String previous = storedSettingJson("emailConfiguration");
    UNDO.add(() -> restoreSetting("emailConfiguration", previous));
    call(
        node,
        "PUT",
        "/api/v1/system/settings",
        Map.of(
            "config_type",
            "emailConfiguration",
            "config_value",
            Map.of(
                "emailingEntity",
                "OpenMetadata",
                "supportUrl",
                "https://slack.open-metadata.org",
                "enableSmtpServer",
                false,
                "senderMail",
                "fernet-it@open-metadata.org",
                "serverEndpoint",
                "localhost",
                "serverPort",
                25,
                "username",
                "fernet-it",
                "password",
                secret("smtp password", seed),
                "transportationStrategy",
                "SMTP",
                "templates",
                "openmetadata")));
  }

  private void seedSession(TestNamespace ns, URI node, Seed seed) throws Exception {
    String name = "fernetsession" + ns.shortPrefix();
    seed.sessionEmail = name + "@example.com";
    JsonNode user =
        call(
            node,
            "POST",
            "/api/v1/users",
            Map.of(
                "name",
                name,
                "email",
                seed.sessionEmail,
                "password",
                SESSION_PASSWORD,
                "confirmPassword",
                SESSION_PASSWORD,
                "createPasswordType",
                "ADMIN_CREATE",
                "isBot",
                false));
    ns.trackRoot(Entity.USER, UUID.fromString(user.path("id").asText()));
    seed.session = new SessionClient();
    seed.session.login(node.toString(), seed.sessionEmail);
  }

  /** The stores that have no API: an MCP grant, an SSO test login and a table nobody listed. */
  private void seedWhatNeedsNoApi(TestNamespace ns, Seed seed) {
    KeyRing old = KeyRing.parse(oldKey);
    String clientId = "fernet-it-" + UUID.randomUUID();
    String clientSecret = secret("mcp client secret", seed);
    Entity.getCollectionDAO()
        .oauthClientDAO()
        .insert(
            clientId,
            old.seal(clientSecret),
            "Fernet IT",
            "[]",
            "[\"authorization_code\"]",
            "client_secret_post",
            "[\"read\"]");
    UNDO.add(() -> Entity.getCollectionDAO().oauthClientDAO().delete(clientId));
    seed.mcpToken = secret("mcp access token", seed);
    Entity.getCollectionDAO()
        .oauthAccessTokenDAO()
        .insert(
            OAuthDAOs.hashToken(seed.mcpToken),
            old.seal(seed.mcpToken),
            clientId,
            "admin",
            "[\"read\"]",
            System.currentTimeMillis() + Duration.ofHours(2).toMillis());

    seed.ssoSessionId = "fernetit" + UUID.randomUUID().toString().replace("-", "");
    Entity.getCollectionDAO()
        .ssoTestLoginSessionDAO()
        .insert(
            seed.ssoSessionId,
            "admin",
            "oidc",
            "pending",
            old.seal(secret("sso pending state", seed)),
            null,
            System.currentTimeMillis() + Duration.ofHours(2).toMillis());
    UNDO.add(
        () ->
            TestSuiteBootstrap.getJdbi()
                .useHandle(
                    handle ->
                        handle
                            .createUpdate(
                                "DELETE FROM sso_test_login_session WHERE test_session_id = :id")
                            .bind("id", seed.ssoSessionId)
                            .execute()));

    boolean mysql = TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL;
    String note = secret("unlisted note", seed);
    String payload = secret("unlisted payload", seed);
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              handle.execute("DROP TABLE IF EXISTS " + UNLISTED_TABLE);
              handle.execute(
                  "CREATE TABLE "
                      + UNLISTED_TABLE
                      + " (id varchar(36) primary key, note text, payload "
                      + (mysql ? "longblob" : "bytea")
                      + ")");
              handle
                  .createUpdate(
                      "INSERT INTO "
                          + UNLISTED_TABLE
                          + " (id, note, payload) VALUES (:id, :note, :payload)")
                  .bind("id", UUID.randomUUID().toString())
                  .bind("note", old.seal(note))
                  .bind("payload", old.seal(payload).getBytes(StandardCharsets.UTF_8))
                  .execute();
            });
    UNDO.add(() -> dropTable(UNLISTED_TABLE));

    String appId = UUID.randomUUID().toString();
    String appRunToken = secret("app run config secret", seed);
    String appRunJson =
        "{\"appId\":\""
            + appId
            + "\",\"appName\":\"FernetItApp\",\"timestamp\":"
            + System.currentTimeMillis()
            + ",\"status\":\"success\",\"config\":{\"apiToken\":\""
            + old.seal(appRunToken)
            + "\"}}";
    String jsonCast = mysql ? "CAST(:json AS JSON)" : "CAST(:json AS jsonb)";
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "INSERT INTO "
                            + APPS_HISTORY_TABLE
                            + " (json, extension) VALUES ("
                            + jsonCast
                            + ", 'status')")
                    .bind("json", appRunJson)
                    .execute());
    UNDO.add(
        () ->
            TestSuiteBootstrap.getJdbi()
                .useHandle(
                    handle ->
                        handle
                            .createUpdate(
                                "DELETE FROM " + APPS_HISTORY_TABLE + " WHERE appId = :appId")
                            .bind("appId", appId)
                            .execute()));
  }

  private static String secret(String label, Seed seed) {
    String value = "fernet-it-" + label.replace(' ', '-') + "-" + UUID.randomUUID();
    seed.secrets.put(label, value);
    return value;
  }

  // ---- oracle ----

  private static void requireSuiteDatabaseOpensWithTheSuiteKey() {
    Outcome clean = rotate(newKey);
    assertEquals(
        0,
        clean.exitCode(),
        "The suite database already holds a value that the suite's Fernet key cannot open, so the"
            + " rotation cannot be judged. Reset the database. "
            + tail(clean.output()));
    KeyRing current = KeyRing.parse(newKey);
    List<String> unreadable =
        FernetStoreScan.take(true).tokens().stream()
            .filter(token -> !(current.open(token.text()) instanceof Opening.Primary))
            .map(Token::store)
            .distinct()
            .toList();
    assertTrue(
        unreadable.isEmpty(), "tokens the suite key cannot open already sit in " + unreadable);
  }

  private static void requireSeedHoldsOnlyOldKeyTokens(Seed seed, Scan seeded) {
    Set<String> found = oldKeyPlaintexts(seeded);
    Set<String> missing = new TreeSet<>();
    seed.secrets.forEach(
        (label, plaintext) -> {
          if (!found.contains(plaintext)) {
            missing.add(label);
          }
        });
    assertTrue(
        missing.isEmpty(),
        "the old world did not store these secrets under the old key: " + missing);
  }

  private static Set<String> oldKeyPlaintexts(Scan scan) {
    KeyRing oldOnly = KeyRing.parse(oldKey);
    KeyRing newOnly = KeyRing.parse(newKey);
    Set<String> plaintexts = new TreeSet<>();
    for (Token token : scan.tokens()) {
      if (newOnly.open(token.text()) instanceof Opening.NoKey
          && oldOnly.open(token.text()) instanceof Opening.Primary primary) {
        plaintexts.add(primary.plaintext());
      }
    }
    return plaintexts;
  }

  private static Set<String> tablesHoldingOldTokens(Scan scan) {
    KeyRing oldOnly = KeyRing.parse(oldKey);
    KeyRing newOnly = KeyRing.parse(newKey);
    Set<String> tables = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    for (Token token : scan.tokens()) {
      if (newOnly.open(token.text()) instanceof Opening.NoKey
          && !(oldOnly.open(token.text()) instanceof Opening.NoKey)) {
        tables.add(token.table());
      }
    }
    return tables;
  }

  /** A token passes when the new key alone opens it. */
  private static List<String> problemsOpeningWithTheNewKeyAlone(Scan scan) {
    KeyRing newOnly = KeyRing.parse(newKey);
    List<String> problems = new ArrayList<>();
    for (Token token : scan.tokens()) {
      if (!(newOnly.open(token.text()) instanceof Opening.Primary)) {
        problems.add(token.store() + " holds a token the new key does not open");
      }
    }
    return problems;
  }

  private static Set<String> plaintextsOpenedByTheNewKey(Scan scan) {
    KeyRing newOnly = KeyRing.parse(newKey);
    Set<String> plaintexts = new TreeSet<>();
    for (Token token : scan.tokens()) {
      if (newOnly.open(token.text()) instanceof Opening.Primary primary) {
        plaintexts.add(primary.plaintext());
      }
    }
    return plaintexts;
  }

  private static List<String> bpmnTokensOpenedByTheNewKey() {
    KeyRing newOnly = KeyRing.parse(newKey);
    List<String> plaintexts = new ArrayList<>();
    for (Token token : FernetStoreScan.take(false).tokens()) {
      if (token.table().equalsIgnoreCase("ACT_GE_BYTEARRAY")
          && newOnly.open(token.text()) instanceof Opening.Primary primary) {
        plaintexts.add(primary.plaintext());
      }
    }
    return plaintexts;
  }

  private static List<String> tokensIn(String text) {
    List<String> tokens = new ArrayList<>();
    Matcher matcher = FernetStoreScan.TOKEN.matcher(text);
    while (matcher.find()) {
      tokens.add(matcher.group());
    }
    return tokens;
  }

  // ---- the command ----

  private static Outcome rotate(String keys, String... flags) {
    List<String> command = new ArrayList<>();
    command.add(CLI);
    command.addAll(List.of(flags));
    return ForkedOperations.runCapturing(
        config -> ((ObjectNode) config.path("fernetConfiguration")).put("fernetKey", keys),
        command.toArray(String[]::new));
  }

  /** A count cell of the report row of a table, or -1 when no row names it. */
  private static int cell(String output, String table, int index) {
    for (String line : output.lines().toList()) {
      if (!line.startsWith("|")) {
        continue;
      }
      String[] cells = line.split("\\|");
      if (cells.length > index && cells[1].trim().equalsIgnoreCase(table)) {
        try {
          return Integer.parseInt(cells[index].trim().replace(",", ""));
        } catch (NumberFormatException notACount) {
          return -1;
        }
      }
    }
    return -1;
  }

  /** The report table and the last of the output: the problem lines can push the table out. */
  private static String tail(String output) {
    int keep = 3000;
    String table =
        output
            .lines()
            .filter(line -> line.startsWith("|") || line.startsWith("+"))
            .collect(Collectors.joining("\n"));
    String end =
        output.length() <= keep ? output : "... " + output.substring(output.length() - keep);
    return table.isEmpty() || output.length() <= keep ? end : table + "\n" + end;
  }

  // ---- calls to the old-world node and the suite ----

  private static void patchDescription(URI node, String path, String op, String value) {
    call(node, "PATCH", path, List.of(Map.of("op", op, "path", "/description", "value", value)));
  }

  private static void patchServiceDescription(
      ForkedServerNode node, Seed seed, AtomicInteger done) {
    call(
        node.apiBase(),
        "PATCH",
        "/api/v1/services/databaseServices/" + seed.serviceId,
        List.of(
            Map.of(
                "op",
                "replace",
                "path",
                "/description",
                "value",
                "edit " + done.incrementAndGet())));
  }

  private static void refreshSession(ForkedServerNode node, Seed seed, AtomicInteger done) {
    int status = seed.session.refresh(node.apiBase().toString());
    if (status != 200) {
      throw new AssertionError("The node answered the session refresh with " + status);
    }
    done.incrementAndGet();
  }

  private static void keepRunning(
      AtomicBoolean stop, AtomicReference<Throwable> failure, Runnable step) {
    while (!stop.get() && failure.get() == null) {
      try {
        step.run();
      } catch (RuntimeException | AssertionError broken) {
        failure.compareAndSet(null, broken);
      }
    }
  }

  private static void sendTestMessage(Seed seed, HeaderReceiver receiver) {
    var admin = SdkClients.adminClient().getHttpClient();
    JsonNode alert =
        JsonUtils.readTree(
            admin.executeForString(
                HttpMethod.GET, "/v1/events/subscriptions/" + seed.alertId, null));
    JsonNode destination = alert.path("destinations").path(0);
    admin.executeForString(
        HttpMethod.POST,
        "/v1/events/subscriptions/testDestination",
        Map.of("destinations", List.of(destination)));
    Awaitility.await("the receiver got the test message")
        .atMost(WAIT)
        .pollInterval(100, TimeUnit.MILLISECONDS)
        .until(() -> !receiver.headersSeen().isEmpty());
    assertEquals(
        seed.secrets.get("alert header"),
        receiver.headersSeen().getLast().get("x-key"),
        "the test send carries the original header value");
  }

  private static JsonNode call(URI base, String method, String path, Object body) {
    String contentType =
        "PATCH".equals(method) ? "application/json-patch+json" : "application/json";
    HttpRequest.Builder request =
        HttpRequest.newBuilder(URI.create(base + path))
            .timeout(SERVER_CALL)
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", contentType);
    request.method(
        method,
        body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(body)));
    try {
      HttpResponse<String> response =
          HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        throw new AssertionError(method + " " + path + " answered " + response.statusCode());
      }
      return response.body().isBlank()
          ? JsonUtils.readTree("{}")
          : JsonUtils.readTree(response.body());
    } catch (IOException failure) {
      throw new IllegalStateException(method + " " + path + " failed", failure);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted during " + method + " " + path, interrupted);
    }
  }

  private static int status(URI base, String path) {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(base + path))
            .timeout(SERVER_CALL)
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    try {
      return HTTP.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
    } catch (IOException failure) {
      throw new IllegalStateException("GET " + path + " failed", failure);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted during GET " + path, interrupted);
    }
  }

  // ---- direct reads of the suite database ----

  private static String storedUserJson(String name) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM user_entity WHERE name = :name")
                    .bind("name", name)
                    .mapTo(String.class)
                    .one());
  }

  private static String storedSettingJson(String configType) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT json FROM openmetadata_settings WHERE configType = :configType")
                    .bind("configType", configType)
                    .mapTo(String.class)
                    .findOne()
                    .orElse(null));
  }

  private static String storedSmtpPassword() {
    return JsonUtils.readTree(storedSettingJson("emailConfiguration")).path("password").asText();
  }

  private static String ssoPendingState(String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT pending_state FROM sso_test_login_session WHERE test_session_id = :id")
                    .bind("id", id)
                    .mapTo(String.class)
                    .one());
  }

  private static void restoreSetting(String configType, String previousJson) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              if (previousJson == null) {
                handle
                    .createUpdate("DELETE FROM openmetadata_settings WHERE configType = :type")
                    .bind("type", configType)
                    .execute();
              } else {
                String cast =
                    TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL
                        ? "CAST(:json AS JSON)"
                        : "CAST(:json AS jsonb)";
                handle
                    .createUpdate(
                        "UPDATE openmetadata_settings SET json = "
                            + cast
                            + " WHERE configType = :type")
                    .bind("json", previousJson)
                    .bind("type", configType)
                    .execute();
              }
            });
    SettingsCache.invalidateSettings(configType);
  }

  private static void dropTable(String table) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(handle -> handle.execute("DROP TABLE IF EXISTS " + table));
  }

  // ---- keys ----

  private static String suiteFernetKey() {
    String key =
        TestSuiteBootstrap.createApplicationConfigCopy().getFernetConfiguration().getFernetKey();
    assertFalse(key.contains(","), "the suite is keyed by a single Fernet key");
    return key;
  }

  private static String randomKey() {
    String key = Key.generateKey().serialise();
    assertNotEquals(KeyRing.parse(newKey).fingerprints(), KeyRing.parse(key).fingerprints());
    return key;
  }

  // ---- fixtures ----

  /** A local server that keeps the headers of each request. */
  private static final class HeaderReceiver implements AutoCloseable {
    private final HttpServer server;
    private final List<Map<String, String>> seen = new CopyOnWriteArrayList<>();

    HeaderReceiver() throws IOException {
      server = HttpServer.create(new InetSocketAddress(0), 0);
      server.createContext(
          "/",
          exchange -> {
            Map<String, String> headers = new LinkedHashMap<>();
            exchange
                .getRequestHeaders()
                .forEach(
                    (name, values) ->
                        headers.put(name.toLowerCase(Locale.ROOT), values.getFirst()));
            exchange.getRequestBody().readAllBytes();
            seen.add(Map.copyOf(headers));
            byte[] answer = "{}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, answer.length);
            exchange.getResponseBody().write(answer);
            exchange.close();
          });
      server.start();
    }

    // The name, not 127.0.0.1: the server refuses outgoing requests to a loopback address.
    String url(String path) {
      return "http://localhost:" + server.getAddress().getPort() + path;
    }

    List<Map<String, String>> headersSeen() {
      return seen;
    }

    @Override
    public void close() {
      server.stop(0);
    }
  }

  /** A signed-in user's session cookie, as a browser would keep it. */
  private static final class SessionClient {
    private volatile String sessionId;

    String sessionId() {
      return sessionId;
    }

    void login(String baseUrl, String email) throws IOException, InterruptedException {
      LoginRequest login =
          new LoginRequest()
              .withEmail(email)
              .withPassword(
                  Base64.getEncoder()
                      .encodeToString(SESSION_PASSWORD.getBytes(StandardCharsets.UTF_8)));
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(baseUrl + "/api/v1/auth/login"))
              .timeout(SERVER_CALL)
              .header("Content-Type", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(login)))
              .build();
      HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
      assertEquals(200, response.statusCode(), "the seeded user signs in");
      capture(response);
      assertTrue(sessionId != null, "login set the session cookie");
    }

    int refresh(String baseUrl) {
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(baseUrl + "/api/v1/auth/refresh"))
              .timeout(SERVER_CALL)
              .header("Content-Type", "application/json")
              .header("Cookie", "OM_SESSION=" + sessionId)
              .POST(HttpRequest.BodyPublishers.noBody())
              .build();
      try {
        HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        capture(response);
        return response.statusCode();
      } catch (IOException failure) {
        throw new IllegalStateException("The session refresh failed", failure);
      } catch (InterruptedException interrupted) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Interrupted during the session refresh", interrupted);
      }
    }

    private void capture(HttpResponse<?> response) {
      for (String header : response.headers().allValues("set-cookie")) {
        if (header.startsWith("OM_SESSION=")) {
          int end = header.indexOf(';');
          sessionId = header.substring("OM_SESSION=".length(), end < 0 ? header.length() : end);
        }
      }
    }
  }
}
