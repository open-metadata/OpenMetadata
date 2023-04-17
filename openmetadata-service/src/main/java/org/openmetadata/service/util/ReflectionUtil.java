/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.util;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Locale;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.exception.ReflectionException;

public class ReflectionUtil {

  public static Class<?> createConnectionConfigClass(String connectionType, ServiceType serviceType)
      throws ClassNotFoundException {
    String clazzName =
        "org.openmetadata.schema.services.connections."
            + serviceType.value().toLowerCase(Locale.ROOT)
            + "."
            + connectionType
            + "Connection";
    return Class.forName(clazzName);
  }

  public static void setValueInMethod(Object toEncryptObject, String fieldValue, Method toSet) {
    try {
      toSet.invoke(toEncryptObject, fieldValue);
    } catch (IllegalAccessException | InvocationTargetException e) {
      throw new ReflectionException(e.getMessage());
    }
  }

  public static Method getToSetMethod(Object toEncryptObject, Object obj, String fieldName) {
    try {
      return toEncryptObject.getClass().getMethod("set" + fieldName, obj.getClass());
    } catch (NoSuchMethodException e) {
      throw new ReflectionException(e.getMessage());
    }
  }

  public static Object getObjectFromMethod(Method method, Object toEncryptObject) {
    Object obj;
    try {
      obj = method.invoke(toEncryptObject);
    } catch (IllegalAccessException | InvocationTargetException e) {
      throw new ReflectionException(e.getMessage());
    }
    return obj;
  }

  public static boolean isGetMethodOfObject(Method method) {
    return method.getName().startsWith("get")
        && !method.getReturnType().equals(Void.TYPE)
        && !method.getReturnType().isPrimitive();
  }
}
