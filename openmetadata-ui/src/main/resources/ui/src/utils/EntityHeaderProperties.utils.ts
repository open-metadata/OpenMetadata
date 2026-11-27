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
import { isUndefined, uniq } from 'lodash';
import {
  CustomHeaderPropertyId,
  HeaderProperty,
} from '../components/DataAssets/EntityHeaderProperties/EntityHeaderProperties.types';
import {
  CUSTOM_PROPERTY_HEADER_ID_PREFIX,
  HeaderPropertyFilter,
} from '../constants/EntityHeaderProperties.constants';
import { EntityHeader } from '../generated/system/ui/page';

export type DropPosition = 'before' | 'after' | 'on';

export const getCustomPropertyHeaderId = (
  propertyName: string
): CustomHeaderPropertyId =>
  `${CUSTOM_PROPERTY_HEADER_ID_PREFIX}${propertyName}`;

export const isCustomHeaderProperty = (property: HeaderProperty) =>
  !isUndefined(property.customPropertyType);

/** Without a saved header, a page shows its standard properties in their built-in order. */
export const getDefaultEntityHeader = (
  properties: HeaderProperty[]
): EntityHeader => ({
  properties: properties
    .filter((property) => !isCustomHeaderProperty(property))
    .map(({ id }) => id),
  showEmptyProperties: true,
});

/** The properties pinned to the header, in display order. Ids the entity type lacks are skipped. */
export const getPinnedHeaderProperties = (
  properties: HeaderProperty[],
  entityHeader: EntityHeader
): HeaderProperty[] => {
  const propertyById = new Map<string, HeaderProperty>(
    properties.map((p) => [p.id, p])
  );

  return uniq(entityHeader.properties)
    .map((id) => propertyById.get(id))
    .filter((property): property is HeaderProperty => !isUndefined(property));
};

/**
 * The properties the header draws. An empty read-only property has nothing to
 * fill in, so it never shows; an empty editable one shows unless the header
 * hides empty properties.
 */
export const getShownHeaderProperties = (
  properties: HeaderProperty[],
  entityHeader: EntityHeader
): HeaderProperty[] => {
  const showEmpty = entityHeader.showEmptyProperties ?? true;

  return getPinnedHeaderProperties(properties, entityHeader).filter(
    ({ isEmpty, isReadOnly }) => !isEmpty || (showEmpty && !isReadOnly)
  );
};

export const toggleHeaderProperty = (
  entityHeader: EntityHeader,
  id: string
): EntityHeader => ({
  ...entityHeader,
  properties: entityHeader.properties.includes(id)
    ? entityHeader.properties.filter((pinnedId) => pinnedId !== id)
    : [...entityHeader.properties, id],
});

export const moveHeaderProperties = (
  entityHeader: EntityHeader,
  movedIds: string[],
  targetId: string,
  position: DropPosition
): EntityHeader => {
  const remaining = entityHeader.properties.filter(
    (id) => !movedIds.includes(id)
  );
  const targetIndex = remaining.indexOf(targetId);
  const insertAt = position === 'before' ? targetIndex : targetIndex + 1;

  return targetIndex < 0
    ? entityHeader
    : {
        ...entityHeader,
        properties: [
          ...remaining.slice(0, insertAt),
          ...movedIds,
          ...remaining.slice(insertAt),
        ],
      };
};

export const matchesHeaderPropertyFilter = (
  property: HeaderProperty,
  filter: HeaderPropertyFilter,
  query: string
) => {
  const isCustom = isCustomHeaderProperty(property);
  const matchesFilter =
    filter === HeaderPropertyFilter.All ||
    isCustom === (filter === HeaderPropertyFilter.Custom);

  return (
    matchesFilter &&
    property.label.toLowerCase().includes(query.trim().toLowerCase())
  );
};
