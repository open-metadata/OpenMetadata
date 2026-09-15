package org.openmetadata.service.entity.cache;

import java.util.Locale;
import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.service.Entity;

/** Uses the same canonical names as the row DAO, including case-insensitive user names. */
public final class EntityCacheKeys {
  private EntityCacheKeys() {}

  public static Pair<String, UUID> id(final String type, final UUID id) {
    return new ImmutablePair<>(type, id);
  }

  public static Pair<String, String> name(final String type, final String fqn) {
    return new ImmutablePair<>(
        type, fqn != null && Entity.USER.equals(type) ? fqn.toLowerCase(Locale.ROOT) : fqn);
  }
}
