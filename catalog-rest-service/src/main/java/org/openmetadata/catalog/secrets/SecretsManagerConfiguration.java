package org.openmetadata.catalog.secrets;

import java.util.Map;
import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection.SecretsManagerProvider;

@Getter
@Setter
public class SecretsManagerConfiguration {

  public static final SecretsManagerProvider DEFAULT_SECRET_MANAGER = SecretsManagerProvider.LOCAL;

  @NotEmpty private SecretsManagerProvider secretsManager;

  private Map<String, String> parameters;
}
