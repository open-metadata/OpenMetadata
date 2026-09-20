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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Every rejected string below was confirmed against a live OpenSearch node to fail with {@code
 * query_shard_exception / parse_exception}, and every accepted one to parse — so these cases record
 * Lucene's real behaviour rather than an assumption about it. Issue #27990.
 */
class LuceneQuerySyntaxTest {

  @ParameterizedTest
  @ValueSource(
      strings = {
        ":foo*",
        ":foo AND bar",
        ":*",
        "::foo*",
        "a:b:c*",
        "(unclosed",
        "foo)",
        "\"unclosed",
        "foo AND",
        "AND foo",
        "foo OR",
        "NOT",
        "foo^",
        "foo^^",
        "foo~~",
        "name:(foo",
        "name:\"unterminated",
        "^2",
        "~",
        "+",
        "-",
        "revenue (draft",
        "\"quoted phrase",
        "sales (2024"
      })
  @DisplayName("text Lucene cannot parse is not routed to query_string")
  void rejectsUnparseableText(String query) {
    assertFalse(LuceneQuerySyntax.isWellFormed(query), query);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "revenue (draft)",
        "sales (2024)",
        "\"quoted phrase\"",
        "name:orders",
        "name:orders AND service:snowflake",
        "orders OR customers",
        "NOT orders",
        "foo^2",
        "foo~",
        "foo~1",
        "foo~^2",
        "foo~0.8",
        "foo^2.5",
        "orders\\ AND",
        "orders\\^",
        "\"a:b:c\"",
        "name:\"foo bar\"",
        "\"time 10:30:00\"",
        "-orders",
        "+orders",
        "name:(foo OR bar)",
        "a (b) c",
        "report [final]",
        "dim_customer (deprecated)",
        "C++ parser",
        "50% margin",
        "order-items",
        "3:1 ratio",
        "/regex/",
        "a/b/c",
        "2024/01/02",
        "foo\\/bar",
        "\\(escaped",
        "*",
        "**"
      })
  @DisplayName("valid Lucene keeps its Lucene meaning")
  void acceptsParseableText(String query) {
    assertTrue(LuceneQuerySyntax.isWellFormed(query), query);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "   "})
  @DisplayName("blank text is left to the caller's empty-query handling")
  void acceptsBlankText(String query) {
    assertTrue(LuceneQuerySyntax.isWellFormed(query), query);
  }

  @org.junit.jupiter.api.Test
  @DisplayName("null is not a parse failure")
  void acceptsNull() {
    assertTrue(LuceneQuerySyntax.isWellFormed(null));
  }
}
