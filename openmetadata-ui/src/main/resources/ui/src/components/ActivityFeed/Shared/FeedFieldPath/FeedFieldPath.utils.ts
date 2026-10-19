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
import { startCase } from 'lodash';
import EntityLink from '../../../../utils/EntityLink';

const COLUMNS_FIELD = 'columns';

// Entity-link field names whose label key is not `label.<field>`.
const FIELD_LABEL_KEYS: Record<string, string> = {
  description: 'label.description',
  displayName: 'label.display-name',
  tags: 'label.tag-plural',
};

export interface FeedFieldPathParts {
  column?: { name: string; fqn: string };
  field?: string;
}

/**
 * The part of a feed's entity link below the entity, e.g.
 * `<#E::table::db.t::columns::id::description>` → column `id`, field
 * `description`. Undefined when the link names only the entity.
 */
export const getFeedFieldPath = (
  about?: string
): FeedFieldPathParts | undefined => {
  const [, , group, name, columnField] = about ? EntityLink.split(about) : [];
  if (!group) {
    return undefined;
  }

  return group === COLUMNS_FIELD && name
    ? {
        column: { name, fqn: EntityLink.getEntityColumnFqn(about ?? '') },
        field: columnField,
      }
    : { field: name ?? group };
};

export const getFeedFieldLabelKey = (field: string) =>
  FIELD_LABEL_KEYS[field] ?? `label.${field}`;

export const getFeedFieldDefaultLabel = (field: string) => startCase(field);
