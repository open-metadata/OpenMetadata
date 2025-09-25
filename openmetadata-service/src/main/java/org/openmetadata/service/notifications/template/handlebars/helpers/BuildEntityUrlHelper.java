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
import java.util.Map;
import java.util.Optional;
import okhttp3.HttpUrl;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.util.email.EmailUtil;

public class BuildEntityUrlHelper implements HandlebarsHelper {

  private static final String KEY_TYPE = "type";
  private static final String KEY_FQN = "fullyQualifiedName";

  @Override
  public String getName() {
    return "buildEntityUrl";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (entityRef, options) -> {
          if (!(entityRef instanceof Map)) {
            return null;
          }

          @SuppressWarnings("unchecked")
          Map<String, Object> refMap = (Map<String, Object>) entityRef;

          Optional<String> typeOpt =
              Optional.ofNullable(refMap.get(KEY_TYPE))
                  .map(Object::toString)
                  .map(String::trim)
                  .filter(s -> !s.isEmpty());

          Optional<String> fqnOpt =
              Optional.ofNullable(refMap.get(KEY_FQN))
                  .map(Object::toString)
                  .map(String::trim)
                  .filter(s -> !s.isEmpty());

          if (typeOpt.isEmpty() || fqnOpt.isEmpty()) {
            return null;
          }

          String baseUrl = EmailUtil.getOMBaseURL();
          if (baseUrl == null || baseUrl.isBlank()) {
            return null;
          }

          HttpUrl base = HttpUrl.parse(baseUrl);
          if (base == null) {
            return null;
          }

          return base.newBuilder()
              .addPathSegment(typeOpt.get())
              .addPathSegment(fqnOpt.get())
              .build()
              .toString();
        });
  }
}
