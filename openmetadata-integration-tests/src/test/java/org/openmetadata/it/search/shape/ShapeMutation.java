/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape;

import java.util.List;
import org.openmetadata.schema.EntityInterface;

public interface ShapeMutation {
  String dimension();

  boolean appliesTo(EntityInterface entity);

  List<Rung> ladder();

  EntityInterface apply(EntityInterface entity, Rung rung);

  default FieldProbe probe(Rung rung) {
    return null;
  }
}
