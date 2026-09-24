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

package org.openmetadata.service.datacontract.odcs;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.FullyQualifiedName;

/** The table an ODCS contract is imported into, as far as quality rules need to know it. */
public record ODCSTableTarget(String fullyQualifiedName, List<String> columnNames) {

  public ODCSTableTarget {
    columnNames = List.copyOf(columnNames);
  }

  public static ODCSTableTarget of(Table table) {
    return new ODCSTableTarget(
        table.getFullyQualifiedName(),
        listOrEmpty(table.getColumns()).stream().map(Column::getName).toList());
  }

  /**
   * How a query running on the table's own service refers to it: the FQN without the service
   * segment, e.g. {@code SALES.PUBLIC.orders} for {@code snowflake.SALES.PUBLIC.orders}.
   */
  public String sqlName() {
    String[] parts = FullyQualifiedName.split(fullyQualifiedName);
    int firstPart = parts.length > 1 ? 1 : 0;
    return Arrays.stream(parts, firstPart, parts.length)
        .map(FullyQualifiedName::unquoteName)
        .collect(Collectors.joining("."));
  }

  /** The table's own spelling of a column, matched case-insensitively. */
  public Optional<String> resolveColumn(String candidate) {
    return nullOrEmpty(candidate)
        ? Optional.empty()
        : columnNames.stream().filter(column -> column.equalsIgnoreCase(candidate)).findFirst();
  }

  public String columnFqn(String column) {
    return FullyQualifiedName.add(fullyQualifiedName, column);
  }

  /** The FQN of the column named either by its FQN or by its own name, if the table has it. */
  public Optional<String> resolveColumnFqn(String nameOrFqn) {
    String columnPrefix = fullyQualifiedName + Entity.SEPARATOR;
    String candidate =
        nameOrFqn != null && nameOrFqn.startsWith(columnPrefix)
            ? FullyQualifiedName.unquoteName(nameOrFqn.substring(columnPrefix.length()))
            : nameOrFqn;
    return resolveColumn(candidate).map(this::columnFqn);
  }

  public String tableLink() {
    return new EntityLink(Entity.TABLE, fullyQualifiedName).getLinkString();
  }

  public String columnLink(String column) {
    return new EntityLink(Entity.TABLE, fullyQualifiedName, Entity.FIELD_COLUMNS, column, null)
        .getLinkString();
  }
}
