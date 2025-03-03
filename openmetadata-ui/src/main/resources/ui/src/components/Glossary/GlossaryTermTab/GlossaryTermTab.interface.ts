/*
 *  Copyright 2023 Collate.
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

import { ColumnType } from 'antd/lib/table';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { TagLabel } from '../../../generated/type/tagLabel';

export interface GlossaryTermTabProps {
  isGlossary: boolean;
  termsLoading: boolean;
  refreshGlossaryTerms: () => void;
  permissions: OperationPermission;
  onAddGlossaryTerm: (glossaryTerm: GlossaryTerm | undefined) => void;
  onEditGlossaryTerm: (glossaryTerm: GlossaryTerm) => void;
  className?: string;
}

export type ModifiedGlossaryTerm = Omit<GlossaryTerm, 'children'> & {
  children?: GlossaryTerm[];
  value?: string;
  data?: TagLabel;
  defaultVisible?: boolean;
};

export type MoveGlossaryTermType = {
  from: GlossaryTerm;
  to?: GlossaryTerm;
};

export interface GlossaryTermColumn extends ColumnType<ModifiedGlossaryTerm> {
  defaultVisible?: boolean;
}
