package org.openmetadata.service.secrets.converter;

import java.util.Map;
import javax.validation.ValidationException;
import org.openmetadata.schema.entity.app.ConfigFormParameter;
import org.openmetadata.schema.type.app.configuration.IntParameter;
import org.openmetadata.schema.type.app.configuration.StringParameter;

public class AppConfigSchemaConverter extends ClassConverter {
  private static final Map<String, Class<?>> PARAMETER_CLASSES =
      Map.of(
          StringParameter.Type.STRING.toString(), StringParameter.class,
          IntParameter.Type.INTEGER.toString(), IntParameter.class);

  public AppConfigSchemaConverter() {
    super(ConfigFormParameter.class);
  }

  public Object convertByType(Map<String, Object> map) {
    if (!map.containsKey("type")) {
      throw new ValidationException("type is required");
    }
    Class<?> clazz = PARAMETER_CLASSES.get(map.get("type"));
    return ClassConverterFactory.getConverter(clazz).convert(map);
  }
}
