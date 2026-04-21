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
package org.openmetadata.dsl;

import java.util.List;
import lombok.Builder;
import lombok.Data;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;

/**
 * DSL Evaluation Context - holds the data needed to evaluate DSL expressions.
 */
@Data
@Builder
public class DSLContext {

  /** The entity being evaluated */
  private EntityInterface entity;

  /** Change event if this is triggered by an entity change */
  private ChangeEvent changeEvent;

  /** Additional variables defined in the expression */
  private List<DSLVariable> variables;
}