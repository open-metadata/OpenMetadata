/*
 *  Copyright 2024 Collate.
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

export const WORKFLOW_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export const WORKFLOW_NAME_MIN_LENGTH = 3;
export const WORKFLOW_NAME_MAX_LENGTH = 50;

const hashDisplayName = (displayName: string): string => {
  let hash = 5381;
  for (const char of displayName) {
    hash = Math.imul(hash, 33) ^ (char.codePointAt(0) ?? 0);
  }

  return (hash >>> 0).toString(36);
};

/**
 * The workflow's identifier, derived from the display name the user types: the
 * name is part of the workflow's FQN, so runs of characters it cannot hold
 * become a single hyphen. A display name with too few of them (e.g. written in
 * a non-Latin script) gets a "workflow-<code>" name instead.
 */
export const getWorkflowNameFromDisplayName = (displayName: string): string => {
  const trimmed = displayName.trim();
  const name = trimmed
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, WORKFLOW_NAME_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');

  return name.length >= WORKFLOW_NAME_MIN_LENGTH || !trimmed
    ? name
    : `workflow-${hashDisplayName(trimmed)}`;
};

/**
 * Gets validation rules for Ant Design Form
 * @returns Array of validation rules
 */
export const getWorkflowNameValidationRules = () => [
  {
    required: true,
    message: 'Workflow name is required',
  },
  {
    pattern: WORKFLOW_NAME_REGEX,
    message:
      'Workflow name can only contain letters, numbers, underscores, and hyphens',
  },
  {
    min: WORKFLOW_NAME_MIN_LENGTH,
    message: `Workflow name must be at least ${WORKFLOW_NAME_MIN_LENGTH} characters long`,
  },
  {
    max: WORKFLOW_NAME_MAX_LENGTH,
    message: `Workflow name must not exceed ${WORKFLOW_NAME_MAX_LENGTH} characters`,
  },
];
