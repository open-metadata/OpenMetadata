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

import com.macasaet.fernet.Key;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.Opening;

class FernetSweepTest {
  private static final String NEW_KEY = Key.generateKey().serialise();
  private static final String OLD_KEY = Key.generateKey().serialise();
  private static final KeyRing NEW = KeyRing.parse(NEW_KEY);
  private static final KeyRing OLD = KeyRing.parse(OLD_KEY);
  private static final KeyRing RING = KeyRing.parse(NEW_KEY + "," + OLD_KEY);
  private static final Location ROW =
      new Location(
          "dbservice_entity",
          "json",
          List.of("id"),
          List.of("3d0a6a5e-1111-4b2c-8d3e-9f0a1b2c3d4e"));

  @Test
  void aValueChangedOnceBetweenReadAndWriteEndsRekeyed() {
    FakeStore store = new FakeStore("dbservice_entity");
    store.put(StoredText.writable(ROW, json(OLD.seal("first"), 1), Encoding.JSON));
    store.interfereBeforeWrite(ROW, json(OLD.seal("second"), 2));

    FernetSweep.Result result = FernetSweep.rewrite(List.of(store), RING);

    assertEquals(1L, result.tallies().getFirst().count(Outcome.REKEYED));
    assertEquals(0L, result.tallies().getFirst().count(Outcome.CONTENDED));
    assertEquals(List.of(), result.problems().shown());
    assertEquals(1, store.writes);
    var stored = JsonUtils.readTree(store.text(ROW));
    assertEquals(2, stored.get("version").intValue(), "the concurrent writer's change is kept");
    assertEquals(
        new Opening.Primary("second"),
        NEW.open(stored.at("/connection/config/password").textValue()));
  }

  @Test
  void aValueChangedEveryTimeEndsContended() {
    FakeStore store = new FakeStore("dbservice_entity");
    store.put(StoredText.writable(ROW, json(OLD.seal("first"), 1), Encoding.JSON));
    store.interfereBeforeEveryWrite(ROW, () -> json(OLD.seal("again"), 9));

    FernetSweep.Result result = FernetSweep.rewrite(List.of(store), RING);

    assertEquals(1L, result.tallies().getFirst().count(Outcome.CONTENDED));
    assertEquals(0L, result.tallies().getFirst().count(Outcome.REKEYED));
    assertEquals(0, store.writes);
    assertEquals(FernetSweep.MAX_ATTEMPTS, store.attempts);
    assertEquals(
        List.of(
            "dbservice_entity id=3d0a6a5e-1111-4b2c-8d3e-9f0a1b2c3d4e json: value that kept changing while it was re-encrypted"),
        result.problems().shown().stream().map(Problem::line).toList());
    assertEquals(Verdict.NOT_SAFE, Verdict.of(result.tallies()));
  }

  @Test
  void aDriverMessageIsDescribedByItsFirstLineOnly() {
    String token = OLD.seal("hunter2");
    var failure =
        new RuntimeException(
            new SQLException(
                "ERROR: invalid input syntax for type json\n  Detail: Token \""
                    + token
                    + "\" is invalid.\n  Where: JSON data, line 1",
                "22P02"));

    String described = FernetSweep.describe(failure);

    assertEquals("SQLException 22P02: ERROR: invalid input syntax for type json", described);
    assertFalse(described.contains(token));
  }

  @Test
  void aStoreThatThrowsIsUnreadableAndTheNextStoreIsStillRead() {
    TokenStore broken =
        new FakeStore("broken_table") {
          @Override
          public Stream<StoredText> candidates() {
            throw new IllegalStateException("connection reset");
          }
        };
    FakeStore healthy = new FakeStore("user_entity");
    healthy.put(StoredText.writable(ROW, json(OLD.seal("bot-jwt"), 1), Encoding.JSON));

    FernetSweep.Result result = FernetSweep.rewrite(List.of(broken, healthy), RING);

    assertEquals(StoreTally.unreadable("broken_table"), result.tallies().getFirst());
    assertEquals(1L, result.tallies().getLast().count(Outcome.REKEYED));
    assertEquals(Verdict.NOT_SAFE, Verdict.of(result.tallies()));
  }

  @Test
  void aSecondRunWritesNothingAndTheCheckPassFindsEverythingUnderThePrimaryKey() {
    FakeStore store = new FakeStore("dbservice_entity");
    store.put(StoredText.writable(ROW, json(OLD.seal("first"), 1), Encoding.JSON));
    FernetSweep.rewrite(List.of(store), RING);
    String afterFirstRun = store.text(ROW);

    FernetSweep.Result second = FernetSweep.rewrite(List.of(store), RING);
    FernetSweep.Result check = FernetSweep.check(List.of(store), RING);

    assertEquals(afterFirstRun, store.text(ROW));
    assertEquals(1, store.writes);
    assertEquals(0L, second.tallies().getFirst().count(Outcome.REKEYED));
    assertEquals(1L, second.tallies().getFirst().count(Outcome.PRIMARY));
    assertEquals(1L, check.tallies().getFirst().count(Outcome.PRIMARY));
    assertEquals(1L, check.tallies().getFirst().values());
    assertEquals(List.of(), check.problems().shown());
    assertEquals(Verdict.CLEAN, Verdict.of(check.tallies()));
  }

