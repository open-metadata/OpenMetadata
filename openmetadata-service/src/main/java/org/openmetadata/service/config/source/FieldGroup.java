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

/** Fields applied all or nothing, because a partial change leaves an inconsistent setting. */
public record FieldGroup(String name, List<String> pointers, UnitKind kind) {
  public FieldGroup {
    pointers = List.copyOf(pointers);
  }

  boolean contains(String pointer) {
    return pointers.stream().anyMatch(member -> JsonPointers.isUnder(pointer, member));
  }

  MergeUnit toUnit() {
    return new MergeUnit("group:" + name, pointers, kind);
  }
}
