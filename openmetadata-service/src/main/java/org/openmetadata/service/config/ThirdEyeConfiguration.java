/*
 *  Copyright 2025 OpenMetadata
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

package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/**
 * Configuration for ThirdEye analytics service integration.
 * 
 * This configuration allows OpenMetadata to proxy requests to the
 * ThirdEye Python service for analytics and insights.
 */
@Getter
@Setter
public class ThirdEyeConfiguration {

  @JsonProperty("enabled")
  private boolean enabled = false;

  @JsonProperty("host")
  @NotBlank(message = "ThirdEye host cannot be blank")
  private String host = "localhost";

  @JsonProperty("port")
  @NotNull(message = "ThirdEye port cannot be null")
  private int port = 8586;

  @JsonProperty("basePath")
  private String basePath = "/api/v1/thirdeye";

  @JsonProperty("timeout")
  private int timeout = 30000; // 30 seconds

  @JsonProperty("retryAttempts")
  private int retryAttempts = 3;

  @JsonProperty("retryDelay")
  private int retryDelay = 1000; // 1 second

  @JsonProperty("ssl")
  private SslConfiguration ssl = new SslConfiguration();

  /**
   * Get the full base URL for ThirdEye service
   */
  public String getBaseUrl() {
    String protocol = ssl.isEnabled() ? "https" : "http";
    return String.format("%s://%s:%d%s", protocol, host, port, basePath);
  }

  /**
   * SSL configuration for ThirdEye service
   */
  @Getter
  @Setter
  public static class SslConfiguration {
    @JsonProperty("enabled")
    private boolean enabled = false;

    @JsonProperty("verifyHostname")
    private boolean verifyHostname = true;

    @JsonProperty("trustAllCertificates")
    private boolean trustAllCertificates = false;

    @JsonProperty("keystorePath")
    private String keystorePath;

    @JsonProperty("keystorePassword")
    private String keystorePassword;

    @JsonProperty("truststorePath")
    private String truststorePath;

    @JsonProperty("truststorePassword")
    private String truststorePassword;
  }
}
