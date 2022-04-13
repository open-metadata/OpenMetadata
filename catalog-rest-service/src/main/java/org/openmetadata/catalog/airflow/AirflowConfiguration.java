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

package org.openmetadata.catalog.airflow;

import java.util.Map;
import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

public class AirflowConfiguration {

  @NotEmpty @Getter @Setter private String apiEndpoint;

  @NotEmpty @Getter @Setter private String username;

  @NotEmpty @Getter @Setter private String password;

  @Getter @Setter private Integer timeout = 30;

  @NotEmpty @Getter @Setter private String metadataApiEndpoint;

  @NotEmpty @Getter @Setter private String authProvider;

  @Getter private Map<String, String> authConfig;

  public void setAuthConfig(Map<String, String> authConfig) {
    this.authConfig = authConfig;
  }
}
