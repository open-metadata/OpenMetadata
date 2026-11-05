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

package org.openmetadata.service.util;

import jakarta.ws.rs.client.ClientRequestContext;
import jakarta.ws.rs.client.ClientRequestFilter;

/**
 * Applies the outbound URL policy at the point a request is about to leave, so every caller of the
 * client this filter is registered on is covered whether or not it remembered to validate.
 */
public class OutboundUrlPolicyFilter implements ClientRequestFilter {
  @Override
  public void filter(ClientRequestContext requestContext) {
    OutboundUrlPolicy.getInstance().checkForConnect(requestContext.getUri());
  }
}
