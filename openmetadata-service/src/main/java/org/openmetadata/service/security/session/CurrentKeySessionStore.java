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

import java.util.List;
import java.util.Optional;
import org.openmetadata.service.fernet.KeyRing;

/**
 * {@link SessionService} writes its cached copy of a session back every five minutes and on every
 * refresh, with the stored refresh tokens as it read them. Without this class an older-key token
 * comes back after a Fernet key rotation has rewritten it, so a rotation never finishes while
 * users are signed in. It seals those tokens under the primary key on each write and leaves the
 * version and every other field alone, so no compare-and-set in the service changes.
 */
final class CurrentKeySessionStore implements SessionStore {
  private final SessionStore delegate;

  CurrentKeySessionStore(SessionStore delegate) {
    this.delegate = delegate;
  }

  @Override
  public Optional<UserSession> findById(String sessionId) {
    return delegate.findById(sessionId);
  }

  @Override
  public List<UserSession> findByUserIdAndStatus(String userId, SessionStatus status, int limit) {
    return delegate.findByUserIdAndStatus(userId, status, limit);
  }

  @Override
  public List<UserSession> findSessionsToExpire(long now, int limit) {
    return delegate.findSessionsToExpire(now, limit);
  }

  @Override
  public List<UserSession> findSessionsToPrune(long cutoff, int limit) {
    return delegate.findSessionsToPrune(cutoff, limit);
  }

  @Override
  public void create(UserSession session) {
    delegate.create(withCurrentKey(session));
  }

  @Override
  public boolean updateIfVersion(UserSession session, long expectedVersion) {
    return delegate.updateIfVersion(withCurrentKey(session), expectedVersion);
  }

  @Override
  public void delete(String sessionId) {
    delegate.delete(sessionId);
  }

  @Override
  public int deleteByIds(List<String> sessionIds) {
    return delegate.deleteByIds(sessionIds);
  }

  // The ring is read on every call so a key change is seen without rebuilding the store.
  static UserSession withCurrentKey(UserSession session) {
    KeyRing keys = KeyRing.current();
    if (keys.size() <= 1) {
      return session;
    }
    String omToken = keys.rekeyIfOlder(session.getOmRefreshToken());
    String providerToken = keys.rekeyIfOlder(session.getProviderRefreshToken());
    if (omToken == session.getOmRefreshToken()
        && providerToken == session.getProviderRefreshToken()) {
      return session;
    }
    return session.toBuilder().omRefreshToken(omToken).providerRefreshToken(providerToken).build();
  }
}
