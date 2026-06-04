package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

@Slf4j
@Repository
public class SessionRepository {
  private final CollectionDAO dao;

  public SessionRepository() {
    this.dao = Entity.getCollectionDAO();
  }

  public Optional<UserSession> findById(String sessionId) {
    return Optional.ofNullable(dao.getUserSessionDAO().findById(sessionId));
  }

  public List<UserSession> findByUserIdAndStatus(String userId, SessionStatus status, int limit) {
    if (limit <= 0) {
      return List.of();
    }
    return dao.getUserSessionDAO().findByUserIdAndStatus(userId, status.name(), limit);
  }

  public List<UserSession> findSessionsToExpire(long now, int limit) {
    List<String> statuses =
        List.of(
            SessionStatus.ACTIVE.name(),
            SessionStatus.REFRESHING.name(),
            SessionStatus.PENDING.name());
    Map<String, UserSession> combined = new LinkedHashMap<>();
    if (limit <= 0) {
      return List.of();
    }
    addSessionsUntilLimit(
        combined,
        dao.getUserSessionDAO().findSessionsExpiredByAbsoluteTimeout(statuses, now, limit),
        limit);
    if (combined.size() < limit) {
      addSessionsUntilLimit(
          combined,
          dao.getUserSessionDAO().findSessionsExpiredByIdleTimeout(statuses, now, limit),
          limit);
    }
    return new ArrayList<>(combined.values());
  }

  private void addSessionsUntilLimit(
      Map<String, UserSession> combined, List<UserSession> sessions, int limit) {
    for (UserSession session : sessions) {
      if (combined.size() >= limit) {
        return;
      }
      combined.putIfAbsent(session.getId(), session);
    }
  }

  public List<UserSession> findSessionsToPrune(long cutoff, int limit) {
    return dao.getUserSessionDAO()
        .findSessionsToPrune(
            List.of(SessionStatus.REVOKED.name(), SessionStatus.EXPIRED.name()), cutoff, limit);
  }

  public void create(UserSession session) {
    dao.getUserSessionDAO().insert(JsonUtils.pojoToJson(session));
  }

  public boolean updateIfVersion(UserSession session, long expectedVersion) {
    return dao.getUserSessionDAO()
            .updateIfVersion(session.getId(), expectedVersion, JsonUtils.pojoToJson(session))
        == 1;
  }

  public void delete(String sessionId) {
    dao.getUserSessionDAO().delete(sessionId);
  }

  public int deleteByIds(List<String> sessionIds) {
    if (sessionIds.isEmpty()) {
      return 0;
    }
    return dao.getUserSessionDAO().deleteByIds(sessionIds);
  }
}
