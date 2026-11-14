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

import io.lettuce.core.KeyScanCursor;
import io.lettuce.core.MapScanCursor;
import io.lettuce.core.ScanArgs;
import io.lettuce.core.ScanCursor;
import io.lettuce.core.ScoredValue;
import io.lettuce.core.ScriptOutputType;
import io.lettuce.core.ValueScanCursor;
import io.lettuce.core.api.sync.RedisCommands;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Spliterator;
import java.util.Spliterators;
import java.util.function.Function;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.service.fernet.Fernet;

/**
 * Every key under a prefix: sessions, the entity cache and any cached value a distribution adds are
 * read alike. A string is one value and a hash gives one value per field. A list, set or sorted set
 * member that holds a token is reported, never written. Writes are compare-and-set scripts; a string
 * keeps its remaining TTL and a hash field is set with {@code HSET}, which keeps the key's.
 */
final class RedisTokenStore implements TokenStore {
  static final int SCAN_COUNT = 1000;
  // PTTL is 0 for a key that expires at the script's frozen clock while GET still returns it; a
  // SET without PX would make it permanent, so that case is a lost race.
  private static final String STRING_CAS =
      """
      if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
      local ttl = redis.call('PTTL', KEYS[1])
      if ttl == 0 then return 0 end
      if ttl > 0 then redis.call('SET', KEYS[1], ARGV[2], 'PX', ttl) else redis.call('SET', KEYS[1], ARGV[2]) end
      return 1
      """;
  private static final String HASH_CAS =
      """
      if redis.call('HGET', KEYS[1], ARGV[1]) ~= ARGV[2] then return 0 end
      redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
      return 1
      """;
  private static final String STRING = "string";
  private static final String HASH = "hash";
  private static final String LIST = "list";
  private static final String SET = "set";
  private static final String SORTED_SET = "zset";
  private static final String MEMBER = "member";

  private final RedisCommands<String, String> commands;
  private final List<String> prefixes;
  private long keysScanned;

  RedisTokenStore(RedisCommands<String, String> commands, List<String> prefixes) {
    this.commands = commands;
    this.prefixes = List.copyOf(prefixes);
  }

  @Override
  public String name() {
    return Location.REDIS;
  }

  /** How many keys the last {@link #candidates()} walk saw. */
  long keysScanned() {
    return keysScanned;
  }

  /** The keyspaces the keys read here start with, each quoted by the report line around it. */
  String keyspaces() {
    return String.join("\" and \"", prefixes);
  }

  @Override
  public Stream<StoredText> candidates() {
    keysScanned = 0;
    return StreamSupport.stream(
            Spliterators.spliteratorUnknownSize(new Keys(), Spliterator.ORDERED), false)
        .flatMap(this::valuesOf)
        .filter(value -> value.text().contains(Fernet.FERNET_PREFIX));
  }

  @Override
  public Optional<StoredText> reread(Location at) {
    String key = String.valueOf(at.keyValues().getFirst());
    String text = at.container().isEmpty() ? commands.get(key) : commands.hget(key, at.container());
    return Optional.ofNullable(text).map(it -> StoredText.writable(at, it, Encoding.TEXT));
  }

  @Override
  public boolean compareAndSet(StoredText read, String replacement) {
    String key = String.valueOf(read.at().keyValues().getFirst());
    Long written =
        read.at().container().isEmpty()
            ? commands.eval(
                STRING_CAS, ScriptOutputType.INTEGER, new String[] {key}, read.text(), replacement)
            : commands.eval(
                HASH_CAS,
                ScriptOutputType.INTEGER,
                new String[] {key},
                read.at().container(),
                read.text(),
                replacement);
    return written != null && written == 1L;
  }

  private Stream<StoredText> valuesOf(String key) {
    return switch (commands.type(key)) {
      case STRING -> Stream.ofNullable(commands.get(key))
          .map(text -> StoredText.writable(Location.ofRedis(key, ""), text, Encoding.TEXT));
      case HASH -> hashFields(key);
      case LIST -> members(key, LIST, commands.lrange(key, 0, -1));
      case SET -> members(
          key,
          SET,
          scanned(
              cursor -> commands.sscan(key, cursor, ScanArgs.Builder.limit(SCAN_COUNT)),
              ValueScanCursor::getValues));
      case SORTED_SET -> members(
          key,
          SORTED_SET,
          scanned(
              cursor -> commands.zscan(key, cursor, ScanArgs.Builder.limit(SCAN_COUNT)),
              c -> c.getValues().stream().map(ScoredValue::getValue).toList()));
      default -> Stream.empty();
    };
  }

  private Stream<StoredText> hashFields(String key) {
    List<StoredText> fields = new ArrayList<>();
    ScanArgs args = ScanArgs.Builder.limit(SCAN_COUNT);
    MapScanCursor<String, String> cursor = commands.hscan(key, args);
    while (true) {
      for (Map.Entry<String, String> field : cursor.getMap().entrySet()) {
        fields.add(
            StoredText.writable(
                Location.ofRedis(key, field.getKey()), field.getValue(), Encoding.TEXT));
      }
      if (cursor.isFinished()) {
        break;
      }
      cursor = commands.hscan(key, cursor, args);
    }
    return fields.stream();
  }

  private static <C extends ScanCursor> List<String> scanned(
      Function<ScanCursor, C> scan, Function<C, List<String>> values) {
    List<String> members = new ArrayList<>();
    C cursor = scan.apply(ScanCursor.INITIAL);
    while (true) {
      members.addAll(values.apply(cursor));
      if (cursor.isFinished()) {
        break;
      }
      cursor = scan.apply(cursor);
    }
    return members;
  }

  private static Stream<StoredText> members(String key, String kind, List<String> members) {
    return members.stream()
        .map(
            member ->
                new StoredText(
                    Location.ofRedis(key, kind + " " + MEMBER),
                    member,
                    Encoding.TEXT,
                    Writability.REDIS_MEMBER));
  }

  /** The keys under each prefix in turn, one SCAN page at a time. */
  private final class Keys implements Iterator<String> {
    private final Iterator<String> remaining = prefixes.iterator();
    private final List<String> ready = new ArrayList<>();
    private ScanArgs args;
    private KeyScanCursor<String> cursor;

    @Override
    public boolean hasNext() {
      while (ready.isEmpty()) {
        if (cursor == null || cursor.isFinished()) {
          if (!remaining.hasNext()) {
            return false;
          }
          args = ScanArgs.Builder.matches(remaining.next() + ":*").limit(SCAN_COUNT);
          cursor = commands.scan(args);
        } else {
          cursor = commands.scan(cursor, args);
        }
        ready.addAll(cursor.getKeys());
        keysScanned += cursor.getKeys().size();
      }
      return true;
    }

    @Override
    public String next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      return ready.removeFirst();
    }
  }
}
