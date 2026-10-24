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

package org.openmetadata.service.alerting.channel.webhook;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;

/**
 * Where a webhook configuration keeps what must not be read back or stored in the clear: the
 * endpoint, which an incoming-webhook URL makes a credential of its own, every custom header value,
 * and the bearer and OAuth2 credentials.
 */
public final class WebhookSecrets {
  private static final JsonPointer ENDPOINT = JsonPointer.compile("/endpoint");
  private static final JsonPointer HEADERS = JsonPointer.compile("/headers");
  private static final List<JsonPointer> AUTHENTICATION =
      List.of(
          JsonPointer.compile("/authType/secretKey"),
          JsonPointer.compile("/authType/clientId"),
          JsonPointer.compile("/authType/clientSecret"));

  private WebhookSecrets() {}

  /** The locations, in this configuration, of the secrets it carries a text value for. */
  public static List<JsonPointer> fieldsIn(JsonNode config) {
    List<JsonPointer> fields = new ArrayList<>();
    if (config != null && config.isObject()) {
      addIfText(fields, config, ENDPOINT);
      config
          .path(HEADERS.last().getMatchingProperty())
          .properties()
          .forEach(header -> addIfText(fields, config, HEADERS.appendProperty(header.getKey())));
      AUTHENTICATION.forEach(pointer -> addIfText(fields, config, pointer));
    }
    return List.copyOf(fields);
  }

  private static void addIfText(List<JsonPointer> fields, JsonNode config, JsonPointer pointer) {
    if (config.at(pointer).isTextual()) {
      fields.add(pointer);
    }
  }
}
