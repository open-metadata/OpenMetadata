package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.CdnConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;

class CdnConfigurationTest {

  @Test
  void defaultsToDisabledWhenSectionIsAbsent() {
    CdnConfiguration cdn = new OpenMetadataApplicationConfig().getCdnConfiguration();

    assertFalse(cdn.getEnabled());
    assertEquals("", cdn.getBaseUrl());
  }

  @Test
  void bindsCdnSectionFromYaml() throws Exception {
    OpenMetadataApplicationConfig config =
        new ObjectMapper(new YAMLFactory())
            .configure(
                com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                false)
            .readValue(
                "cdn:\n  enabled: true\n  baseUrl: https://cdn.example.com\n",
                OpenMetadataApplicationConfig.class);

    assertTrue(config.getCdnConfiguration().getEnabled());
    assertEquals("https://cdn.example.com", config.getCdnConfiguration().getBaseUrl());
  }
}
