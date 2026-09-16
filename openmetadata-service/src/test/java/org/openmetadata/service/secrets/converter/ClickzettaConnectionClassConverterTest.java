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

package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.services.connections.database.ClickzettaConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.utils.JsonUtils;

class ClickzettaConnectionClassConverterTest {

  private final ClassConverter converter =
      ClassConverterFactory.getConverter(ClickzettaConnection.class);

  @Test
  void testConvertsBasicAuth() {
    basicAuth auth = new basicAuth().withPassword("fixture-password");
    ClickzettaConnection input =
        new ClickzettaConnection()
            .withHostPort("instance.example.clickzetta.test")
            .withUsername("fixture-reader")
            .withAuthType(auth)
            .withDatabaseName("fixture-workspace")
            .withVirtualCluster("fixture-cluster");
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    ClickzettaConnection result = (ClickzettaConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(basicAuth.class, result.getAuthType());
    assertEquals("fixture-password", ((basicAuth) result.getAuthType()).getPassword());
  }
}
