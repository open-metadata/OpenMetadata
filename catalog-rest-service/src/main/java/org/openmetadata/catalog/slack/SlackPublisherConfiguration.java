package org.openmetadata.catalog.slack;

import java.util.List;
import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.catalog.type.EventFilter;

public class SlackPublisherConfiguration {
  @NotEmpty @Getter @Setter private String webhookUrl;
  @NotEmpty @Getter @Setter private String name;
  @NotEmpty @Getter @Setter private String openMetadataUrl;
  @Getter @Setter List<EventFilter> filters;
  @Getter @Setter private int batchSize = 10;
}
