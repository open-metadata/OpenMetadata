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

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class Sort {
  private String field;
  private SortOrder order;
  private String missing;

  public enum SortOrder {
    ASC,
    DESC
  }

  public static Sort ascending(String field) {
    return Sort.builder().field(field).order(SortOrder.ASC).build();
  }

  public static Sort descending(String field) {
    return Sort.builder().field(field).order(SortOrder.DESC).build();
  }
}
