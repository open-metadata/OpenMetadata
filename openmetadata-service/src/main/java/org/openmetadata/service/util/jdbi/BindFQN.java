package org.openmetadata.service.util.jdbi;

import java.lang.annotation.Annotation;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizerFactory;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizingAnnotation;
import org.jdbi.v3.sqlobject.customizer.SqlStatementParameterCustomizer;
import org.openmetadata.service.util.FullyQualifiedName;

/** Convert fqn string to fqnHash */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.PARAMETER})
@SqlStatementCustomizingAnnotation(BindFQN.Factory.class)
public @interface BindFQN {
  String value();

  class Factory implements SqlStatementCustomizerFactory {
    @Override
    public SqlStatementParameterCustomizer createForParameter(
        Annotation annotation,
        Class<?> sqlObjectType,
        Method method,
        Parameter param,
        int index,
        Type type) {
      BindFQN bind = (BindFQN) annotation;
      return (stmt, arg) -> {
        String fqn = (String) arg;
        stmt.bind(bind.value(), FullyQualifiedName.buildHash(fqn));
      };
    }
  }
}
