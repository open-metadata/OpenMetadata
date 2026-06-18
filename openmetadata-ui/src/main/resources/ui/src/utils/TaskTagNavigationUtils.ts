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

import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_ROUTE_FQN,
  ROUTES,
} from '../constants/constants';
import { getEncodedFqn } from './StringUtils';

const getTagTaskPath = (
  route: string,
  entityType: string,
  entityFqn: string,
  field?: string,
  value?: string
) => {
  let pathname = route;
  pathname = pathname
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(entityFqn));
  const searchParams = new URLSearchParams();

  if (field !== undefined && value !== undefined) {
    searchParams.append('field', field);
    searchParams.append('value', value);
  }

  return { pathname, search: searchParams.toString() };
};

export const getRequestTagsPath = (
  entityType: string,
  entityFqn: string,
  field?: string,
  value?: string
) => getTagTaskPath(ROUTES.REQUEST_TAGS, entityType, entityFqn, field, value);

export const getUpdateTagsPath = (
  entityType: string,
  entityFqn: string,
  field?: string,
  value?: string
) => getTagTaskPath(ROUTES.UPDATE_TAGS, entityType, entityFqn, field, value);
