package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.security.credentials.BitBucketCredentials;
import org.openmetadata.schema.security.credentials.GitHubCredentials;
import org.openmetadata.schema.security.credentials.GitlabCredentials;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.utils.JsonUtils;

public class LookerConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CREDENTIALS_CLASSES =
      List.of(GitHubCredentials.class, BitBucketCredentials.class, GitlabCredentials.class);

  public LookerConnectionClassConverter() {
    super(LookerConnection.class);
  }

  @Override
  public Object convert(Object object) {
    LookerConnection lookerConnection =
        (LookerConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(lookerConnection.getGitCredentials(), CREDENTIALS_CLASSES)
        .ifPresent(lookerConnection::setGitCredentials);

    return lookerConnection;
  }
}
