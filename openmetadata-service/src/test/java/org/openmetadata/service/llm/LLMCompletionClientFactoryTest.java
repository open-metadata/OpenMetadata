package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.apache.commons.text.StringSubstitutor;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.LLMAnthropicConfig;
import org.openmetadata.schema.configuration.LLMBedrockConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMProvider;

class LLMCompletionClientFactoryTest {

  @Test
  void shippedClaudeModelsMatchSchemaDefaults() throws Exception {
    LLMConfiguration config = readShippedConfig(Map.of());
    assertEquals("claude-sonnet-5-5", config.getAnthropic().getModelId());
    assertEquals(new LLMAnthropicConfig().getModelId(), config.getAnthropic().getModelId());
    assertEquals(new LLMBedrockConfig().getModelId(), config.getBedrock().getModelId());
  }

  @Test
  void shippedClaudeModelsHonorEnvironmentOverrides() throws Exception {
    LLMConfiguration config =
        readShippedConfig(
            Map.of(
                "LLM_ANTHROPIC_MODEL_ID",
                "custom-model",
                "LLM_BEDROCK_MODEL_ID",
                "custom-profile"));
    assertEquals("custom-model", config.getAnthropic().getModelId());
    assertEquals("custom-profile", config.getBedrock().getModelId());
  }

  private static LLMConfiguration readShippedConfig(Map<String, String> env) throws Exception {
    Path config = Path.of("conf", "openmetadata.yaml");
    Path file = Files.isRegularFile(config) ? config : Path.of("..").resolve(config);
    StringSubstitutor substitutor = new StringSubstitutor(env);
    substitutor.setEnableSubstitutionInVariables(true);
    YAMLMapper mapper = new YAMLMapper();
    String yaml = substitutor.replace(Files.readString(file));
    return mapper.treeToValue(
        mapper.readTree(yaml).required("llmConfiguration"), LLMConfiguration.class);
  }

  @Test
  void noopProviderYieldsNoopClient() {
    LLMConfiguration cfg = new LLMConfiguration().withProvider(LLMProvider.NOOP);
    assertInstanceOf(NoopCompletionClient.class, LLMCompletionClientFactory.create(cfg));
  }

  @Test
  void nullConfigYieldsNoopClient() {
    assertInstanceOf(NoopCompletionClient.class, LLMCompletionClientFactory.create(null));
  }

  @Test
  void nullProviderYieldsNoopClient() {
    assertInstanceOf(
        NoopCompletionClient.class, LLMCompletionClientFactory.create(new LLMConfiguration()));
  }
}
