package org.openmetadata;

import com.cronutils.utils.StringUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import jakarta.validation.Validator;
import lombok.Getter;
import lombok.Setter;
import lombok.SneakyThrows;
import okhttp3.HttpUrl;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.security.OpsConfig;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.operations.OperationalConfiguration;

@Getter
@Setter
public class DefaultOperationalConfigProvider {
  private SmtpSettings emailSettings;
  private OpenMetadataBaseUrlConfiguration serverUrl;

  public DefaultOperationalConfigProvider(OpsConfig opsConfig) {
    if (Boolean.TRUE.equals(opsConfig.getEnable())) {
      parseOperationsConfig(opsConfig.getOperationsConfigFile());
    } else {
      this.emailSettings = getDefaultSmtpSettings();
      this.serverUrl = getDefaultServerUrl();
    }
  }

  private static SmtpSettings getDefaultSmtpSettings() {
    return new SmtpSettings()
        .withPassword(StringUtils.EMPTY)
        .withEmailingEntity("OpenMetadata")
        .withSupportUrl("https://slack.open-metadata.org")
        .withEnableSmtpServer(Boolean.FALSE)
        .withTransportationStrategy(SmtpSettings.TransportationStrategy.SMTP_TLS)
        .withTemplates(SmtpSettings.Templates.OPENMETADATA);
  }

  private static OpenMetadataBaseUrlConfiguration getDefaultServerUrl() {
    String url =
        new HttpUrl.Builder().scheme("http").host("localhost").port(8585).build().toString();
    String baseUrl = url.substring(0, url.length() - 1);
    return new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl(baseUrl);
  }

  private void parseOperationsConfig(String filePath) {
    // parse limits config file
    OperationalConfiguration configuration = readOperationsConfig(filePath);
    this.emailSettings = configuration.getEmail();
    this.serverUrl = configuration.getServerUrl();
  }

  @SneakyThrows
  public static OperationalConfiguration readOperationsConfig(String configFilePath) {
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    Validator validator = Validators.newValidator();
    YamlConfigurationFactory<OperationalConfiguration> factory =
        new YamlConfigurationFactory<>(
            OperationalConfiguration.class, validator, objectMapper, "dw");
    return factory.build(
        new SubstitutingSourceProvider(
            new FileConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)),
        configFilePath);
  }
}
