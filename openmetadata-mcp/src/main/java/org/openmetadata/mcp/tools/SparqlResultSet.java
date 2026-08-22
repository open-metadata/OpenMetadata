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

package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.utils.JsonUtils;

record SparqlResultSet<T>(Bindings<T> results) {

  static <T> List<T> rows(String json, TypeReference<SparqlResultSet<T>> resultType) {
    return nullOrEmpty(json) ? List.of() : bindings(JsonUtils.readValue(json, resultType));
  }

  private static <T> List<T> bindings(SparqlResultSet<T> resultSet) {
    return Optional.ofNullable(resultSet)
        .map(SparqlResultSet::results)
        .map(Bindings::bindings)
        .map(SparqlResultSet::immutableList)
        .orElseGet(List::of);
  }

  private static <T> List<T> immutableList(List<T> values) {
    return List.copyOf(listOrEmpty(values));
  }

  record Bindings<T>(List<T> bindings) {}

  record Value(String value) {}
}
