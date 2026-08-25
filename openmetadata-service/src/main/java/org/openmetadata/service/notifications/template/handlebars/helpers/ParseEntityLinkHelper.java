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

package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Handlebars helper that parses OpenMetadata EntityLink format and extracts components.
 *
 * <p>EntityLink format: {@code <#E::entityType::entityFQN[:field[:arrayField[:arrayValue]]]>}
 *
 * <p>Usage in templates:
 *
 * <ul>
 *   <li>{{#with (parseEntityLink entity.about) as |link|}}{{link.field}}{{/with}}
 *   <li>{{#with (parseEntityLink entity.about) as |link|}}{{link.entityType}}{{/with}}
 * </ul>
 *
 * <p>Examples:
 *
 * <ul>
 *   <li>{@code <#E::table::sample_data.db.table>} → {entityType: "table", entityFQN: "sample_data.db.table"}
 *   <li>{@code <#E::table::sample_data.db.table::description>} → {entityType: "table", entityFQN: "sample_data.db.table", field: "description"}
 *   <li>{@code <#E::table::sample_data.db.table::columns::product_id>} → {entityType: "table", entityFQN: "sample_data.db.table", field: "columns", arrayField: "product_id"}
 *   <li>{@code <#E::table::sample_data.db.table::columns::product_id::description>} → {entityType: "table", entityFQN: "sample_data.db.table", field: "columns", arrayField: "product_id", arrayValue: "description"}
 * </ul>
 */
@Slf4j
public class ParseEntityLinkHelper implements HandlebarsHelper {

  private static final String ENTITY_LINK_PREFIX = "<#E::";
  private static final String ENTITY_LINK_SEPARATOR = "::";

  @Override
  public String getName() {
    return "parseEntityLink";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return null;
          }

          String entityLinkString = context.toString().trim();
          if (entityLinkString.isEmpty()) {
            return null;
          }

          try {
            return parseEntityLink(entityLinkString);
          } catch (Exception e) {
            LOG.error("Error parsing EntityLink: {}", entityLinkString, e);
            return null;
          }
        });
  }

  /**
   * Parses an EntityLink string and returns a map with its components.
   *
   * @param entityLinkString The EntityLink string in format {@code <#E::type::fqn[:field[:arrayField[:arrayValue]]]>}
   * @return Map containing: entityType, entityFQN, field (optional), arrayField (optional), arrayValue (optional)
   */
  private Map<String, String> parseEntityLink(String entityLinkString) {
    Map<String, String> result = new HashMap<>();

    // Remove prefix and suffix
    if (!entityLinkString.startsWith(ENTITY_LINK_PREFIX) || !entityLinkString.endsWith(">")) {
      return result;
    }

    String content =
        entityLinkString
            .substring(ENTITY_LINK_PREFIX.length(), entityLinkString.length() - 1)
            .trim();

    if (content.isEmpty()) {
      return result;
    }

    // Split by separator
    String[] parts = content.split(ENTITY_LINK_SEPARATOR);

    if (parts.length < 2) {
      return result;
    }

    // Required parts
    result.put("entityType", parts[0].trim());
    result.put("entityFQN", parts[1].trim());

    // Optional field
    if (parts.length > 2 && !parts[2].trim().isEmpty()) {
      result.put("field", parts[2].trim());
    }

    // Optional arrayField
    if (parts.length > 3 && !parts[3].trim().isEmpty()) {
      result.put("arrayField", parts[3].trim());
    }

    // Optional arrayValue
    if (parts.length > 4 && !parts[4].trim().isEmpty()) {
      result.put("arrayValue", parts[4].trim());
    }

    return result;
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("parseEntityLink")
        .withDescription("Parse entity link into components")
        .withCursorOffset(18)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{parseEntityLink }}")
                    .withExample(
                        "{{#with (parseEntityLink about) as |link|}}{{link.entityType}}{{/with}}")));
  }
}
