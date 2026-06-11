/*
 *  Copyright 2025 Collate.
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
import type { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import type { EntityReference } from '../../generated/type/entityReference';
import type { Field } from '../../generated/type/schema';

export const extractApiEndpointFields = <
  T extends Omit<EntityReference, 'type'>
>(
  data: T
): Field[] => {
  const apiEndpoint = data as Partial<APIEndpoint>;

  return [
    ...(apiEndpoint.requestSchema?.schemaFields ?? []).map(
      (field) => ({ ...field, tags: field.tags ?? [] } as Field)
    ),
    ...(apiEndpoint.responseSchema?.schemaFields ?? []).map(
      (field) => ({ ...field, tags: field.tags ?? [] } as Field)
    ),
  ];
};
