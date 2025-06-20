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

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import javax.ws.rs.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;

/**
 * Utility class for validating URLs to prevent SSRF attacks.
 */
@Slf4j
public class URLValidator {
  private static final List<String> ALLOWED_SCHEMES = Arrays.asList("http", "https");
  private static final Pattern PRIVATE_IP_PATTERN =
      Pattern.compile(
          "^(127\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.|192\\.168\\.|169\\.254\\.|::1|[fF][cCdD]|[fF][eE][80-9a-fA-F]:).*");

  public static void validateURL(String urlString) {
    if (urlString == null || urlString.trim().isEmpty()) {
      throw new BadRequestException("URL cannot be empty");
    }

    String host = getString(urlString);

    if (PRIVATE_IP_PATTERN.matcher(host).matches()) {
      throw new BadRequestException("URL targeting private/internal network not allowed");
    }
  }

  private static @NotNull String getString(String urlString) {
    URL url;
    try {
      URI uri = new URI(urlString);
      url = uri.toURL();
    } catch (URISyntaxException | MalformedURLException e) {
      try {
        url = new URL(urlString);
      } catch (MalformedURLException ex) {
        throw new BadRequestException("Invalid URL format: " + ex.getMessage());
      }
    }

    String protocol = url.getProtocol().toLowerCase();
    if (!ALLOWED_SCHEMES.contains(protocol)) {
      throw new BadRequestException("URL scheme not allowed: " + protocol);
    }

    return url.getHost().toLowerCase();
  }
}
