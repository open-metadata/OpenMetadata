package org.openmetadata.service.util.jdbi;

import java.lang.annotation.*;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import java.util.List;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizerFactory;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizingAnnotation;
import org.jdbi.v3.sqlobject.customizer.SqlStatementParameterCustomizer;
import org.openmetadata.service.util.FullyQualifiedName;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.PARAMETER})
@SqlStatementCustomizingAnnotation(BindListFQN.Factory.class)
public @interface BindListFQN {
  String value();

  class Factory implements SqlStatementCustomizerFactory {
    @Override
    public SqlStatementParameterCustomizer createForParameter(
        Annotation annotation,
        Class<?> sqlObjectType,
        Method method,
        Parameter param,
        int index,
        Type paramType) {

      BindListFQN bind = (BindListFQN) annotation;
      return (stmt, arg) -> {
        @SuppressWarnings("unchecked")
        List<String> fqns = (List<String>) arg;
        List<String> fqnHashes = fqns.stream().map(FullyQualifiedName::buildHash).toList();
        stmt.bindList(bind.value(), fqnHashes);
      };
    }
  }
}
