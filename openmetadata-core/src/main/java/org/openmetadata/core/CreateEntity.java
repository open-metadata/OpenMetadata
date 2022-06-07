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

package org.openmetadata.core;

import org.openmetadata.core.type.EntityReference;

public interface CreateEntity {
  String getName();

  String getDisplayName();

  String getDescription();

  default EntityReference getOwner() {
    return null;
  }

  default Object getExtension() {
    return null;
  }

  <K extends CreateEntity> K withName(String name);

  <K extends CreateEntity> K withDisplayName(String displayName);

  <K extends CreateEntity> K withDescription(String description);

  default <K extends CreateEntity> K withOwner(EntityReference owner) {
    return (K) this;
  }

  default <K extends CreateEntity> K withExtension(Object extension) {
    return (K) this;
  }
}
