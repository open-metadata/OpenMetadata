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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import jakarta.validation.Validation;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.apache.commons.text.StringSubstitutor;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.logging.SwitchableAccessLayoutFactory;
import org.openmetadata.service.logging.SwitchableEventLayoutFactory;

/**
 * Pins the path from the shipped server configuration to the per-language mapping files: {@code
 * ELASTICSEARCH_INDEX_MAPPING_LANG} in {@code conf/openmetadata.yaml} must parse into {@link
 * IndexMappingLanguage} and resolve, through the same {@link IndexMapping#getIndexMappingFile}
 * lookup {@code IndexMappingLoader} and {@code SearchRepository} use, to a mapping file that ships
 * on the classpath for every indexed entity.
 */
class SearchIndexMappingLanguageConfigTest {

  private static final String SHIPPED_CONFIG = "../conf/openmetadata.yaml";
  private static final String LANGUAGE_ENV = "ELASTICSEARCH_INDEX_MAPPING_LANG";
  private static final String TABLE_ENTITY = "table";
  private static final String KOREAN_ANALYZER = "\"nori\"";

  @BeforeAll
  static void loadIndexMappings() throws IOException {
    IndexMappingLoader.init();
  }

  @Test
  @DisplayName("Shipped configuration defaults the mapping language to English")
  void shippedConfigDefaultsToEnglish() throws Exception {
    assertEquals(IndexMappingLanguage.EN, mappingLanguageOf(Map.of()));
  }

  @Test
  @DisplayName("ELASTICSEARCH_INDEX_MAPPING_LANG=KO selects the Korean mapping files")
  void koreanFromEnvironmentResolvesKoreanMappings() throws Exception {
    IndexMappingLanguage language = mappingLanguageOf(Map.of(LANGUAGE_ENV, "KO"));
    assertEquals(IndexMappingLanguage.KO, language);

    String languageDir = language.toString().toLowerCase(Locale.ROOT);
    List<String> missing = new ArrayList<>();
    for (Map.Entry<String, IndexMapping> entry : entityIndexMappings().entrySet()) {
      if (!resourceExists(entry.getValue().getIndexMappingFile(languageDir))) {
        missing.add(entry.getKey());
      }
    }
    assertTrue(missing.isEmpty(), "No Korean mapping file for: " + missing);

    String tableMapping =
        readResource(entityIndexMappings().get(TABLE_ENTITY).getIndexMappingFile(languageDir));
    assertTrue(tableMapping.contains(KOREAN_ANALYZER), "table mapping does not use nori");
  }

  private static IndexMappingLanguage mappingLanguageOf(Map<String, String> environment)
      throws Exception {
    return parse(environment).getElasticSearchConfiguration().getSearchIndexMappingLanguage();
  }

  private static Map<String, IndexMapping> entityIndexMappings() {
    return IndexMappingLoader.getInstance().getIndexMapping();
  }

  private static boolean resourceExists(String path) throws IOException {
    try (InputStream stream = classpathResource(path)) {
      return stream != null;
    }
  }

  private static String readResource(String path) throws IOException {
    try (InputStream stream = classpathResource(path)) {
      assertNotNull(stream, path);
      return new String(stream.readAllBytes());
    }
  }

  private static InputStream classpathResource(String path) {
    return SearchIndexMappingLanguageConfigTest.class.getClassLoader().getResourceAsStream(path);
  }

  /**
   * Parses the shipped YAML the way the server does, but resolves {@code ${VAR:-default}} against
   * the given map instead of the process environment so the test can pick the language.
   */
  private static OpenMetadataApplicationConfig parse(Map<String, String> environment)
      throws Exception {
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
            new FileConfigurationSourceProvider(), environmentSubstitutor(environment)),
        SHIPPED_CONFIG);
  }

  /** Same substitution rules as Dropwizard's {@code EnvironmentVariableSubstitutor(false, true)}. */
  private static StringSubstitutor environmentSubstitutor(Map<String, String> environment) {
    StringSubstitutor substitutor = new StringSubstitutor(environment);
    substitutor.setEnableSubstitutionInVariables(true);
    return substitutor;
  }
}
