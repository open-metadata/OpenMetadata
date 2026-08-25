package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.services.connections.pipeline.PrefectConnection;
import org.openmetadata.schema.services.connections.pipeline.prefect.CloudAuth;
import org.openmetadata.schema.services.connections.pipeline.prefect.ServerAuth;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Converter class to get a `PrefectConnection` object.
 */
public class PrefectConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> AUTH_TYPE_CLASSES =
      List.of(CloudAuth.class, ServerAuth.class);

  public PrefectConnectionClassConverter() {
    super(PrefectConnection.class);
  }

  @Override
  public Object convert(Object object) {
    PrefectConnection prefectConnection =
        (PrefectConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(prefectConnection.getAuthType(), AUTH_TYPE_CLASSES)
        .ifPresent(prefectConnection::setAuthType);

    return prefectConnection;
  }
}
