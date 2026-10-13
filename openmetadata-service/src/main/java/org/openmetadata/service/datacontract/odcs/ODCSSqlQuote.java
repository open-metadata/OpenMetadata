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

import java.util.Set;
import java.util.regex.Pattern;

/**
 * How a database's SQL quotes a name it cannot read bare. Only such names are quoted: connectors
 * may store a case-insensitive name in a folded spelling, and quoting that spelling would make it
 * case-sensitive, e.g. {@code "orders"} for a Snowflake table created as {@code ORDERS}.
 */
enum ODCSSqlQuote {
  DOUBLE_QUOTE("\"", "\""),
  BACKTICK("`", "`"),
  BRACKET("[", "]");

  /** A name in one case, the way databases fold unquoted names; mixed case means it was quoted. */
  private static final Pattern BARE_NAME = Pattern.compile("[a-z_][a-z0-9_]*|[A-Z_][A-Z0-9_]*");

  // Service types by their JSON value: the generated enum constants do not all match their values.
  private static final Set<String> BACKTICK_SERVICES =
      Set.of(
          "BigQuery",
          "Clickhouse",
          "Databricks",
          "DeltaLake",
          "Doris",
          "Hive",
          "Impala",
          "MariaDB",
          "Mysql",
          "SingleStore",
          "StarRocks",
          "UnityCatalog");
  private static final Set<String> BRACKET_SERVICES =
      Set.of("AzureSQL", "MicrosoftFabric", "Mssql", "Synapse");

  private final String open;
  private final String close;

  ODCSSqlQuote(String open, String close) {
    this.open = open;
    this.close = close;
  }

  /**
   * @param serviceType the JSON value of the table's database service type, or null
   */
  static ODCSSqlQuote forService(String serviceType) {
    String type = serviceType == null ? "" : serviceType;
    ODCSSqlQuote quote = DOUBLE_QUOTE;
    if (BACKTICK_SERVICES.contains(type)) {
      quote = BACKTICK;
    } else if (BRACKET_SERVICES.contains(type)) {
      quote = BRACKET;
    }
    return quote;
  }

  String quoteIfNeeded(String name) {
    return BARE_NAME.matcher(name).matches()
        ? name
        : open + name.replace(close, close + close) + close;
  }
}
