package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.database.SupabaseConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Converter class to get a `SupabaseConnection` object.
 */
public class SupabaseConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> SSL_SOURCE_CLASS = List.of(ValidateSSLClientConfig.class);
  private static final List<Class<?>> CONFIG_SOURCE_CLASSES = List.of(basicAuth.class);

  public SupabaseConnectionClassConverter() {
    super(SupabaseConnection.class);
  }

  @Override
  public Object convert(Object object) {
    SupabaseConnection supabaseConnection =
        (SupabaseConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(supabaseConnection.getAuthType(), CONFIG_SOURCE_CLASSES)
        .ifPresent(supabaseConnection::setAuthType);

    tryToConvert(supabaseConnection.getSslConfig(), SSL_SOURCE_CLASS)
        .ifPresent(supabaseConnection::setSslConfig);

    return supabaseConnection;
  }
}
