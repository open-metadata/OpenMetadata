/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.it.util;

import java.util.List;

/**
 * Search terms that a user can realistically paste into a search box and that Lucene's query_string
 * parser rejects unless they are escaped. Issue #31077: every one of these returned a 500
 * query_shard_exception from the data quality search endpoints.
 */
public final class LuceneReservedQueries {

  public static final List<String> WILDCARD_WRAPPED =
      List.of(
          "*https://localhost:8585/table/orders*",
          "*orders (v2)*",
          "*orders [archived]*",
          "*dimension:value*",
          "*orders && customers*",
          "*\"unterminated phrase*",
          "*boosted^2*",
          "*fuzzy~*",
          "*trailing backslash\\*");

  private LuceneReservedQueries() {}
}
