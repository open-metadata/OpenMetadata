package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.services.connections.database.DremioConnection;
import org.openmetadata.schema.services.connections.database.dremio.CloudAuth;
import org.openmetadata.schema.services.connections.database.dremio.SoftwareAuth;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Converter class to get a `DremioConnection` object.
 */
public class DremioConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> AUTH_TYPE_CLASSES =
      List.of(CloudAuth.class, SoftwareAuth.class);

  public DremioConnectionClassConverter() {
    super(DremioConnection.class);
  }

  @Override
  public Object convert(Object object) {
    DremioConnection dremioConnection =
        (DremioConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(dremioConnection.getAuthType(), AUTH_TYPE_CLASSES)
        .ifPresent(dremioConnection::setAuthType);

    return dremioConnection;
  }
}
