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
import { EntityType } from '../../../enums/entity.enum';
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
  /**
   * Entity type for copy link functionality. If provided, shows copy link button.
   */
  entityType?: EntityType;
  /**
   * Raw (un-highlighted) entity name used to seed the edit-displayName modal.
   *
   * `name` may carry a search-highlight ReactNode (e.g. the output of
   * `renderHighlightedText(highlightSearchText(record.name, searchValue))`),
   * which `EntityNameModal` cannot consume directly — its `name` field is a
   * required, possibly-disabled string. Without this raw fallback the modal
   * seeds `name: ''` whenever `name` is a ReactNode, which silently blocks
   * Save ("Name is required"). Pass the underlying `record.name` here so the
   * modal always opens with a valid name regardless of search highlighting.
   */
  entityName?: string;
  /**
   * Raw (un-highlighted) display name used to seed the edit-displayName modal.
   * Same reason as `entityName`: a highlighted `displayName` node would seed an
   * empty field, and saving it unchanged would remove the stored display name.
   */
  entityDisplayName?: string;
}
