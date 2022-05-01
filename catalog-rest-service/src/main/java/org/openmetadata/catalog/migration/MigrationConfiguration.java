package org.openmetadata.catalog.migration;

import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

public class MigrationConfiguration {
  @NotEmpty @Getter @Setter private String path;
}
