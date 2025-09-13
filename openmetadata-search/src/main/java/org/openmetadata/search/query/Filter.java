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

package org.openmetadata.search.query;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class Filter {
  private String field;
  private FilterType type;
  private Object value;
  private List<Object> values;
  private String operator;
  private List<Filter> nestedFilters;

  public enum FilterType {
    TERM,
    TERMS,
    RANGE,
    EXISTS,
    WILDCARD,
    FUZZY,
    BOOL,
    NESTED
  }
}
