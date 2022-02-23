package org.openmetadata.catalog.atlas;

import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.catalog.type.EventFilter;

public class AtlasPublisherConfiguration {
  @Getter @Setter List<EventFilter> filters;
  @Getter @Setter private int batchSize = 10;
}
