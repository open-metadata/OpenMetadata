/*
 *  Copyright 2021 Collate
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
import org.openmetadata.service.jdbi3.SessionRepository;

/**
 * {@link SessionStore} backed by the {@code user_session} table via {@link SessionRepository}.
 * This is the default store used when no Redis cache is configured.
 */
public class JdbcSessionStore implements SessionStore {
  private final SessionRepository repository;

  public JdbcSessionStore() {
    this(new SessionRepository());
  }

  public JdbcSessionStore(SessionRepository repository) {
    this.repository = repository;
  }

  @Override
  public Optional<UserSession> findById(String sessionId) {
    return repository.findById(sessionId);
  }

  @Override
  public List<UserSession> findByUserIdAndStatus(String userId, SessionStatus status, int limit) {
    return repository.findByUserIdAndStatus(userId, status, limit);
  }

  @Override
  public List<UserSession> findSessionsToExpire(long now, int limit) {
    return repository.findSessionsToExpire(now, limit);
  }

  @Override
  public List<UserSession> findSessionsToPrune(long cutoff, int limit) {
    return repository.findSessionsToPrune(cutoff, limit);
  }

  @Override
  public void create(UserSession session) {
    repository.create(session);
  }

  @Override
  public boolean updateIfVersion(UserSession session, long expectedVersion) {
    return repository.updateIfVersion(session, expectedVersion);
  }

  @Override
  public void delete(String sessionId) {
    repository.delete(sessionId);
  }

  @Override
  public int deleteByIds(List<String> sessionIds) {
    return repository.deleteByIds(sessionIds);
  }
}
