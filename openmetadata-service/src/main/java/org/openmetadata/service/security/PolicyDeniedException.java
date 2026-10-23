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

package org.openmetadata.service.security;

/**
 * A {@code Deny} rule refused the operation, as opposed to no rule allowing it. The distinction
 * matters where several checks are tried and any one passing is enough: a resource the caller is
 * merely not allowed to reach may be reachable another way, but one an explicit Deny names must not
 * be, so a Deny on any of the tried resources refuses the whole request.
 */
public class PolicyDeniedException extends AuthorizationException {
  public PolicyDeniedException(String msg) {
    super(msg);
  }
}
