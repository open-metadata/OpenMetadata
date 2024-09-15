package org.openmetadata.service.migration;

import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

public class MigrationConfiguration {
  @NotEmpty @Getter @Setter private String flywayPath;
  @NotEmpty @Getter @Setter private String nativePath;
  @NotEmpty @Getter @Setter private String extensionPath;
}
