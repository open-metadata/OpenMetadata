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

package org.openmetadata.catalog.security;

import java.util.Set;
import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

public class AuthorizerConfiguration {
  @NotEmpty @Getter @Setter private String className;
  @NotEmpty @Getter @Setter private String containerRequestFilter;
  @NotEmpty @Getter @Setter private Set<String> adminPrincipals;
  @NotEmpty @Getter @Setter private Set<String> botPrincipals;
  @NotEmpty @Getter @Setter private String principalDomain;

  @Override
  public String toString() {
    return "AuthorizerConfiguration{"
        + "className='"
        + className
        + '\''
        + ", containerRequestFilter='"
        + containerRequestFilter
        + '\''
        + '}';
  }
}
