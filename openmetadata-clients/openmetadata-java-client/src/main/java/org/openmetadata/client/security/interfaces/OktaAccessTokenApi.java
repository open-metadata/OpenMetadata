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

import feign.Headers;
import feign.Param;
import feign.QueryMap;
import feign.RequestLine;
import java.util.Map;
import org.openmetadata.client.ApiClient;
import org.openmetadata.client.model.AccessTokenResponse;

public interface OktaAccessTokenApi extends ApiClient.Api {
  @RequestLine(
      "POST /v1/token?grant_type={grant_type}&scope={scope}&client_assertion_type={client_assertion_type}&client_assertion={client_assertion}")
  @Headers({
    "Content-Type: application/x-www-form-urlencoded",
    "Accept: application/json",
  })
  AccessTokenResponse getAccessToken(
      @Param("grant_type") String grantType,
      @Param("scope") String scope,
      @Param("client_assertion_type") String clientAssertionType,
      @Param("client_assertion") String clientAssertion);

  @RequestLine(
      "POST /v1/token?grant_type={grant_type}&scope={scope}&client_assertion_type={client_assertion_type}&client_assertion={client_assertion}")
  @Headers({
    "Content-Type: application/x-www-form-urlencoded",
    "Accept: application/json",
  })
  AccessTokenResponse getAccessToken(@QueryMap(encoded = true) Map<String, Object> queryParams);

  @RequestLine("POST /v1/token?grant_type={grant_type}&scope={scope}")
  @Headers({
    "Content-Type: application/x-www-form-urlencoded",
    "Accept: application/json",
  })
  AccessTokenResponse getAccessToken(@Param("grant_type") String grantType, @Param("scope") String scope);
}
