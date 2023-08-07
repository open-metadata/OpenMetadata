package org.openmetadata.sdk.util;
import java.io.Serializable;
import java.util.AbstractMap;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public class CaseInsensitiveMap<V> extends AbstractMap<String, V>
    implements Map<String, V>, Cloneable, Serializable {
  private static final long serialVersionUID = 107333939521129358L;

  @SuppressWarnings("serial")
  private Map<String, Entry<String, V>> store;

  public CaseInsensitiveMap() {
    this.store = new HashMap<String, Entry<String, V>>();
  }

    public static <V> CaseInsensitiveMap<V> of(Map<String, V> map) {
    if (map == null) {
      return null;
    }
    CaseInsensitiveMap<V> ciMap = new CaseInsensitiveMap<>();
    ciMap.putAll(map);
    return ciMap;
  }

  // Query Operations

  @Override
  public boolean containsKey(Object key) {
    String keyLower = convertKey(key);
    return this.store.containsKey(keyLower);
  }

  @Override
  public boolean containsValue(Object value) {
    return this.values().contains(value);
  }

  @Override
  public V get(Object key) {
    String keyLower = convertKey(key);
    Entry<String, V> entry = this.store.get(keyLower);
    if (entry == null) {
      return null;
    }
    return entry.getValue();
  }

  // Modification Operations

  @Override
  public V put(String key, V value) {
    String keyLower = convertKey(key);
    this.store.put(keyLower, new AbstractMap.SimpleEntry<String, V>(key, value));
    return value;
  }

  @Override
  public V remove(Object key) {
    String keyLower = convertKey(key);
    Entry<String, V> entry = this.store.remove(keyLower);
    if (entry == null) {
      return null;
    }
    return entry.getValue();
  }

  // Bulk Operations

  @Override
  public void clear() {
    this.store.clear();
  }

  // Views

  @Override
  public Set<String> keySet() {
    return this.store.values().stream().map(entry -> entry.getKey()).collect(Collectors.toSet());
  }

  @Override
  public Collection<V> values() {
    return this.store.values().stream().map(entry -> entry.getValue()).collect(Collectors.toList());
  }

  @Override
  public Set<Entry<String, V>> entrySet() {
    return this.store.values().stream().collect(Collectors.toSet());
  }

  // Utility

  private static String convertKey(Object key) {
    if (key == null) {
      return null;
    } else if (key instanceof String) {
      return ((String) key).toLowerCase();
    }
    throw new IllegalArgumentException("key must be a String");
  }
}
