package org.openmetadata.catalog.atlas;

import java.util.List;
import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.catalog.type.EventFilter;

public class AtlasPublisherConfiguration {
  @Getter @Setter private String atlasUrl;
  @Getter @Setter private String username;
  @Getter @Setter private String password;
  @NotEmpty @Getter @Setter private String openMetadataUrl;
  @Getter @Setter List<EventFilter> filters;
  @Getter @Setter private int batchSize = 10;
}
