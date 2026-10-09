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
import { EntityType } from '../../../enums/entity.enum';
import { useFqn } from '../../../hooks/useFqn';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';

/**
 * The entity an entity page shows, as a feed link (`<#E::table::fqn>`), read
 * from the route; `fallbackFqn` where the route names none. Empty for a user,
 * whose tab is their own feed rather than one about them.
 */
export const useEntityFeedLink = (
  entityType: EntityType,
  fallbackFqn = ''
): string => {
  // Read as the entity's page reads it: a column or field deep link names the
  // entity first, except a worksheet's, which nests under its spreadsheet at
  // any depth and is read whole.
  const { fqn: routeFqn, entityFqn } = useFqn({ type: entityType });
  const fqn =
    (entityType === EntityType.WORKSHEET ? routeFqn : entityFqn) || fallbackFqn;

  return entityType === EntityType.USER || !fqn
    ? ''
    : getEntityFeedLink(entityType, fqn);
};
