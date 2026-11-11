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
  getWorkflowNameFromDisplayName,
  WORKFLOW_NAME_MAX_LENGTH,
  WORKFLOW_NAME_REGEX,
} from './WorkflowValidationUtils';

describe('getWorkflowNameFromDisplayName', () => {
  it.each([
    ['Test lifecycle', 'Test-lifecycle'],
    ['  Data Product: Review & Approve  ', 'Data-Product-Review-Approve'],
    ['glossary_term-approval', 'glossary_term-approval'],
    ['Revue d’été', 'Revue-d-t'],
  ])('turns "%s" into "%s"', (displayName, name) => {
    expect(getWorkflowNameFromDisplayName(displayName)).toBe(name);
    expect(name).toMatch(WORKFLOW_NAME_REGEX);
  });

  it('is empty for a blank display name', () => {
    expect(getWorkflowNameFromDisplayName('   ')).toBe('');
  });

  it('falls back to a stable generated name for a non-Latin display name', () => {
    const name = getWorkflowNameFromDisplayName('用户审批');

    expect(name).toMatch(/^workflow-[a-z0-9]+$/);
    expect(getWorkflowNameFromDisplayName('用户审批')).toBe(name);
    expect(getWorkflowNameFromDisplayName('术语审批')).not.toBe(name);
  });

  it('caps the name at the maximum length without a trailing hyphen', () => {
    const name = getWorkflowNameFromDisplayName(`${'a'.repeat(49)} tail`);

    expect(name).toBe('a'.repeat(49));
    expect(name.length).toBeLessThanOrEqual(WORKFLOW_NAME_MAX_LENGTH);
  });
});
