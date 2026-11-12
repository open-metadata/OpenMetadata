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

package org.openmetadata.service.fernet.rotation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.fernet.rotation.FernetKeyRotation.Coverage;
import org.openmetadata.service.fernet.rotation.FernetKeyRotation.Mode;
import org.openmetadata.service.fernet.rotation.FernetKeyRotation.Report;

class VerdictTest {
  private static final List<String> FINGERPRINTS = List.of("9f3a1c2e7b40", "51d0e8aa02c7");

  static Stream<Arguments> outcomesToExitCodes() {
    return Stream.of(
        Arguments.of(Map.of(), 0),
        Arguments.of(Map.of(Outcome.PRIMARY, 5L), 0),
        Arguments.of(Map.of(Outcome.PRIMARY, 5L, Outcome.REKEYED, 2L), 0),
        Arguments.of(Map.of(Outcome.OLDER_KEY, 1L), 3),
        Arguments.of(Map.of(Outcome.UNBOUND, 1L), 3),
        Arguments.of(Map.of(Outcome.UNREWRITABLE, 1L), 3),
        Arguments.of(Map.of(Outcome.CONTENDED, 1L), 3),
        Arguments.of(Map.of(Outcome.NO_KEY, 1L, Outcome.OLDER_KEY, 1L), 3),
        Arguments.of(Map.of(Outcome.NO_KEY, 1L), 4),
        Arguments.of(Map.of(Outcome.PRIMARY, 3L, Outcome.NO_KEY, 2L), 4));
  }

  @ParameterizedTest
  @MethodSource("outcomesToExitCodes")
  void theExitCodeFollowsTheOutcomes(Map<Outcome, Long> counts, int exitCode) {
    Report report = report(Mode.REPORT, List.of(tally("user_entity", counts)), List.of());

    assertEquals(exitCode, report.exitCode());
  }

  @Test
  void anUnreadableStoreIsNotSafeEvenWhenEveryTokenFoundIsUnderThePrimaryKey() {
    Report report =
        report(
            Mode.REPORT,
            List.of(
                tally("user_entity", Map.of(Outcome.PRIMARY, 4L)),
                StoreTally.unreadable("ACT_GE_BYTEARRAY")),
            List.of());

    assertEquals(3, report.exitCode());
  }

  @Test
  void aCleanRunOfEveryTableNamesTheKeyThatCanGo() {
    Report report =
        report(
            Mode.APPLY,
            List.of(tally("user_entity", Map.of(Outcome.PRIMARY, 4L, Outcome.REKEYED, 4L))),
            List.of());
    CapturedTable table = new CapturedTable();

    List<String> lines = print(report, table);

    assertEquals("Fernet keys on this host: 9f3a1c2e7b40 (primary), 51d0e8aa02c7", lines.get(0));
    assertEquals(
        "Read 231 tables (402 text columns) and 18402 Redis keys under \"om\".", lines.get(1));
    assertEquals(
        "Every stored value opens with key 9f3a1c2e7b40. Key 51d0e8aa02c7 can be removed from the servers.",
        lines.getLast());
    assertEquals(
        List.of(
            "Store",
            "Values",
            "Primary",
            "Older key",
            "No key",
            "Unbound",
            "Not rewritable",
            "Re-encrypted",
            "Contended"),
        table.columns);
    assertEquals(
        List.of(List.of("user_entity", "4", "4", "0", "0", "0", "0", "4", "0")), table.rows);
  }

  @Test
  void aCleanRunThatLeftTablesOutAsksForEveryTableBeforeTheOldKeyGoes() {
    Report report =
        leavingOut(
            Mode.APPLY,
            List.of("change_event"),
            List.of(tally("user_entity", Map.of(Outcome.PRIMARY, 4L, Outcome.REKEYED, 4L))));

    List<String> lines = print(report, new CapturedTable());

    assertEquals(0, report.exitCode());
    assertEquals(
        "Every value read opens with key 9f3a1c2e7b40. Before key 51d0e8aa02c7 leaves the servers, confirm with --every-table.",
        lines.getLast());
  }

  @Test
  void aDefaultReportRunPrintsNoWriteColumnsAndAsksForApply() {
    Report report =
        leavingOut(
            Mode.REPORT,
            List.of("change_event"),
            List.of(
                tally("dbservice_entity", Map.of(Outcome.OLDER_KEY, 55L, Outcome.PRIMARY, 3L))));
    CapturedTable table = new CapturedTable();

    List<String> lines = print(report, table);

    assertEquals(
        List.of("Store", "Values", "Primary", "Older key", "No key", "Unbound", "Not rewritable"),
        table.columns);
    assertEquals(
        "Not safe to remove an older key: 55 tokens still need one and 0 places cannot be vouched for. Run with --apply.",
        lines.getLast());
  }

