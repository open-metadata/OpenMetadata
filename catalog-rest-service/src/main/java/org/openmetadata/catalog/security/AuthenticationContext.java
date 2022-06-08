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

import java.security.Principal;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.util.EntityUtil.Fields;

/** Holds context information of authenticated user, which will be used for authorization. */
public final class AuthenticationContext {
  @Getter private final Principal principal;
  @Getter @Setter private User user;
  @Getter @Setter private Fields userFields;

  public AuthenticationContext(Principal principal) {
    this.principal = principal;
  }

  @Override
  public String toString() {
    return "AuthenticationContext{" + ", principal=" + principal + '}';
  }
}
