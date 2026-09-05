package org.openmetadata.service.migration;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

public class MigrationConfiguration {
  @NotEmpty @Getter @Setter private String nativePath;
  @NotEmpty @Getter @Setter private String extensionPath;

  /**
   * No longer read: the legacy Flyway scripts and their replay path are gone. The field is kept so
   * that deployments whose configuration still carries the key continue to start — Dropwizard
   * rejects unknown properties outright.
   */
  @Deprecated @Getter @Setter private String flywayPath;

  /**
   * Optional override for the consolidated baseline location. Left unset it resolves to a
   * {@code baseline} directory beside {@link #nativePath}, which is where the distribution ships
   * it, so deployments only need this when the two are relocated independently.
   */
  @Getter @Setter private String baselinePath;
}
