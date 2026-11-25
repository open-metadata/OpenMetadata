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

import { findKey } from 'lodash';
import { User } from '../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../generated/entity/type';
import { SupportedLocales } from '../../../../utils/i18next/LocalUtil.interface';

/** Every persona the user can switch to — assigned, inherited and default — once each. */
export const getUserPersonas = (user?: User): EntityReference[] => {
  const byId = new Map<string, EntityReference>();
  [
    ...(user?.personas ?? []),
    ...(user?.inheritedPersonas ?? []),
    ...(user?.defaultPersona ? [user.defaultPersona] : []),
  ].forEach((persona) => byId.set(persona.id, persona));

  return Array.from(byId.values());
};

/** Native name of a supported locale (`en-US` → `English`); the code itself otherwise. */
export const getLanguageName = (locale: string): string =>
  findKey(SupportedLocales, (value) => value === locale) ?? locale;
