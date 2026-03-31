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
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../../generated/entity/type';
import { VersionStatus } from '../../../../utils/EntityVersionUtils.interface';

export interface TermItem {
  value: string;
  label: string;
  entity?: EntityReference;
}

export interface TermSelectItem {
  id: string;
  label?: string;
}

export interface RelationEditRow {
  id: string;
  relationType: string;
  terms: TermItem[];
}

export interface RelationTypeOption {
  id: string;
  label?: string;
  title?: string;
}

export interface TermsRowProps {
  rowId: string;
  initialRelationType: string;
  initialTerms: TermItem[];
  relationTypeOptions: RelationTypeOption[];
  excludeFQN: string;
  preloadedTerms: GlossaryTerm[];
  onRelationTypeChange: (rowId: string, relationType: string) => void;
  onTermsChange: (rowId: string, terms: TermItem[]) => void;
  onRemove: (rowId: string) => void;
}

export interface TermsRowEditorProps {
  rows: RelationEditRow[];
  excludeFQN: string;
  preloadedTerms: GlossaryTerm[];
  relationTypeOptions: RelationTypeOption[];
  onAddRow: () => void;
  onRelationTypeChange: (rowId: string, relationType: string) => void;
  onTermsChange: (rowId: string, terms: TermItem[]) => void;
  onRemove: (rowId: string) => void;
}

export interface RelatedTermTagButtonProps {
  entity: EntityReference;
  relationType?: string;
  versionStatus?: VersionStatus;
  getRelationDisplayName: (relationType: string) => string;
  onRelatedTermClick: (fqn: string) => void;
}
