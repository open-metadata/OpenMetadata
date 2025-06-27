package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.services.connections.pipeline.SSISConnection;
import org.openmetadata.schema.services.connections.storage.S3Connection;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `SsisConnection` object. */
public class SsisConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONFIG_SOURCE_CLASSES =
      List.of(S3Connection.class, String.class);

  public SsisConnectionClassConverter() {
    super(SSISConnection.class);
  }

  @Override
  public Object convert(Object object) {
    SSISConnection ssisConnection = (SSISConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(ssisConnection.getPackageConnection(), CONFIG_SOURCE_CLASSES)
        .ifPresent(ssisConnection::setPackageConnection);

    return ssisConnection;
  }
}
