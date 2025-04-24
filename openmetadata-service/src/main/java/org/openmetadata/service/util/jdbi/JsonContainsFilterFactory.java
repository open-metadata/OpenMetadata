package org.openmetadata.service.util.jdbi;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizerFactory;
import org.jdbi.v3.sqlobject.customizer.SqlStatementParameterCustomizer;

public class JsonContainsFilterFactory implements SqlStatementCustomizerFactory {
  @Override
  public SqlStatementParameterCustomizer createForParameter(
      Annotation annotation,
      Class<?> sqlObjectType,
      Method method,
      Parameter param,
      int index,
      Type type) {
    BindJsonContains jsonFilter = (BindJsonContains) annotation;
    String name = jsonFilter.value();
    if (name.equals(Bind.NO_VALUE)) {
      throw new IllegalArgumentException("No value provided for BindJsonContains annotation");
    }

    return (stmt, arg) -> {
      // Apply JSON filtering logic
      if (arg == null) {
        stmt.define(name, jsonFilter.ifNull());
        return;
      } else if (stmt.getContext()
          .getConnection()
          .getMetaData()
          .getDatabaseProductName()
          .contains("MySQL")) {
        stmt.define(
            name,
            "JSON_CONTAINS(JSON_EXTRACT(json, '"
                + jsonFilter.path()
                + "[*]."
                + jsonFilter.property()
                + "'), JSON_QUOTE(:value))");
      } else if (stmt.getContext()
          .getConnection()
          .getMetaData()
          .getDatabaseProductName()
          .contains("PostgreSQL")) {
        stmt.define(
            name,
            "jsonb_path_exists(json::jsonb, '"
                + jsonFilter.path()
                + "[*] ? (@."
                + jsonFilter.property()
                + " == $jsonPathValue)', jsonb_build_object('jsonPathValue', :value))");
      } else {
        throw new UnsupportedOperationException(
            "Unsupported database: "
                + stmt.getContext().getConnection().getMetaData().getDatabaseProductName());
      }
      stmt.bind("value", arg.toString());
    };
  }
}
