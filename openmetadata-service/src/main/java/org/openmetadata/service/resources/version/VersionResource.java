/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.version;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.io.InputStream;
import java.util.Properties;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.OpenMetadataServerVersion;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.resources.Collection;

@Slf4j
@Path("/v1/system/version")
@Tag(name = "System", description = "APIs related to System configuration and settings.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "version")
public class VersionResource {
  private static final OpenMetadataServerVersion OPEN_METADATA_SERVER_VERSION;

  static {
    OPEN_METADATA_SERVER_VERSION = new OpenMetadataServerVersion();
    try {
      InputStream fileInput = OpenMetadataApplication.class.getResourceAsStream("/catalog/VERSION");
      Properties props = new Properties();
      props.load(fileInput);
      OPEN_METADATA_SERVER_VERSION.setVersion(props.getProperty("version", "unknown"));
      OPEN_METADATA_SERVER_VERSION.setRevision(props.getProperty("revision", "unknown"));

      String timestampAsString = props.getProperty("timestamp");
      Long timestamp = timestampAsString != null ? Long.valueOf(timestampAsString) : null;
      OPEN_METADATA_SERVER_VERSION.setTimestamp(timestamp);
    } catch (Exception ie) {
      LOG.warn("Failed to read catalog version file");
    }
  }

  @GET
  @Operation(
      operationId = "getCatalogVersion",
      summary = "Get version of metadata service",
      description = "Get the build version of OpenMetadata service and build timestamp.")
  public OpenMetadataServerVersion getCatalogVersion() {
    return OPEN_METADATA_SERVER_VERSION;
  }
}
