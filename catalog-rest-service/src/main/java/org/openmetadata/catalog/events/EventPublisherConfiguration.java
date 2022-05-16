package org.openmetadata.catalog.events;

import java.util.Map;
import lombok.Getter;

public class EventPublisherConfiguration {
  @Getter String name;
  @Getter String className;
  @Getter Map<String, Object> config;
}
