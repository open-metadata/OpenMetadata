/*
 *  Copyright 2025 Collate.
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
import { TableConstraint } from '../../../generated/entity/data/table';

export interface FieldCardProps {
  fieldName: string;
  dataType: string;
  description?: string;
  tags?: Array<{
    tagFQN: string;
    source: string;
    labelType: string;
    state: string;
  }>;
  glossaryTerms?: Array<{
    name: string;
    displayName: string;
    fullyQualifiedName: string;
  }>;
  columnConstraint?: string;
  tableConstraints?: TableConstraint[];
  isHighlighted?: boolean;
}
