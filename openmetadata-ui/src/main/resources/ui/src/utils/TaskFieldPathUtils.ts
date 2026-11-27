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
import { isEmpty, isEqual } from 'lodash';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityField } from '../constants/Feeds.constants';
import { TASK_SANITIZE_VALUE_REGEX } from '../constants/regex.constants';
import Fqn from './Fqn';

// The full container path of each field container a task page may name by its
// first segment alone.
const TASK_FIELD_CONTAINERS: Record<string, string> = {
  messageSchema: 'messageSchema.schemaFields',
  dataModel: 'dataModel.columns',
  requestSchema: 'requestSchema.schemaFields',
  responseSchema: 'responseSchema.schemaFields',
};

const TASK_FIELD_CONTAINER_PATHS = [
  'messageSchema.schemaFields',
  'dataModel.columns',
  'requestSchema.schemaFields',
  'responseSchema.schemaFields',
  'columns',
  'tasks',
  'mlFeatures',
  'fields',
];

export type TaskFieldProperty = 'description' | 'tags';

/** A parsed task field path; `container` is absent for the entity itself. */
export interface TaskFieldPath {
  container?: string;
  names: string[];
  property: TaskFieldProperty;
}

const isTaskFieldProperty = (value?: string): value is TaskFieldProperty =>
  value === EntityField.DESCRIPTION || value === EntityField.TAGS;

/**
 * The names of the field a task page's `value` points at, outermost first. The
 * page wraps a dotted value in quotes; inside them, dots separate nested names.
 */
export const getTaskFieldNames = (value?: string | null): string[] =>
  value
    ? Fqn.split(value.replaceAll(TASK_SANITIZE_VALUE_REGEX, '')).map((name) =>
        Fqn.unquoteName(name)
      )
    : [];

/**
 * A task's field path: `<container>.<name>[.<child name>...].<property>`, or
 * the property alone for the entity itself.
 */
export const buildTaskFieldPath = (
  field: string | null | undefined,
  value: string | null | undefined,
  property: TaskFieldProperty
): string => {
  const names = getTaskFieldNames(value);
  if (!field || isEmpty(names)) {
    return property;
  }

  return [
    TASK_FIELD_CONTAINERS[field] ?? field,
    Fqn.build(...names),
    property,
  ].join(FQN_SEPARATOR_CHAR);
};

/** Reads a field path written by {@link buildTaskFieldPath}. */
export const parseTaskFieldPath = (
  fieldPath?: string
): TaskFieldPath | undefined => {
  const segments = fieldPath ? Fqn.split(fieldPath) : [];
  const property = segments.pop();
  if (!isTaskFieldProperty(property)) {
    return undefined;
  }
  if (isEmpty(segments)) {
    return { names: [], property };
  }
  const container = TASK_FIELD_CONTAINER_PATHS.find((path) =>
    isEqual(segments.slice(0, path.split('.').length), path.split('.'))
  );
  const names = container
    ? segments.slice(container.split('.').length).map((n) => Fqn.unquoteName(n))
    : [];

  return container && !isEmpty(names)
    ? { container, names, property }
    : undefined;
};

/** The field a task is about, as its names joined by dots; empty for the entity. */
export const getTaskFieldName = (fieldPath?: string): string =>
  parseTaskFieldPath(fieldPath)?.names.join(FQN_SEPARATOR_CHAR) ?? '';
