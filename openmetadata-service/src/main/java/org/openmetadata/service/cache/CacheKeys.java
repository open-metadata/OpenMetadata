package org.openmetadata.service.cache;

import java.util.UUID;

public final class CacheKeys {
  public final String ns;

  public CacheKeys(String keyspace) {
    this.ns = keyspace;
  }

  public String entity(String type, UUID id) {
    return ns + ":e:" + type + ":" + id;
  }

  public String rel(String type, UUID id, String rel, String dir) {
    return ns + ":rel:" + type + ":" + id + ":" + rel + ":" + dir;
  }

  public String tags(String type, UUID id) {
    return ns + ":tags:" + type + ":" + id;
  }

  public String ctags(String type, UUID id, String colFqn) {
    return ns + ":ctags:" + type + ":" + id + ":" + colFqn;
  }

  public String entityByName(String type, String fqn) {
    return ns + ":en:" + type + ":" + fqn;
  }

  public String refByName(String type, String fqn) {
    return ns + ":rn:" + type + ":" + fqn;
  }
}
