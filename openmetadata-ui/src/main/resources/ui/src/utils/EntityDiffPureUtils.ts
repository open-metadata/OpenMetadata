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

import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import type { ChangeDescription } from '../generated/entity/services/databaseService';
import type {
  EntityDiffProps,
  EntityDiffWithMultiChanges,
} from '../interface/EntityVersion.interface';

export const getChangedEntityName = (diffObject?: EntityDiffProps) =>
  diffObject?.added?.name ??
  diffObject?.deleted?.name ??
  diffObject?.updated?.name;

export const getChangedEntityOldValue = (diffObject?: EntityDiffProps) =>
  diffObject?.added?.oldValue ??
  diffObject?.deleted?.oldValue ??
  diffObject?.updated?.oldValue;

export const getChangedEntityNewValue = (diffObject?: EntityDiffProps) =>
  diffObject?.added?.newValue ??
  diffObject?.deleted?.newValue ??
  diffObject?.updated?.newValue;

// Version history can contain invalid persisted payloads; keep the page usable
// when an individual array diff cannot be decoded.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hasVersionDiffStringProperty = (
  value: unknown,
  property: string
): boolean => isRecord(value) && typeof value[property] === 'string';

export const hasVersionDiffArrayProperty = (
  value: unknown,
  property: string,
  isValidItem: (item: unknown) => boolean = () => true
): boolean =>
  isRecord(value) &&
  (value[property] === undefined ||
    (Array.isArray(value[property]) && value[property].every(isValidItem)));

export const parseVersionDiffArray = <T>(
  value?: string,
  isValid: (item: unknown) => boolean = isRecord
): T[] => {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');

    return Array.isArray(parsed) ? (parsed.filter(isValid) as T[]) : [];
  } catch {
    return [];
  }
};

export const parseVersionDiffObject = <T extends object>(
  value?: string,
  isValid: (item: unknown) => boolean = isRecord
): T => {
  try {
    const parsed: unknown = JSON.parse(value ?? '{}');

    return isValid(parsed) ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

export const getChangeColumnNameFromDiffValue = (name?: string) => {
  const nameWithoutInternalQuotes = name?.replaceAll(/"/g, '');

  return nameWithoutInternalQuotes?.split(FQN_SEPARATOR_CHAR)?.slice(-2, -1)[0];
};

export const isEndsWithField = (checkWith: string, name?: string) => {
  return name?.endsWith(checkWith);
};

export const getDiffByFieldName = (
  name: string,
  changeDescription: ChangeDescription,
  exactMatch?: boolean
): EntityDiffProps => {
  const fieldsAdded = changeDescription?.fieldsAdded ?? [];
  const fieldsDeleted = changeDescription?.fieldsDeleted ?? [];
  const fieldsUpdated = changeDescription?.fieldsUpdated ?? [];
  if (exactMatch) {
    return {
      added: fieldsAdded.find((ch) => ch.name === name),
      deleted: fieldsDeleted.find((ch) => ch.name === name),
      updated: fieldsUpdated.find((ch) => ch.name === name),
    };
  } else {
    return {
      added: fieldsAdded.find((ch) => ch.name?.includes(name)),
      deleted: fieldsDeleted.find((ch) => ch.name?.includes(name)),
      updated: fieldsUpdated.find((ch) => ch.name?.includes(name)),
    };
  }
};

export const getAllDiffByFieldName = (
  name: string,
  changeDescription: ChangeDescription,
  exactMatch?: boolean
): EntityDiffWithMultiChanges => {
  const fieldsAdded = changeDescription?.fieldsAdded ?? [];
  const fieldsDeleted = changeDescription?.fieldsDeleted ?? [];
  const fieldsUpdated = changeDescription?.fieldsUpdated ?? [];
  if (exactMatch) {
    return {
      added: fieldsAdded.filter((ch) => ch.name === name),
      deleted: fieldsDeleted.filter((ch) => ch.name === name),
      updated: fieldsUpdated.filter((ch) => ch.name === name),
    };
  } else {
    return {
      added: fieldsAdded.filter((ch) => ch.name?.includes(name)),
      deleted: fieldsDeleted.filter((ch) => ch.name?.includes(name)),
      updated: fieldsUpdated.filter((ch) => ch.name?.includes(name)),
    };
  }
};

export const getAllChangedEntityNames = (
  diffObject: EntityDiffWithMultiChanges
) => {
  const changedEntityNames: string[] = [];
  Object.keys(diffObject).forEach((key) => {
    const changedValues = diffObject[key as keyof EntityDiffWithMultiChanges];

    if (changedValues) {
      changedValues.forEach((value) => {
        if (value.name) {
          changedEntityNames.push(value.name);
        }
      });
    }
  });

  return changedEntityNames;
};
