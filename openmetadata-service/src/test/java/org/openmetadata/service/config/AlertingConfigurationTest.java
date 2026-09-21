package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.ConfigurationValidationException;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.logging.SwitchableAccessLayoutFactory;
import org.openmetadata.service.logging.SwitchableEventLayoutFactory;

class AlertingConfigurationTest {

  private static final String SHIPPED_CONFIG = "../conf/openmetadata.yaml";
  private static final String BUDGET_PLACEHOLDER = "${ALERTING_TICK_TIME_BUDGET_SECONDS:-60}";
  private static final Validator VALIDATOR =
      Validation.buildDefaultValidatorFactory().getValidator();

  @Test
  void defaultsAreABudgetOfOneMinuteAndEveryTargetAttempted() {
    AlertingSettings settings = AlertingSettings.from(new AlertingConfiguration());

    assertEquals(Duration.ofSeconds(60), settings.tickTimeBudget());
    assertFalse(settings.skipUnreachableTargetWithinTick());
    assertEquals(AlertingSettings.Sending.AS_BEFORE, settings.sending());
    assertTrue(VALIDATOR.validate(new AlertingConfiguration()).isEmpty());
  }

  @Test
  void budgetIsOffOrAtLeastTenSeconds() {
    assertTrue(VALIDATOR.validate(withBudget(0)).isEmpty());
    assertTrue(VALIDATOR.validate(withBudget(10)).isEmpty());
    assertFalse(VALIDATOR.validate(withBudget(9)).isEmpty());
    assertFalse(VALIDATOR.validate(withBudget(-1)).isEmpty());
    assertFalse(AlertingSettings.from(withBudget(0)).hasTimeBudget());
  }

  @Test
  void targetsSentAtOnceAreBetweenOneAndEight() {
    assertTrue(VALIDATOR.validate(withTargetsAtOnce(1)).isEmpty());
    assertTrue(VALIDATOR.validate(withTargetsAtOnce(8)).isEmpty());
    assertFalse(VALIDATOR.validate(withTargetsAtOnce(0)).isEmpty());
    assertFalse(VALIDATOR.validate(withTargetsAtOnce(9)).isEmpty());
    assertEquals(4, AlertingSettings.from(withTargetsAtOnce(4)).sending().targetSendConcurrency());
  }

  @Test
  void shippedYamlCarriesTheDefaults() throws Exception {
    assumeTrue(System.getenv("ALERTING_TICK_TIME_BUDGET_SECONDS") == null);

    AlertingConfiguration shipped = parse(BUDGET_PLACEHOLDER).getAlertingConfiguration();

    assertEquals(60, shipped.getTickTimeBudgetSeconds());
    assertFalse(shipped.isSkipUnreachableTargetWithinTick());
    assertFalse(shipped.isHonourWebhookMethod());
    assertFalse(shipped.isAwaitEmailOutcome());
    assertEquals(1, shipped.getTargetSendConcurrency());
  }

  @Test
  void budgetBelowTenSecondsStopsTheServerFromStarting() {
    assertThrows(ConfigurationValidationException.class, () -> parse("5"));
  }

  private static OpenMetadataApplicationConfig parse(String budget) throws Exception {
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    objectMapper.registerSubtypes(
        AuditExcludeFilterFactory.class,
        AuditOnlyFilterFactory.class,
        SwitchableEventLayoutFactory.class,
        SwitchableAccessLayoutFactory.class);
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, VALIDATOR, objectMapper, "dw");
    Path withThatBudget = Files.createTempFile("alerting-config-", ".yaml");
    try {
      Files.writeString(
          withThatBudget,
          Files.readString(Path.of(SHIPPED_CONFIG)).replace(BUDGET_PLACEHOLDER, budget));
      return factory.build(
          new SubstitutingSourceProvider(
              new FileConfigurationSourceProvider(),
              new EnvironmentVariableSubstitutor(false, true)),
          withThatBudget.toString());
    } finally {
      Files.deleteIfExists(withThatBudget);
    }
  }

  private static AlertingConfiguration withTargetsAtOnce(int targets) {
    AlertingConfiguration configuration = new AlertingConfiguration();
    configuration.setTargetSendConcurrency(targets);
    return configuration;
  }

  private static AlertingConfiguration withBudget(int seconds) {
    AlertingConfiguration configuration = new AlertingConfiguration();
    configuration.setTickTimeBudgetSeconds(seconds);
    return configuration;
  }
}
