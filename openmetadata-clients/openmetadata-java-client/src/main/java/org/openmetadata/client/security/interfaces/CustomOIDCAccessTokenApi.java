package org.openmetadata.client.security.interfaces;

import feign.Headers;
import feign.RequestLine;
import io.swagger.client.ApiClient;
import org.openmetadata.client.model.AccessTokenResponse;

public interface CustomOIDCAccessTokenApi extends ApiClient.Api {

  @RequestLine("POST ")
  @Headers({
    "Content-Type: application/x-www-form-urlencoded",
    "Accept: application/json",
  })
  AccessTokenResponse getAccessToken();
}