  @Test
  void aRunOfEveryTableThatIsNotSafeAsksToApplyToEveryTable() {
    Report report =
        report(
            Mode.APPLY,
            List.of(tally("change_event", Map.of(Outcome.OLDER_KEY, 2L, Outcome.PRIMARY, 3L))),
            List.of());

    List<String> lines = print(report, new CapturedTable());

    assertEquals(3, report.exitCode());
    assertEquals(
        "Not safe to remove an older key: 2 tokens still need one and 0 places cannot be vouched for. Run with --apply --every-table again, or fix the listed places.",
        lines.getLast());
  }

  @Test
  void problemLinesNameThePlaceByTheKeyPrintingRuleAndNeverAToken() {
    List<Problem> problems =
        List.of(
            new Problem(
                new Location("event_subscription_entity", "json", List.of("id"), List.of("4f1c")),
                "/destinations/0/config/headers/X-Key",
                TokenKind.BOUND,
                Outcome.UNBOUND,
                "its owner is unknown"),
            new Problem(
                new Location(
                    "entity_extension",
                    "json",
                    List.of("id", "extension"),
                    List.of("4f1c", "eventsubscription.version.0.2")),
                "/destinations/0/config/endpoint",
                TokenKind.BOUND,
                Outcome.UNBOUND,
                "no candidate owner opens it"),
            new Problem(
                new Location(
                    "user_session",
                    "json",
                    List.of("id"),
                    List.of("fernet:gAAAAsession-credential")),
                "/omRefreshToken",
                TokenKind.PLAIN,
                Outcome.NO_KEY,
                ""),
            new Problem(
                Location.ofRedis("om:session:abc", ""), "", TokenKind.PLAIN, Outcome.CONTENDED, ""),
            new Problem(
                Location.ofRedis("om:e:eventSubscription:4f1c", "base"),
                "/destinations/0/config/headers/X-Key",
                TokenKind.BOUND,
                Outcome.OLDER_KEY,
                ""));
    Report report =
        report(Mode.APPLY, List.of(tally("user_session", Map.of(Outcome.NO_KEY, 1L))), problems);

    List<String> lines = print(report, new CapturedTable());

    assertEquals(
        "event_subscription_entity id=4f1c json /destinations/0/config/headers/X-Key: bound token that cannot be opened: its owner is unknown",
        lines.get(2));
    assertEquals(
        "entity_extension id=4f1c,extension=eventsubscription.version.0.2 json /destinations/0/config/endpoint: bound token that cannot be opened: no candidate owner opens it",
        lines.get(3));
    assertEquals(
        "user_session key="
            + Location.digest("fernet:gAAAAsession-credential")
            + " json /omRefreshToken: token that no configured key opens",
        lines.get(4));
    assertEquals(
        "redis key="
            + Location.digest("om:session:abc")
            + ": value that kept changing while it was re-encrypted",
        lines.get(5));
    assertEquals(
        "redis key="
            + Location.digest("om:e:eventSubscription:4f1c")
            + " base /destinations/0/config/headers/X-Key: bound token that only an older configured key opens",
        lines.get(6));
    assertTrue(lines.get(4).matches("user_session key=[0-9a-f]{12} json .*"));
    assertFalse(String.join("\n", lines).contains("fernet:"));
  }

  @Test
  void atMostAHundredPlacesArePrintedProblemsFirstAndTheRestAreCounted() {
    List<Problem> problems = new ArrayList<>();
    for (int i = 0; i < 130; i++) {
      problems.add(place("older-" + i, Outcome.OLDER_KEY));
    }
    for (int i = 0; i < 3; i++) {
      problems.add(place("lost-" + i, Outcome.NO_KEY));
    }
    Report report =
        report(
            Mode.REPORT,
            List.of(tally("user_entity", Map.of(Outcome.OLDER_KEY, 130L, Outcome.NO_KEY, 3L))),
            problems);

    List<String> lines = print(report, new CapturedTable());

    assertEquals(3, lines.stream().filter(line -> line.startsWith("user_entity id=lost-")).count());
    assertEquals(
        97, lines.stream().filter(line -> line.startsWith("user_entity id=older-")).count());
    assertEquals(
        "33 more places that still need an older key are in the debug log.",
        lines.get(lines.size() - 2));
    assertFalse(lines.contains("0 more problems are in the log."));
  }

