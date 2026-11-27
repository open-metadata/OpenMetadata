package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.LLMBedrockConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMProvider;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.service.llm.LLMClientHolder;

class SystemRepositoryLlmProviderValidationTest {

  @AfterEach
  void resetLlmClient() {
    LLMClientHolder.initialize(null);
  }

  @Test
  void builtClientPassesWithProviderModelAndExtractionState() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withEnabled(true)
            .withMemoryExtractionEnabled(true)
            .withProvider(LLMProvider.NOOP);
    LLMClientHolder.initialize(config);

    StepValidation validation = SystemRepository.getLlmProviderValidation(config);

    assertTrue(validation.getPassed());
    assertEquals("Provider: noop, model: noop. Memory extraction: on", validation.getMessage());
  }

  @Test
  void unbuildableClientFailsWithTheProviderReason() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withEnabled(true)
            .withProvider(LLMProvider.BEDROCK)
            .withBedrock(new LLMBedrockConfig().withAwsConfig(new AWSBaseConfig().withRegion("")));
    LLMClientHolder.initialize(config);

    StepValidation validation = SystemRepository.getLlmProviderValidation(config);

    assertFalse(validation.getPassed());
    assertEquals(
        "LLM is enabled but the bedrock client could not be built: "
            + "AWS region is required for Bedrock completion",
        validation.getMessage());
  }
}
