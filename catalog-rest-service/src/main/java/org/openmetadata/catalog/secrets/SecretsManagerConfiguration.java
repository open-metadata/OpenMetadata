package org.openmetadata.catalog.secrets;

import java.util.Map;
import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SecretsManagerConfiguration {

  public static final String DEFAULT_SECRET_MANAGER = "LocalSecretsManager";

  @NotEmpty private String secretsManager;

  private Map<String, String> parameters;
}