  @Test
  void problemsBeyondTheHundredShownAreCountedInTheTail() {
    List<Problem> problems = new ArrayList<>();
    for (int i = 0; i < 100; i++) {
      problems.add(place("lost-" + i, Outcome.NO_KEY));
    }
    Report report =
        new Report(
            Mode.REPORT,
            FINGERPRINTS,
            false,
            new Coverage(1, 1, Optional.empty(), ""),
            List.of(),
            List.of(tally("user_entity", Map.of(Outcome.NO_KEY, 130L, Outcome.OLDER_KEY, 7L))),
            problems,
            130,
            7);

    List<String> lines = print(report, new CapturedTable());

    assertEquals("30 more problems are in the log.", lines.get(lines.size() - 3));
    assertEquals(
        "7 more places that still need an older key are in the debug log.",
        lines.get(lines.size() - 2));
  }

  private static Problem place(String id, Outcome outcome) {
    return new Problem(
        new Location("user_entity", "json", List.of("id"), List.of(id)),
        "/authenticationMechanism/config/JWTToken",
        TokenKind.PLAIN,
        outcome,
        "");
  }

  @Test
  void theDefaultKeyAsPrimaryWarnsInAReportAndTheLeftOutTablesAreNamed() {
    Report report =
        report(
            Mode.REPORT,
            true,
            new Coverage(10, 20, Optional.empty(), ""),
            List.of("table_entity", "change_event"),
            List.of(tally("user_entity", Map.of(Outcome.PRIMARY, 1L))),
            List.of());

    List<String> lines = print(report, new CapturedTable());

    assertEquals("Read 10 tables (20 text columns).", lines.get(1));
    assertEquals(
        "Warning: the primary key is the default key shipped in openmetadata.yaml; values encrypted with it are not protected.",
        lines.get(2));
    assertEquals(
        "Large tables left out (--every-table reads them): table_entity, change_event",
        lines.get(3));
    assertEquals(0, report.exitCode());
  }

  @Test
  void onlyUnreadableValuesExplainThemselves() {
    Report report =
        report(
            Mode.REPORT,
            List.of(tally("oauth_access_tokens", Map.of(Outcome.NO_KEY, 2L))),
            List.of());

    List<String> lines = print(report, new CapturedTable());

    assertEquals(4, report.exitCode());
    assertEquals(
        "No stored value needs an older configured key, but 2 tokens open with no configured key. They were unreadable before this run; if a server lists a key this host does not, add it here and run again.",
        lines.getLast());
  }

  private static StoreTally tally(String store, Map<Outcome, Long> counts) {
    long values =
        counts.values().stream().mapToLong(Long::longValue).sum()
            - counts.getOrDefault(Outcome.REKEYED, 0L);
    return new StoreTally(store, true, values, counts);
  }

  private static Report report(Mode mode, List<StoreTally> stores, List<Problem> places) {
    return report(
        mode, false, new Coverage(231, 402, Optional.of(18402L), "om"), List.of(), stores, places);
  }

  private static Report leavingOut(Mode mode, List<String> leftOut, List<StoreTally> stores) {
    return report(
        mode, false, new Coverage(231, 402, Optional.of(18402L), "om"), leftOut, stores, List.of());
  }

  private static Report report(
      Mode mode,
      boolean primaryIsShippedDefault,
      Coverage coverage,
      List<String> leftOut,
      List<StoreTally> stores,
      List<Problem> places) {
    Problems problems = new Problems();
    places.forEach(problems::add);
    return new Report(
        mode,
        FINGERPRINTS,
        primaryIsShippedDefault,
        coverage,
        leftOut,
        stores,
        problems.shown(),
        problems.realCount(),
        problems.olderKeyCount());
  }

  private static List<String> print(Report report, CapturedTable table) {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    report.print(new PrintStream(bytes, true, StandardCharsets.UTF_8), table);
    return List.of(bytes.toString(StandardCharsets.UTF_8).split("\n"));
  }

  private static final class CapturedTable implements FernetKeyRotation.TablePrinter {
    List<String> columns;
    List<List<String>> rows;

    @Override
    public void print(List<String> columns, List<List<String>> rows, String emptyText) {
      this.columns = columns;
      this.rows = rows;
    }
  }
}
