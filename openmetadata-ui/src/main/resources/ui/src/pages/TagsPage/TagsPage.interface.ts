/*
 *  Copyright 2022 Collate.
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

import { LoadingState } from 'Models';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';

export type DeleteTagDetailsType = {
  id: string;
  name: string;
  categoryName?: string;
  isCategory: boolean;
  status?: LoadingState;
};

export type DeleteTagsType = {
  data: DeleteTagDetailsType | undefined;
  state: boolean;
};

export interface SubmitProps {
  name: string;
  description: string;
  displayName: string;
  owners: EntityReference[];
  mutuallyExclusive?: boolean;
  iconURL?: string;
  color?: string;
}

export interface RenameFormProps {
  visible: boolean;
  isEditing: boolean;
  isTier: boolean;
  onCancel: () => void;
  header: string;
  initialValues?: Tag;
  onSubmit: (value: SubmitProps) => Promise<void>;
  showMutuallyExclusive?: boolean;
  isClassification?: boolean;
  data?: Classification[];
  isLoading: boolean;
  isSystemTag?: boolean;
  permissions?: {
    createTags?: boolean;
    editDescription?: boolean;
    editDisplayName?: boolean;
    editAll?: boolean;
  };
}

export interface EntityReference {
  /**
   * If true the entity referred to has been soft-deleted.
   */
  deleted?: boolean;
  /**
   * Optional description of entity.
   */
  description?: string;
  /**
   * Display Name that identifies this entity.
   */
  displayName?: string;
  /**
   * Fully qualified name of the entity instance. For entities such as tables, databases
   * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
   * such as `user` and `team` this will be same as the `name` field.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the entity resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * If true the relationship indicated by this entity reference is inherited from the parent
   * entity.
   */
  inherited?: boolean;
  /**
   * Name of the entity instance.
   */
  name?: string;
  /**
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
   * `dashboardService`...
   */
  type: string;
}
