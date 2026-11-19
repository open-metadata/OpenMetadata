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
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.services.connections.database.databricks.PersonalAccessToken;
import org.openmetadata.schema.services.connections.pipeline.DatabricksPipelineConnection;

class UnmatchedOptionsTest {

  private static final Map<String, Object> UNMATCHED_AUTH =
      Map.of("token", "databricks-token", "region", "eu");

  @Test
  void keepsAValueThatMatchesNoOptionWithoutAHandler() {
    assertEquals(UNMATCHED_AUTH, convert(UNMATCHED_AUTH).getAuthType());
  }

  @Test
  void refusesAValueThatMatchesNoOptionNamingThePropertyAndTheUndeclaredKeys() {
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                UnmatchedOptions.during(UnmatchedOptions.refuse(), () -> convert(UNMATCHED_AUTH)));

    assertEquals(
        "The value of [authType] matches none of its options [PersonalAccessToken,"
            + " DatabricksOAuth, AzureADSetup]: no option declares [region].",
        e.getMessage());
  }

  @Test
  void typesAValueThatMatchesAnOptionWhileRefusing() {
    DatabricksPipelineConnection connection =
        UnmatchedOptions.during(
            UnmatchedOptions.refuse(), () -> convert(Map.of("token", "databricks-token")));

    assertInstanceOf(PersonalAccessToken.class, connection.getAuthType());
  }

  @Test
  void replacesEveryLeafOfAValueThatMatchesNoOption() {
    Map<String, Object> nested =
        Map.of("token", "databricks-token", "extra", Map.of("scopes", List.of("all", 3)));

    DatabricksPipelineConnection connection =
        UnmatchedOptions.during(UnmatchedOptions.replaceLeaves(leaf -> "x"), () -> convert(nested));

    assertEquals(
        Map.of("token", "x", "extra", Map.of("scopes", List.of("x", "x"))),
        connection.getAuthType());
  }

  @Test
  void keepsAValueWhoseOptionsHoldNoSecret() {
    Map<String, Object> value = Map.of("unknown", "value");
    ClassConverter converter =
        new ClassConverter(Object.class) {
          @Override
          public Object convert(Object object) {
            return tryToConvert(object, List.of(FilterPattern.class)).orElseThrow();
          }
        };

    assertEquals(
        value, UnmatchedOptions.during(UnmatchedOptions.refuse(), () -> converter.convert(value)));
  }

  private static DatabricksPipelineConnection convert(Map<String, Object> authType) {
    return (DatabricksPipelineConnection)
        ClassConverterFactory.getConverter(DatabricksPipelineConnection.class)
            .convert(Map.of("hostPort", "databricks.example:443", "authType", authType));
  }
}
