package org.openmetadata.client.security.interfaces;

import feign.Headers;
import feign.RequestLine;
import org.openmetadata.client.ApiClient;
import org.openmetadata.client.model.AccessTokenResponse;

public interface Auth0AccessTokenApi extends ApiClient.Api {

  @RequestLine("POST /oauth/token")
  @Headers({
    "Content-Type: application/x-www-form-urlencoded",
    "Accept: application/json",
  })
  AccessTokenResponse getAccessToken();
}
