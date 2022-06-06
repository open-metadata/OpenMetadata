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

package org.openmetadata.client.security.interfaces;

import feign.*;
import io.swagger.client.ApiClient;
import java.util.Map;
import org.openmetadata.client.model.OktaAccessTokenResponse;

public interface OktaAccessTokenApi extends ApiClient.Api {
  @RequestLine(
      "POST /v1/token?grant_type={grant_type}&scope={scope}&client_assertion_type={client_assertion_type}&client_assertion={client_assertion}")
  @Headers({
    "Content-Type: application/x-www-form-urlencoded",
    "Accept: application/json",
  })
  OktaAccessTokenResponse getAccessToken(
      @Param("grant_type") String grant_type,
      @Param("scope") String scope,
      @Param("client_assertion_type") String client_assertion_type,
      @Param("client_assertion") String client_assertion);

  @RequestLine(
      "POST /v1/token?grant_type={grant_type}&scope={scope}&client_assertion_type={client_assertion_type}&client_assertion={client_assertion}")
  @Headers({
    "Content-Type: application/x-www-form-urlencoded",
    "Accept: application/json",
  })
  OktaAccessTokenResponse getAccessToken(@QueryMap(encoded = true) Map<String, Object> queryParams);

  @RequestLine("POST /v1/token?grant_type={grant_type}&scope={scope}")
  @Headers({
    "Content-Type: application/x-www-form-urlencoded",
    "Accept: application/json",
  })
  OktaAccessTokenResponse getAccessToken(@Param("grant_type") String grant_type, @Param("scope") String scope);
}
