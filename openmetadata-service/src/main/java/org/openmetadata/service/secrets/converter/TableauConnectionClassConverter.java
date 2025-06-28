package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.security.credentials.AccessTokenAuth;
import org.openmetadata.schema.security.credentials.BasicAuth;
import org.openmetadata.schema.services.connections.dashboard.TableauConnection;
import org.openmetadata.schema.utils.JsonUtils;

public class TableauConnectionClassConverter extends ClassConverter {
  private static final List<Class<?>> CONNECTION_CLASSES =
      List.of(BasicAuth.class, AccessTokenAuth.class);

  public TableauConnectionClassConverter() {
    super(TableauConnection.class);
  }

  @Override
  public Object convert(Object object) {
    TableauConnection tableauConnection =
        (TableauConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(tableauConnection.getAuthType(), CONNECTION_CLASSES)
        .ifPresent(tableauConnection::setAuthType);

    return tableauConnection;
  }
}
