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
const QUOTED_NAME = /^"(.*)"$/;

// Entity-link field names whose label key is not `label.<field>`.
const FIELD_LABEL_KEYS: Record<string, string> = {
  description: 'label.description',
  displayName: 'label.display-name',
  tags: 'label.tag-plural',
};

export interface FeedFieldPathParts {
  // A column carries the fqn its link points at; other children (a pipeline
  // task, a chart, a schema field) are named but not linked.
  child?: { name: string; columnFqn?: string };
  field?: string;
}

/**
 * The part of a feed's entity link below the entity:
 * `<#E::table::db.t::columns::id::description>` → child `id`, field
 * `description`; `<#E::table::db.t::description>` → field `description`.
 * Undefined when the link names only the entity.
 */
export const getFeedFieldPath = (
  about?: string
): FeedFieldPathParts | undefined => {
  const [, entityFqn, group, child, childField] = about
    ? EntityLink.split(about)
    : [];
  if (!group) {
    return undefined;
  }
  if (!child) {
    return { field: group };
  }

  // A nested column is linked by its quoted path (`"address.city"`); its fqn
  // and its name on screen are unquoted.
  const name = child.replace(QUOTED_NAME, '$1');
  const columnFqn =
    group === COLUMNS_FIELD ? `${entityFqn}.${name}` : undefined;

  return { child: { name, columnFqn }, field: childField };
};

export const getFeedFieldLabelKey = (field: string) =>
  FIELD_LABEL_KEYS[field] ?? `label.${field}`;

export const getFeedFieldDefaultLabel = (field: string) => startCase(field);
