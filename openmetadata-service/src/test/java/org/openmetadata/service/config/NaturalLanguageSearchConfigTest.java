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

package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import jakarta.validation.Validation;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.logging.SwitchableAccessLayoutFactory;
import org.openmetadata.service.logging.SwitchableEventLayoutFactory;
import org.openmetadata.service.search.nlq.NoOpNLQService;

/**
 * Natural language search is served by a distribution-specific endpoint that OpenMetadata does not
 * ship, so no shipped configuration may turn it on. Without this guard, re-adding an {@code enabled}
 * or {@code providerClass} line would silently put an NLQ toggle back in the UI with nothing behind
 * it.
 */
class NaturalLanguageSearchConfigTest {

  private static final List<String> CONFIG_PATHS =
      List.of(
          "../conf/openmetadata.yaml",
          "../docker/development/distributed-test/local/server1.yaml",
          "../docker/development/distributed-test/local/server2.yaml",
          "../docker/development/distributed-test/local/server3.yaml");

  @Test
  @DisplayName("No shipped configuration enables natural language search or names an NLQ provider")
  void shippedConfigsLeaveNaturalLanguageSearchDisabled() throws Exception {
    for (String path : CONFIG_PATHS) {
      NaturalLanguageSearchConfiguration nlqConfig = naturalLanguageSearchOf(path);
      if (nlqConfig != null) {
        assertNotEquals(Boolean.TRUE, nlqConfig.getEnabled(), path);
        assertEquals(NoOpNLQService.class.getName(), nlqConfig.getProviderClass(), path);
      }
    }
  }

  @Test
  @DisplayName("Semantic search stays configurable in the shipped configuration")
  void shippedConfigKeepsSemanticSearchConfigurable() throws Exception {
    NaturalLanguageSearchConfiguration nlqConfig =
        naturalLanguageSearchOf("../conf/openmetadata.yaml");

    assertNotNull(nlqConfig, "semantic search settings must survive the NLQ cleanup");
    assertNotNull(nlqConfig.getSemanticSearchEnabled());
    assertNotNull(nlqConfig.getKeywordWeight());
    assertNotNull(nlqConfig.getSemanticWeight());
    assertNotNull(nlqConfig.getKnnNumCandidatesMultiplier());
  }

  private NaturalLanguageSearchConfiguration naturalLanguageSearchOf(String path) throws Exception {
    ElasticSearchConfiguration searchConfig = parse(path).getElasticSearchConfiguration();
    return searchConfig != null ? searchConfig.getNaturalLanguageSearch() : null;
  }

  private OpenMetadataApplicationConfig parse(String path) throws Exception {
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    objectMapper.registerSubtypes(
        AuditExcludeFilterFactory.class,
        AuditOnlyFilterFactory.class,
        SwitchableEventLayoutFactory.class,
        SwitchableAccessLayoutFactory.class);
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class,
            Validation.buildDefaultValidatorFactory().getValidator(),
            objectMapper,
            "dw");
    return factory.build(
        new SubstitutingSourceProvider(
            new FileConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false, true)),
        path);
  }
}
