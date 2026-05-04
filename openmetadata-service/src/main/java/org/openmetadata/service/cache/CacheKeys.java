package org.openmetadata.service.cache;

import java.util.UUID;
import org.openmetadata.service.util.FullyQualifiedName;

public final class CacheKeys {
  public final String ns;

  public CacheKeys(String keyspace) {
    this.ns = keyspace;
  }

  public String entity(String type, UUID id) {
    return ns + ":e:" + type + ":" + id.toString();
  }

  /**
   * Packed read-bundle key for an entity (relationships + tags in one blob). Uses Redis hash tag
   * braces around the UUID so related keys for the same entity route to the same Redis Cluster
   * slot for MGET/pipelining affinity.
   */
  public String bundle(String type, UUID id) {
    return ns + ":bundle:{" + id.toString() + "}:" + type;
  }

  /**
   * Cached "find my parent via relationship R" lookup — used to serve href assembly without
   * re-reading {@code entity_relationship}. Keyed by the child's id with a Redis hash tag so
   * all parent lookups for the same child route to the same cluster slot.
   */
  public String containerRef(String childType, UUID childId, int relation) {
    return ns + ":parent:{" + childId.toString() + "}:" + childType + ":" + relation;
  }

  public String rel(String type, UUID id, String rel, String dir) {
    return ns + ":rel:" + type + ":" + id.toString() + ":" + rel + ":" + dir;
  }

  public String tags(String type, UUID id) {
    return ns + ":tags:" + type + ":" + id.toString();
  }

  public String ctags(String type, UUID id, String colFqn) {
    String colFqnHash = FullyQualifiedName.buildHash(colFqn);
    return ns + ":ctags:" + type + ":" + id.toString() + ":" + colFqnHash;
  }

  public String entityByName(String type, String fqn) {
    String fqnHash = FullyQualifiedName.buildHash(fqn);
    return ns + ":en:" + type + ":" + fqnHash;
  }

  public String refByName(String type, String fqn) {
    String fqnHash = FullyQualifiedName.buildHash(fqn);
    return ns + ":rn:" + type + ":" + fqnHash;
  }

  /**
   * Redis hash key holding cached listing totals for an entity type. Each ListFilter variant
   * lives as a field (hash of its WHERE clause + bound params) under this single key, so a
   * single DEL atomically clears every filter variant on create/delete/restore.
   */
  public String listCount(String entityType) {
    return ns + ":lc:" + entityType;
  }

  /**
   * Cached ancestor chain (topology only) for hierarchical entities, keyed by the descendant's
   * FQN hash. The value is the ordered list of ancestor FQNs.
   *
   * <p><b>What stays fresh:</b> ancestor display names. The {@code List<String>} of FQNs is
   * resolved per-read into {@link org.openmetadata.schema.type.EntityReference}s through
   * {@link #refByName} (the write-through per-entity reference cache, invalidated on every
   * entity write), so an edit to an ancestor's displayName shows up on the next breadcrumb
   * call.
   *
   * <p><b>What does NOT stay fresh:</b> if an ancestor's FQN itself changes (rename), the
   * cached chain still references the old FQN. Hydration drops that entry and the chain
   * comes back shorter until the descendant's own ancestors key expires. There is no
   * reverse index from ancestor → descendant, so we don't proactively invalidate
   * descendants on an ancestor rename — TTL is the backstop.
   *
   * <p><b>Invalidation:</b> descendant-local — each writer drops the key for the FQN it
   * wrote. A rename of the descendant itself is self-healing: the descendant's own FQN
   * changes, so the old key is orphaned and TTL-expires while the new FQN starts cold.
   */
  public String ancestors(String type, String fqn) {
    String fqnHash = FullyQualifiedName.buildHash(fqn);
    return ns + ":anc:" + type + ":" + fqnHash;
  }

  /**
   * Per-parent version stamp for the children-page cache. Bumped on any change to the
   * parent's children list (a child create / update / delete or move). Old page keys
   * (which embed the previous version) become unreachable; they TTL-expire.
   */
  public String childrenVersion(String type, String parentFqn) {
    String fqnHash = FullyQualifiedName.buildHash(parentFqn);
    return ns + ":kidsver:" + type + ":" + fqnHash;
  }

  /**
   * Cached page of {@code /v1/&lt;entityType&gt;/name/{parentFqn}/children}. Keyed by the
   * parent's FQN hash + the per-parent version + page coordinates so a single version bump
   * orphans every cached page in one shot.
   *
   * <p>{@code include} (a 1-2 char tag — "nd" / "a" / "d", derived from the
   * {@link org.openmetadata.schema.type.Include} enum value) is part of the key because the
   * page result depends on whether soft-deleted children are included. Without this,
   * toggling the UI's "Deleted" switch would return a stale page from the other side until
   * the version stamp rotates.
   */
  public String childrenPage(
      String type, String parentFqn, String version, int limit, int offset, String includeTag) {
    String fqnHash = FullyQualifiedName.buildHash(parentFqn);
    return ns
        + ":kids:"
        + type
        + ":"
        + fqnHash
        + ":v"
        + version
        + ":i"
        + includeTag
        + ":l"
        + limit
        + ":o"
        + offset;
  }
}
