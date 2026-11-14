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

package org.openmetadata.service.security.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.macasaet.fernet.Key;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.Opening;

class CurrentKeySessionStoreTest {
  private static final String NEW = Key.generateKey().serialise();
  private static final String OLD = Key.generateKey().serialise();

  private final KeyRing original = KeyRing.current();
  private final FakeStore fake = new FakeStore();
  private final SessionStore store = new CurrentKeySessionStore(fake);

  @AfterEach
  void restore() {
    Fernet.getInstance()
        .setFernetKey(
            original.size() == 0
                ? (String) null
                : String.join(",", original.keys().stream().map(Key::serialise).toList()));
  }

  @Test
  void createSealsOlderKeyTokensUnderThePrimaryKey() {
    Fernet.getInstance().setFernetKey(NEW + "," + OLD);

    store.create(sessionWithOldTokens());

    assertRekeyed(fake.stored);
  }

  @Test
  void updateIfVersionSealsOlderKeyTokensAndLeavesTheVersionAlone() {
    Fernet.getInstance().setFernetKey(NEW + "," + OLD);

    assertTrue(store.updateIfVersion(sessionWithOldTokens(), 7L));

    assertRekeyed(fake.stored);
    assertEquals(7L, fake.expectedVersion);
  }

  @Test
  void aSingleKeyPassesTheSessionThroughUntouched() {
    Fernet.getInstance().setFernetKey(NEW);
    UserSession session = sessionWithOldTokens();

    store.create(session);
    assertSame(session, fake.stored);
    store.updateIfVersion(session, 7L);
    assertSame(session, fake.stored);
  }

  @Test
  void aSessionAlreadyUnderThePrimaryKeyIsTheSameObject() {
    Fernet.getInstance().setFernetKey(NEW + "," + OLD);
    KeyRing ring = KeyRing.current();
    UserSession session =
        UserSession.builder().id("s1").omRefreshToken(ring.seal("om")).version(3L).build();

    store.create(session);

    assertSame(session, fake.stored);
  }

  @Test
  void theKeyRingIsReadOnEveryCallNotAtConstruction() {
    Fernet.getInstance().setFernetKey(NEW);
    UserSession session = sessionWithOldTokens();
    store.create(session);
    assertSame(session, fake.stored);

    Fernet.getInstance().setFernetKey(NEW + "," + OLD);
    store.create(session);

    assertRekeyed(fake.stored);
  }

  private static UserSession sessionWithOldTokens() {
    KeyRing old = KeyRing.parse(OLD);
    return UserSession.builder()
        .id("s1")
        .username("alice")
        .omRefreshToken(old.seal("om-token"))
        .providerRefreshToken(old.seal("provider-token"))
        .version(3L)
        .build();
  }

  private static void assertRekeyed(UserSession stored) {
    KeyRing newOnly = KeyRing.parse(NEW);
    assertEquals(new Opening.Primary("om-token"), newOnly.open(stored.getOmRefreshToken()));
    assertEquals(
        new Opening.Primary("provider-token"), newOnly.open(stored.getProviderRefreshToken()));
    assertEquals(3L, stored.getVersion());
    assertEquals("alice", stored.getUsername());
  }

  private static final class FakeStore implements SessionStore {
    UserSession stored;
    long expectedVersion;

    @Override
    public Optional<UserSession> findById(String sessionId) {
      return Optional.ofNullable(stored);
    }

    @Override
    public List<UserSession> findByUserIdAndStatus(String userId, SessionStatus status, int limit) {
      return new ArrayList<>();
    }

    @Override
    public List<UserSession> findSessionsToExpire(long now, int limit) {
      return List.of();
    }

    @Override
    public List<UserSession> findSessionsToPrune(long cutoff, int limit) {
      return List.of();
    }

    @Override
    public void create(UserSession session) {
      stored = session;
    }

    @Override
    public boolean updateIfVersion(UserSession session, long expected) {
      stored = session;
      expectedVersion = expected;
      return true;
    }

    @Override
    public void delete(String sessionId) {
      stored = null;
    }

    @Override
    public int deleteByIds(List<String> sessionIds) {
      return 0;
    }
  }
}
