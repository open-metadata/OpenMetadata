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

package org.openmetadata.service.secrets.converter;

import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ReflectionUtil;

/** Converter class to get an `TestServiceConnectionRequest` object. */
public class TestServiceConnectionRequestClassConverter extends ClassConverter {

  public TestServiceConnectionRequestClassConverter() {
    super(TestServiceConnectionRequest.class);
  }

  @Override
  public Object convert(Object object) {
    TestServiceConnectionRequest testServiceConnectionRequest =
        (TestServiceConnectionRequest) JsonUtils.convertValue(object, this.clazz);

    try {
      Class<?> clazz =
          ReflectionUtil.createConnectionConfigClass(
              testServiceConnectionRequest.getConnectionType(), testServiceConnectionRequest.getServiceType());
      Object newConnectionConfig =
          ClassConverterFactory.getConverter(clazz).convert(testServiceConnectionRequest.getConnection());
      testServiceConnectionRequest.setConnection(newConnectionConfig);
    } catch (Exception e) {
      throw InvalidServiceConnectionException.byMessage(
          testServiceConnectionRequest.getConnectionType(),
          String.format("Failed to convert class instance of %s", testServiceConnectionRequest.getConnectionType()));
    }

    return testServiceConnectionRequest;
  }
}
