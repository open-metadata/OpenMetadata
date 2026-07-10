/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIApplicationRepository;

/**
 * Bootstrap loader for Shadow AI demo fixtures. Materialises a handful of
 * AIApplication entries with populated detection metadata so the Shadow AI
 * page renders meaningful rows on a fresh install.
 *
 * <p>Each shadow-app JSON file under {@code json/data/aiGovernance/shadow/} is
 * loaded once; subsequent boots skip entities that already exist (matched by
 * name). Shadow assets are auto-detected and carry no resolved model, so the
 * legacy {@code _service.json} / {@code _model.json} placeholders are ignored.
 */
@Slf4j
final class ShadowAISeedLoader {
  private static final String SHADOW_DIR_PATTERN = ".*json/data/aiGovernance/shadow/.*\\.json$";
  private static final String SERVICE_FILE_SUFFIX = "_service.json";
  private static final String MODEL_FILE_SUFFIX = "_model.json";

  private ShadowAISeedLoader() {}

  static void loadFromResources() throws IOException {
    List<String> seedFiles = CommonUtil.getResources(Pattern.compile(SHADOW_DIR_PATTERN));
    if (seedFiles.isEmpty()) {
      return;
    }
    List<String> appFiles = new ArrayList<>();
    for (String file : seedFiles) {
      // Skip the legacy _service.json / _model.json placeholders — shadow
      // applications are auto-detected and carry no resolved model.
      if (!file.endsWith(SERVICE_FILE_SUFFIX) && !file.endsWith(MODEL_FILE_SUFFIX)) {
        appFiles.add(file);
      }
    }
    try {
      for (String appFile : appFiles) {
        try {
          seedApplication(appFile);
        } catch (Exception e) {
          LOG.warn("Shadow AI app seed {} failed: {}", appFile, e.getMessage(), e);
        }
      }
    } catch (Exception e) {
      LOG.warn("Shadow AI seed bootstrap failed: {}", e.getMessage(), e);
    }
  }

  private static void seedApplication(String seedFile) throws Exception {
    AIApplicationRepository repository =
        (AIApplicationRepository) Entity.getEntityRepository(Entity.AI_APPLICATION);
    String json =
        CommonUtil.getResourceAsStream(ShadowAISeedLoader.class.getClassLoader(), seedFile);
    AIApplication app = JsonUtils.readValue(json, AIApplication.class);
    if (AIApplicationSeedSupport.seedIfMissing(repository, app)) {
      LOG.info("Seeded shadow-AI application '{}'", app.getName());
    }
  }
}
