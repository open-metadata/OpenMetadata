package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.services.connections.database.MssqlConnection;
import org.openmetadata.schema.services.connections.pipeline.WherescapeConnection;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `SupersetConnection` object. */
public class WherescapeConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONNECTION_CLASSES = List.of(MssqlConnection.class);

  public WherescapeConnectionClassConverter() {
    super(WherescapeConnection.class);
  }

  @Override
  public Object convert(Object object) {
    WherescapeConnection wherescapeConnection =
        (WherescapeConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(wherescapeConnection.getDatabaseConnection(), CONNECTION_CLASSES)
        .ifPresent(wherescapeConnection::setDatabaseConnection);

    return wherescapeConnection;
  }
}
