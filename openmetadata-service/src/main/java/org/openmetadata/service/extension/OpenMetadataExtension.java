package org.openmetadata.service.extension;

import io.dropwizard.setup.Environment;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.api.configuration.extension.Extension;
import org.openmetadata.service.OpenMetadataApplicationConfig;

public interface OpenMetadataExtension {
  void init(Extension extension, OpenMetadataApplicationConfig catalogConfig, Environment environment, Jdbi jdbi);
}
