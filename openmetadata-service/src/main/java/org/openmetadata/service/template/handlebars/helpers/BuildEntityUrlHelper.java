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

package org.openmetadata.service.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Helper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.openmetadata.service.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.util.email.EmailUtil;

public class BuildEntityUrlHelper implements HandlebarsHelper {
  @Override
  public String getName() {
    return "buildEntityUrl";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (Helper<Object>)
            (entityRef, options) -> {
              if (entityRef == null) {
                return null;
              }

              String type = "";
              String fullyQualifiedName = "";

              if (entityRef instanceof Map) {
                Map<?, ?> refMap = (Map<?, ?>) entityRef;
                Object typeObj = refMap.get("type");
                Object fqnObj = refMap.get("fullyQualifiedName");

                if (typeObj != null) {
                  type = typeObj.toString();
                }
                if (fqnObj != null) {
                  fullyQualifiedName = fqnObj.toString();
                }
              }

              // If we can't build a proper URL, return null
              // The template will check for null and not create a link
              if (type.isEmpty() || fullyQualifiedName.isEmpty()) {
                return null;
              }

              // Get base URL from EmailUtil
              String baseUrl = EmailUtil.getOMBaseURL();
              if (baseUrl == null || baseUrl.isEmpty()) {
                // If no base URL configured, return a relative path
                baseUrl = "";
              }

              // Encode the FQN for URL safety
              String encodedFqn =
                  URLEncoder.encode(fullyQualifiedName, StandardCharsets.UTF_8).replace("+", "%20");

              // Build the complete URL (without anchor tags - template handles that)
              return String.format("%s/%s/%s", baseUrl, type, encodedFqn);
            });
  }
}
