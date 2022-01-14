package org.openmetadata.catalog.events;

import java.util.Map;

public class EventPublisherConfiguration {
  String name;
  String className;
  Map<String, Object> config;

  public String getName() {
    return name;
  }

  public String getClassName() {
    return className;
  }

  public Map<String, Object> getConfig() {
    return config;
  }
}
