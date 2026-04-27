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
}
