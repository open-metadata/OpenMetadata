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
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.util.EntityUtil.Fields;

/** Holds context information of authenticated user, which will be used for authorization. */
public final class AuthenticationContext {
  private final Principal principal;
  private User user;
  private Fields userFields;

  public AuthenticationContext(Principal principal) {
    this.principal = principal;
  }

  public Principal getPrincipal() {
    return principal;
  }

  @Override
  public String toString() {
    return "AuthenticationContext{" + ", principal=" + principal + '}';
  }

  public User getUser() {
    return user;
  }

  public void setUser(User user) {
    this.user = user;
  }

  public Fields getUserFields() {
    return userFields;
  }

  public void setUserFields(Fields userFields) {
    this.userFields = userFields;
  }
}
