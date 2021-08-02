/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.version;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import org.openmetadata.catalog.CatalogApplication;
import org.openmetadata.catalog.api.CatalogVersion;
import org.openmetadata.catalog.resources.Collection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import java.io.InputStream;
import java.util.Properties;

@Path("/v1/version")
@Api(value = "Catalog version", tags = "Catalog version related operations")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "version")
public class VersionResource {
  private static final Logger LOG = LoggerFactory.getLogger(VersionResource.class);
  private static final CatalogVersion CATALOG_VERSION;

  static {
    CATALOG_VERSION = new CatalogVersion();
    try {
      InputStream fileInput = CatalogApplication.class.getResourceAsStream("/catalog/VERSION");
      Properties props = new Properties();
      props.load(fileInput);
      CATALOG_VERSION.setVersion(props.getProperty("version", "unknown"));
      CATALOG_VERSION.setRevision(props.getProperty("revision", "unknown"));

      String timestampAsString = props.getProperty("timestamp");
      Long timestamp = timestampAsString != null ? Long.valueOf(timestampAsString) : null;
      CATALOG_VERSION.setTimestamp(timestamp);
    } catch (Exception ie) {
      LOG.warn("Failed to read catalog version file");
    }
  }

  public VersionResource() {}

  @GET
  @Operation(summary = "Get version of metadata service", tags = "general",
          description = "Get the build version of OpenMetadata service and build timestamp.")
  public CatalogVersion getCatalogVersion() {
    return CATALOG_VERSION;
  }
}
