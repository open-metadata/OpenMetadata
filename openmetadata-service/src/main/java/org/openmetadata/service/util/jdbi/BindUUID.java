package org.openmetadata.service.util.jdbi;

import java.lang.annotation.Annotation;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import java.util.UUID;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizerFactory;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizingAnnotation;
import org.jdbi.v3.sqlobject.customizer.SqlStatementParameterCustomizer;

/** Convert fqn string to fqnHash */
@Retention(RetentionPolicy.RUNTIME)
@Target({ ElementType.PARAMETER })
@SqlStatementCustomizingAnnotation(BindUUID.Factory.class)
public @interface BindUUID {
  String value();

  class Factory implements SqlStatementCustomizerFactory {

    @Override
    public SqlStatementParameterCustomizer createForParameter(
      Annotation annotation,
      Class<?> sqlObjectType,
      Method method,
      Parameter param,
      int index,
      Type type
    ) {
      BindUUID bind = (BindUUID) annotation;
      return (stmt, arg) -> {
        UUID id = (UUID) arg;
        stmt.bind(bind.value(), id.toString());
      };
    }
  }
}