  @Test
  void theCheckPassWritesNothingAndNamesThePlace() {
    FakeStore store = new FakeStore("dbservice_entity");
    String before = json(OLD.seal("first"), 1);
    store.put(StoredText.writable(ROW, before, Encoding.JSON));

    FernetSweep.Result result = FernetSweep.check(List.of(store), RING);

    assertEquals(before, store.text(ROW));
    assertEquals(0, store.writes);
    assertEquals(1L, result.tallies().getFirst().count(Outcome.OLDER_KEY));
    assertEquals(
        List.of(
            "dbservice_entity id=3d0a6a5e-1111-4b2c-8d3e-9f0a1b2c3d4e json /connection/config/password: token that only an older configured key opens"),
        result.problems().shown().stream().map(Problem::line).toList());
    assertFalse(result.problems().shown().getFirst().line().contains("fernet:"));
  }

  @Test
  void anOlderKeyTokenWhereNothingCanBeWrittenIsNotRewritable() {
    FakeStore store = new FakeStore("fernet_it_nopk");
    Location noKey = new Location("fernet_it_nopk", "note", List.of(), List.of());
    store.put(new StoredText(noKey, OLD.seal("x"), Encoding.TEXT, Writability.NO_PRIMARY_KEY));

    FernetSweep.Result written = FernetSweep.rewrite(List.of(store), RING);
    FernetSweep.Result result = FernetSweep.check(List.of(store), RING);

    assertEquals(0, store.writes);
    assertEquals(1L, written.tallies().getFirst().count(Outcome.UNREWRITABLE));
    assertEquals(1L, result.tallies().getFirst().count(Outcome.UNREWRITABLE));
    assertEquals(
        List.of(
            "fernet_it_nopk (no primary key) note: token that will not be replaced: its table has no primary key"),
        result.problems().shown().stream().map(Problem::line).toList());
  }

  @Test
  void aValueRemovedAfterALostRaceIsLeftToTheCheckPass() {
    FakeStore store = new FakeStore("user_session");
    Location session = new Location("user_session", "json", List.of("id"), List.of("s-1"));
    store.put(StoredText.writable(session, json(OLD.seal("refresh"), 1), Encoding.JSON));
    store.removeBeforeWrite(session);

    FernetSweep.Result result = FernetSweep.rewrite(List.of(store), RING);

    assertEquals(1L, result.tallies().getFirst().values());
    assertEquals(Map.of(), result.tallies().getFirst().counts());
    assertEquals(List.of(), result.problems().shown());
    assertTrue(store.reread(session).isEmpty());
  }

  @Test
  void aValueWhoseWriteThrowsIsNotRewritableAndTheOthersAreStillReencrypted() {
    Location bad = new Location("dbservice_entity", "json", List.of("id"), List.of("bad"));
    FakeStore store =
        new FakeStore("dbservice_entity") {
          @Override
          public boolean compareAndSet(StoredText read, String replacement) {
            if (read.at().equals(bad)) {
              throw new IllegalStateException(
                  "duplicate key (" + read.text() + ") violates a constraint");
            }
            return super.compareAndSet(read, replacement);
          }
        };
    store.put(StoredText.writable(bad, json(OLD.seal("first"), 1), Encoding.JSON));
    store.put(StoredText.writable(ROW, json(OLD.seal("second"), 1), Encoding.JSON));

    FernetSweep.Result write = FernetSweep.rewrite(List.of(store), RING);
    FernetSweep.Result check = FernetSweep.check(List.of(store), RING);
    StoreTally merged = check.tallies().getFirst().withWrites(write.tallies().getFirst());

    assertEquals(1L, write.tallies().getFirst().count(Outcome.UNREWRITABLE));
    assertEquals(1L, write.tallies().getFirst().count(Outcome.REKEYED));
    assertEquals(
        new Opening.Primary("second"),
        NEW.open(
            JsonUtils.readTree(store.text(ROW)).at("/connection/config/password").textValue()));
    assertEquals(
        List.of(
            "dbservice_entity id=bad json: token that will not be replaced: could not be written (IllegalStateException)"),
        write.problems().shown().stream().map(Problem::line).toList());
    assertEquals(1L, merged.count(Outcome.UNREWRITABLE));
    assertEquals(Verdict.NOT_SAFE, Verdict.of(List.of(merged)));
  }

