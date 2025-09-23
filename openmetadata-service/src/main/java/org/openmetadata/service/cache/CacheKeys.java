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
