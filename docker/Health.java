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

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;

/**
 * Docker HEALTHCHECK probe. The runtime image has no shell and no wget, so the JVM it already
 * carries does the request. HttpURLConnection rather than java.net.http: no executor, no selector
 * thread, which keeps a probe that runs every interval as cheap as a JVM start allows.
 *
 * <p>Exits 0 only when Dropwizard's admin endpoint returns 200 and no registered check is failing.
 */
public final class Health {

  private static final int CONNECT_TIMEOUT_MS = 2_000;
  private static final int READ_TIMEOUT_MS = 3_000;

  public static void main(String[] args) {
    String port = System.getenv().getOrDefault("SERVER_ADMIN_PORT", "8586");
    System.exit(isHealthy("http://127.0.0.1:" + port + "/healthcheck") ? 0 : 1);
  }

  private static boolean isHealthy(String url) {
    HttpURLConnection connection = null;
    try {
      connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
      connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
      connection.setReadTimeout(READ_TIMEOUT_MS);
      if (connection.getResponseCode() != 200) {
        return false;
      }
      try (InputStream body = connection.getInputStream()) {
        return !new String(body.readAllBytes(), StandardCharsets.UTF_8)
            .contains("\"healthy\":false");
      }
    } catch (IOException | RuntimeException e) {
      return false;
    } finally {
      if (connection != null) {
        connection.disconnect();
      }
    }
  }
}
