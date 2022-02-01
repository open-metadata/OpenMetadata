package org.openmetadata.catalog.migration;

import javax.validation.constraints.NotEmpty;

public class MigrationConfiguration {
  @NotEmpty private String path;

  public String getPath() {
    return path;
  }

  public void setPath(String path) {
    this.path = path;
  }
}
