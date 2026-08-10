/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

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
import org.openmetadata.service.util.JsonStorageUtils;

/**
 * Binds serialized JSON after removing characters unsupported by database JSON storage. Use only
 * for parameters persisted as JSON.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.PARAMETER)
@SqlStatementCustomizingAnnotation(BindJson.Factory.class)
public @interface BindJson {
  String value();

  class Factory implements SqlStatementCustomizerFactory {
    @Override
    public SqlStatementParameterCustomizer createForParameter(
        Annotation annotation,
        Class<?> sqlObjectType,
        Method method,
        Parameter parameter,
        int index,
        Type type) {
      BindJson bind = (BindJson) annotation;
      return (statement, argument) ->
          statement.bind(bind.value(), JsonStorageUtils.sanitizeNulCharacters((String) argument));
    }
  }
}
