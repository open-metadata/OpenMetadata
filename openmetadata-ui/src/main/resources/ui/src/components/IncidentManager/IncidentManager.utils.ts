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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { Operation } from '../../generated/entity/policies/policy';
import {
  Severities,
  TestCaseResolutionStatus,
} from '../../generated/tests/testCaseResolutionStatus';
import { updateTestCaseIncidentById } from '../../rest/incidentManagerAPI';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { TestCasePermission } from '../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';

/**
 * Whether a row's incident can be worked. Incident actions are gated by
 * `EditStatus` on the test case rather than `EditAll`, so a role can manage
 * incidents while keeping read-only access to the test cases themselves.
 */
export const canEditIncidentRow = (
  testCasePermissions: TestCasePermission[],
  testCaseFqn?: string,
  isDeleted = false
): boolean =>
  getDerivedPermissionFlags(
    testCasePermissions.find(
      (permission) => permission.fullyQualifiedName === testCaseFqn
    ) ?? DEFAULT_ENTITY_PERMISSION,
    isDeleted
  ).can(Operation.EditStatus);

/**
 * Moves one incident to a severity, as a JSON patch. A failure is toasted; the
 * result says whether the change went through, for the caller to show it.
 */
export const submitIncidentSeverity = async (
  incident: TestCaseResolutionStatus,
  severity?: Severities
): Promise<boolean> => {
  try {
    await updateTestCaseIncidentById(
      incident.id ?? '',
      compare(incident, { ...incident, severity })
    );

    return true;
  } catch (error) {
    showErrorToast(error as AxiosError);

    return false;
  }
};
