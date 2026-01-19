package org.openmetadata.service.util;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class Registry<V> {
  private final Map<String, V> values;
  private final V defaultValue;

  public Registry(V defaultValue) {
    Objects.requireNonNull(defaultValue, "defaultValue cannot be null");
    values = new HashMap<>();
    this.defaultValue = defaultValue;
  }

  public void register(String key, V value) {
    Objects.requireNonNull(value, "value cannot be null");
    values.put(key, value);
  }

  public V get(String key) {
    if (key == null || !values.containsKey(key)) {
      return defaultValue;
    }
    return values.get(key);
  }
}
