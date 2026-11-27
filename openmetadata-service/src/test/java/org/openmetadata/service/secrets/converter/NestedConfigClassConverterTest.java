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

import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.metadata.AlationConnection;
import org.openmetadata.schema.utils.JsonUtils;

class NestedConfigClassConverterTest {

  private final ClassConverter converter =
      ClassConverterFactory.getConverter(AlationConnection.class);

  @Test
  void convertsAPopulatedDatabaseConnection() {
    AlationConnection result =
        convert(new PostgresConnection().withHostPort("localhost:5432").withUsername("user"));

    assertInstanceOf(PostgresConnection.class, result.getConnection());
  }

  /**
   * Selecting "None" for the database connection submits an empty object. Jackson does not enforce
   * JSON Schema `required`, so converting it would succeed against the first candidate class and
   * return a database connection built from schema defaults.
   */
  @Test
  void leavesAnEmptyDatabaseConnectionAsItIs() {
    AlationConnection result = convert(Map.of());

    assertEquals(Map.of(), result.getConnection());
  }

  private AlationConnection convert(Object databaseConnection) {
    AlationConnection input =
        new AlationConnection()
            .withHostPort(URI.create("https://alation.example.com"))
            .withConnection(databaseConnection);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);
    return (AlationConnection) converter.convert(rawInput);
  }
}