  @Test
  void aStoreThatFailsMidwayThroughItsIterationIsUnreadable() {
    FakeStore store =
        new FakeStore("user_session") {
          @Override
          public Stream<StoredText> candidates() {
            Stream<StoredText> failing =
                Stream.generate(
                    () -> {
                      throw new IllegalStateException("cursor lost");
                    });
            return Stream.concat(super.candidates(), failing);
          }
        };
    store.put(StoredText.writable(ROW, json(OLD.seal("bot-jwt"), 1), Encoding.JSON));

    FernetSweep.Result result = FernetSweep.check(List.of(store), RING);

    assertEquals(StoreTally.unreadable("user_session"), result.tallies().getFirst());
    assertEquals(Verdict.NOT_SAFE, Verdict.of(result.tallies()));
  }

  @Test
  void problemsAreCountedExactlyButOnlyAHundredOfEachKindAreKept() {
    FakeStore store = new FakeStore("user_entity");
    for (int i = 0; i < 150; i++) {
      Location at = new Location("user_entity", "json", List.of("id"), List.of("older-" + i));
      store.put(StoredText.writable(at, json(OLD.seal("v" + i), 1), Encoding.JSON));
    }
    for (int i = 0; i < 3; i++) {
      Location at = new Location("user_entity", "json", List.of("id"), List.of("lost-" + i));
      store.put(
          StoredText.writable(
              at, json(KeyRing.parse(Key.generateKey().serialise()).seal("x"), 1), Encoding.JSON));
    }

    FernetSweep.Result result = FernetSweep.check(List.of(store), RING);

    assertEquals(3L, result.problems().realCount());
    assertEquals(150L, result.problems().olderKeyCount());
    List<Problem> shown = result.problems().shown();
    assertEquals(100, shown.size());
    assertEquals(3, shown.stream().filter(p -> p.outcome() == Outcome.NO_KEY).count());
    assertEquals(97, shown.stream().filter(p -> p.outcome() == Outcome.OLDER_KEY).count());
  }

  private static String json(String token, int version) {
    return "{\"id\":\"3d0a6a5e-1111-4b2c-8d3e-9f0a1b2c3d4e\",\"version\":"
        + version
        + ",\"connection\":{\"config\":{\"password\":\""
        + token
        + "\"}}}";
  }

  /** An in-memory store where a concurrent writer can change a value before each write. */
  private static class FakeStore implements TokenStore {
    private final String name;
    private final Map<Location, StoredText> values = new LinkedHashMap<>();
    private final Map<Location, Deque<Supplier<Optional<String>>>> interference = new HashMap<>();
    private final Map<Location, Supplier<String>> everyTime = new HashMap<>();
    int writes;
    int attempts;

    FakeStore(String name) {
      this.name = name;
    }

    void put(StoredText value) {
      values.put(value.at(), value);
    }

    String text(Location at) {
      return values.get(at).text();
    }

    void interfereBeforeWrite(Location at, String text) {
      interference.computeIfAbsent(at, it -> new ArrayDeque<>()).add(() -> Optional.of(text));
    }

    void removeBeforeWrite(Location at) {
      interference.computeIfAbsent(at, it -> new ArrayDeque<>()).add(Optional::empty);
    }

    void interfereBeforeEveryWrite(Location at, Supplier<String> text) {
      everyTime.put(at, text);
    }

    @Override
    public String name() {
      return name;
    }

    @Override
    public Stream<StoredText> candidates() {
      return List.copyOf(values.values()).stream();
    }

    @Override
    public Optional<StoredText> reread(Location at) {
      return Optional.ofNullable(values.get(at));
    }

    @Override
    public boolean compareAndSet(StoredText read, String replacement) {
      attempts++;
      interfere(read);
      StoredText current = values.get(read.at());
      boolean unchanged = current != null && current.text().equals(read.text());
      if (unchanged) {
        values.put(
            read.at(), new StoredText(read.at(), replacement, read.encoding(), read.writability()));
        writes++;
      }
      return unchanged;
    }

    private void interfere(StoredText read) {
      Deque<Supplier<Optional<String>>> queued =
          interference.getOrDefault(read.at(), new ArrayDeque<>());
      Supplier<Optional<String>> next = queued.poll();
      if (next == null && everyTime.containsKey(read.at())) {
        next = () -> Optional.of(everyTime.get(read.at()).get());
      }
      if (next != null) {
        Optional<String> text = next.get();
        if (text.isPresent()) {
          values.put(
              read.at(),
              new StoredText(read.at(), text.get(), read.encoding(), read.writability()));
        } else {
          values.remove(read.at());
        }
      }
    }
  }
}
