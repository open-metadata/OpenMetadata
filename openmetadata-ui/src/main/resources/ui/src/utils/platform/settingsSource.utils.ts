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

import { UiSchema } from '@rjsf/utils';
import { cloneDeep, get, isEmpty, isPlainObject, set, unset } from 'lodash';
import {
  ConfigSourceMode,
  OverriddenField,
  SettingSource,
} from '../../generated/system/settingsSourceResponse';

/** The server reports this path when it owns the whole setting rather than a list of fields. */
export const WHOLE_SETTING_PATH = '/';

const POINTER_SEPARATOR = '/';

export interface OverriddenSettingField extends OverriddenField {
  configType: SettingSource['configType'];
}

const encodePointerSegment = (segment: string): string =>
  segment.replaceAll('~', '~0').replaceAll('/', '~1');

const decodePointerSegment = (segment: string): string =>
  segment.replaceAll('~1', '/').replaceAll('~0', '~');

/** Builds the JSON pointer of a field from its property names, outermost first. */
export const toJsonPointer = (...segments: string[]): string =>
  segments
    .map((segment) => `${POINTER_SEPARATOR}${encodePointerSegment(segment)}`)
    .join('');

export const getPointerSegments = (pointer: string): string[] =>
  pointer
    .split(POINTER_SEPARATOR)
    .slice(1)
    .filter((segment) => segment !== '')
    .map(decodePointerSegment);

const isUnderPointer = (pointer: string, ancestor: string): boolean =>
  pointer === ancestor || pointer.startsWith(`${ancestor}${POINTER_SEPARATOR}`);

export const isManagedByDeployment = (source?: SettingSource): boolean =>
  source?.source === ConfigSourceMode.Env;

const getReportedManagedPaths = (source?: SettingSource): string[] =>
  isManagedByDeployment(source) ? source?.managedPaths ?? [] : [];

/**
 * Whether no field of the setting can be changed here. `editable: false` without a field list is
 * treated the same way: the server refuses edits but did not say which fields it owns.
 */
export const isWholeSettingManaged = (source?: SettingSource): boolean => {
  const managedPaths = getReportedManagedPaths(source);

  return (
    isManagedByDeployment(source) &&
    (managedPaths.includes(WHOLE_SETTING_PATH) ||
      (source?.editable === false && isEmpty(managedPaths)))
  );
};

/**
 * Pointers of the fields the deployment configuration owns, or just the root pointer when it owns
 * the whole setting. Only ENV mode makes a field read-only.
 */
export const getManagedPaths = (source?: SettingSource): string[] =>
  isWholeSettingManaged(source)
    ? [WHOLE_SETTING_PATH]
    : getReportedManagedPaths(source);

/** Whether the field at `pointer`, or an object enclosing it, is among `managedPaths`. */
export const isPointerManaged = (
  managedPaths: string[],
  pointer: string
): boolean =>
  managedPaths.some(
    (managedPath) =>
      managedPath === WHOLE_SETTING_PATH || isUnderPointer(pointer, managedPath)
  );

/** Whether the field at `pointer`, or an object enclosing it, is owned by the deployment. */
export const isPathManaged = (
  source: SettingSource | undefined,
  pointer: string
): boolean => isPointerManaged(getManagedPaths(source), pointer);

export const areAllPathsManaged = (
  source: SettingSource | undefined,
  pointers: string[]
): boolean =>
  pointers.length > 0 &&
  pointers.every((pointer) => isPathManaged(source, pointer));

export const findSettingSource = (
  sources: SettingSource[],
  configType: string
): SettingSource | undefined =>
  sources.find((source) => source.configType === configType);

/**
 * Deployment values the stored settings override. ENV mode never reports any: there the
 * deployment value is applied on every start.
 */
export const getOverriddenFields = (
  sources: SettingSource[]
): OverriddenSettingField[] =>
  sources
    .filter((source) => !isManagedByDeployment(source))
    .flatMap((source) =>
      (source.overriddenFields ?? []).map((field) => ({
        ...field,
        configType: source.configType,
      }))
    );

/** One entry per variable, since several settings can share the variable that selects ENV. */
export const getEnvSourceVariables = (sources: SettingSource[]): string[] => [
  ...new Set(
    sources
      .filter(isManagedByDeployment)
      .map((source) => source.sourceVariable ?? '')
  ),
];

/**
 * Copies the saved value of every deployment-owned field into `candidate`, removing the field where
 * nothing is saved. A diff of the result against `saved` then never touches those fields: the form
 * fills schema defaults into fields the user cannot edit, and the server rejects any change to them.
 */
export const pinManagedFields = <T extends object>(
  candidate: T,
  saved: T,
  managedPaths: string[],
  rootKey?: string
): T => {
  const pinned = cloneDeep(candidate);

  for (const pointer of managedPaths) {
    const segments = [
      ...(rootKey ? [rootKey] : []),
      ...getPointerSegments(pointer),
    ];
    if (isEmpty(segments)) {
      return cloneDeep(saved);
    }
    const savedValue = get(saved, segments);
    if (savedValue === undefined) {
      unset(pinned, segments);
    } else {
      set(pinned, segments, cloneDeep(savedValue));
    }
  }

  return pinned;
};

/**
 * Marks every deployment-owned field of the form as disabled. `rootKey` is the property the
 * setting sits under when the form's schema wraps several settings (the SSO form nests
 * `authenticationConfiguration` and `authorizerConfiguration`). Disabled rather than read-only,
 * because several custom widgets only honour `disabled`.
 */
export const applyManagedPathsToUiSchema = (
  uiSchema: UiSchema,
  managedPaths: string[],
  rootKey?: string
): UiSchema => {
  const result = cloneDeep(uiSchema);

  for (const pointer of managedPaths) {
    const segments = [
      ...(rootKey ? [rootKey] : []),
      ...getPointerSegments(pointer),
    ];
    let node: UiSchema = result;
    for (const segment of segments) {
      if (!isPlainObject(node[segment])) {
        node[segment] = {};
      }
      node = node[segment];
    }
    node['ui:disabled'] = true;
  }

  return result;
};
