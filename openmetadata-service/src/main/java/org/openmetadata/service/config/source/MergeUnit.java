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

package org.openmetadata.service.config.source;

import java.util.List;

/**
 * The smallest part of a setting that is applied or kept as a whole: one field, or a group of
 * fields that only make sense together.
 */
public record MergeUnit(String id, List<String> pointers, UnitKind kind) {
  public MergeUnit {
    pointers = List.copyOf(pointers);
  }

  public static MergeUnit field(String pointer, UnitKind kind) {
    return new MergeUnit(pointer, List.of(pointer), kind);
  }

  public boolean isGroup() {
    return pointers.size() > 1;
  }

  public boolean concernsIdentityProvider() {
    return kind == UnitKind.IDP_IDENTITY || kind == UnitKind.IDP_DEPENDENT;
  }
}
