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
import { ReactNode } from 'react';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';

export interface DisplayNameProps {
  id: string;
  name?: ReactNode;
  displayName?: ReactNode;
  link?: string;
  onEditDisplayName?: (data: EntityName, id?: string) => Promise<void>;
  /**
   * To allow renaming the `name` field of the entity
   */
  allowRename?: boolean;
  /**
   * To allow renaming the `displayName` field of the entity
   */
  hasEditPermission?: boolean;
}
