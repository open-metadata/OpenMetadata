package org.openmetadata.catalog.migration;

import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.catalog.jdbi3.locator.ConnectionType;

public class MigrationConfiguration {
  @NotEmpty @Getter @Setter private String path;
  @NotEmpty @Getter @Setter private ConnectionType connectionType = ConnectionType.MYSQL;
}
