package org.openmetadata.service.util;

import java.util.HashMap;
import java.util.Map;

public class Registry<V> {
  private final Map<String, V> values;
  private final V defaultValue;

  public Registry(V defaultValue) {
    values = new HashMap<>();
    this.defaultValue = defaultValue;
  }

  public void register(String key, V value) {
    values.put(key, value);
  }

  public V get(String key) {
    if (values.containsKey(key)) return values.get(key);
    return defaultValue;
  }
}
