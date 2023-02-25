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

package org.openmetadata.client.model;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

public class OktaSSOConfig {
  /** Okta Client ID for the service application. (Required) */
  @Getter @Setter private String clientId;
  /** Okta Client Secret for the API service application. (Required) */
  @Getter @Setter private String clientSecret;
  /** Okta Authorization Server Url. (Required) */
  @Getter private String authorizationServerURL;

  /** Okta client scopes. */
  @Getter @Setter private List<String> scopes = new ArrayList<>();

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append(OktaSSOConfig.class.getName())
        .append('@')
        .append(Integer.toHexString(System.identityHashCode(this)))
        .append('[');
    sb.append("clientId");
    sb.append('=');
    sb.append(((this.clientId == null) ? "<null>" : this.clientId));
    sb.append("clientSecret");
    sb.append('=');
    sb.append(((this.clientSecret == null) ? "<null>" : this.clientSecret));
    sb.append(',');
    sb.append("authorizationServerURL");
    sb.append('=');
    sb.append(((this.authorizationServerURL == null) ? "<null>" : this.authorizationServerURL));
    sb.append(',');
    sb.append(',');
    sb.append("scopes");
    sb.append('=');
    sb.append(((this.scopes == null) ? "<null>" : this.scopes));
    sb.append(',');
    if (sb.charAt((sb.length() - 1)) == ',') {
      sb.setCharAt((sb.length() - 1), ']');
    } else {
      sb.append(']');
    }
    return sb.toString();
  }
}
