package org.openmetadata.catalog.jdbi3.locator;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.google.common.collect.ImmutableMap;
import java.util.Map;

@JsonFormat(shape = JsonFormat.Shape.OBJECT)
public enum ConnectionType {
  MYSQL("com.mysql.cj.jdbc.Driver"),
  POSTGRES("org.postgresql.Driver");

  public final String label;

  ConnectionType(String label) {
    this.label = label;
  }

  private static final Map<String, ConnectionType> labelMap;

  static {
    ImmutableMap.Builder<String, ConnectionType> builder = ImmutableMap.builder();
    for (ConnectionType t : ConnectionType.values()) {
      builder.put(t.label, t);
    }
    labelMap = builder.build();
  }

  @JsonCreator
  public static ConnectionType from(String value) {
    try {
      return labelMap.get(value);
    } catch (Exception e) {
      throw new IllegalArgumentException(
          String.format("Cannot create %s from value [%s]", ConnectionType.class.getName(), value), e);
    }
  }

  @Override
  public String toString() {
    return "ConnectionType{" + "name='" + name() + '\'' + "driver='" + label + '\'' + '}';
  }
}
