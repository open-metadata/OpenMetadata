package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.services.connections.security.RangerConnection;
import org.openmetadata.schema.services.connections.storage.S3Connection;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `RangerConnection` object. */
public class RangerConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONFIG_SOURCE_CLASSES =
      List.of(S3Connection.class, String.class);

  public RangerConnectionClassConverter() {
    super(RangerConnection.class);
  }

  @Override
  public Object convert(Object object) {
    RangerConnection rangerConnection =
        (RangerConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(rangerConnection.getAuthType(), CONFIG_SOURCE_CLASSES)
        .ifPresent(rangerConnection::setAuthType);

    return rangerConnection;
  }
}
