package org.openmetadata.service.cache;

import java.util.UUID;
import org.openmetadata.service.util.FullyQualifiedName;

public final class CacheKeys {
  public final String ns;

  public CacheKeys(String keyspace) {
    this.ns = keyspace;
  }

  public String entity(String type, UUID id) {
    String idHash = FullyQualifiedName.buildHash(id.toString());
    return ns + ":e:" + type + ":" + idHash;
  }

  public String rel(String type, UUID id, String rel, String dir) {
    String idHash = FullyQualifiedName.buildHash(id.toString());
    return ns + ":rel:" + type + ":" + idHash + ":" + rel + ":" + dir;
  }

  public String tags(String type, UUID id) {
    String idHash = FullyQualifiedName.buildHash(id.toString());
    return ns + ":tags:" + type + ":" + idHash;
  }

  public String ctags(String type, UUID id, String colFqn) {
    String idHash = FullyQualifiedName.buildHash(id.toString());
    String colFqnHash = FullyQualifiedName.buildHash(colFqn);
    return ns + ":ctags:" + type + ":" + idHash + ":" + colFqnHash;
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
