/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

/**
 * Settings for serving the UI's static assets from a CDN. OpenMetadata itself never reads these;
 * they exist so downstream distributions can bind a {@code cdn:} section in their own {@code
 * openmetadata.yaml} (e.g. through an {@code OpenMetadataAssetServlet} subclass). Disabled by
 * default and intentionally absent from the shipped {@code conf/openmetadata.yaml}.
 */
@Getter
@Setter
public class CdnConfiguration {

  @JsonProperty private boolean enabled = false;

  @JsonProperty private String baseUrl = "";
}
