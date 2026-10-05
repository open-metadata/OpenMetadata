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

import { chunk, sumBy } from 'lodash';
import {
  CreateTestCaseResolutionStatus,
  TestCaseFailureReasonType,
  TestCaseResolutionStatusTypes as CreateStatusTypes,
} from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import {
  Assigned,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { BulkOperationResult } from '../../../../generated/type/bulkOperationResult';
import { EntityReference } from '../../../../generated/type/entityReference';
import { MAX_BULK_INCIDENT_UPDATE_SIZE } from '../../../../rest/incidentManagerAPI';
import {
  BulkIncidentChange,
  BulkStatusFormValues,
} from './IncidentGroups.types';

type EntryDetails =
  CreateTestCaseResolutionStatus['testCaseResolutionStatusDetails'];

const getAssigneeName = (incident: TestCaseResolutionStatus) =>
  (incident.testCaseResolutionStatusDetails as Assigned | undefined)?.assignee
    ?.name;

const isUnchanged = (
  incident: TestCaseResolutionStatus,
  change: BulkIncidentChange
) => {
  if (change.kind === 'severity') {
    return String(incident.severity) === String(change.severity);
  }

  return (
    String(incident.testCaseResolutionStatusType) === String(change.status) &&
    (change.status !== CreateStatusTypes.Assigned ||
      getAssigneeName(incident) === change.details?.assignee?.name)
  );
};

/**
 * The incident workflow only moves forward, and an assigned incident has no
 * `ack` edge: acknowledging it is a change it cannot take.
 */
const cannotTake = (
  incident: TestCaseResolutionStatus,
  change: BulkIncidentChange
) =>
  change.kind === 'status' &&
  change.status === CreateStatusTypes.ACK &&
  incident.testCaseResolutionStatusType ===
    TestCaseResolutionStatusTypes.Assigned;

const toEntry = (
  incident: TestCaseResolutionStatus,
  change: BulkIncidentChange
): CreateTestCaseResolutionStatus => {
  const testCaseReference =
    incident.testCaseReference?.fullyQualifiedName ?? '';

  // A severity change re-sends the status the incident is in, with its
  // details: an assigned incident stays assigned to the same person.
  return change.kind === 'severity'
    ? {
        testCaseReference,
        // The record and the request each generate the status enum from their
        // own schema; the members match one for one.
        testCaseResolutionStatusType:
          incident.testCaseResolutionStatusType as unknown as CreateStatusTypes,
        testCaseResolutionStatusDetails:
          incident.testCaseResolutionStatusDetails as EntryDetails,
        severity: change.severity,
      }
    : {
        testCaseReference,
        testCaseResolutionStatusType: change.status,
        testCaseResolutionStatusDetails: change.details,
      };
};

/**
 * One bulk entry per incident the change would actually alter. The endpoint
 * rejects an entry that changes nothing or that the workflow has no edge for,
 * so those are counted aside rather than sent and reported back as failures.
 */
export const buildBulkIncidentEntries = (
  incidents: TestCaseResolutionStatus[],
  change: BulkIncidentChange
) => {
  const changed = incidents.filter(
    (incident) =>
      !isUnchanged(incident, change) && !cannotTake(incident, change)
  );

  return {
    entries: changed.map((incident) => toEntry(incident, change)),
    unchanged: incidents.length - changed.length,
  };
};

/** The entries in calls the endpoint accepts. */
export const chunkBulkIncidentEntries = (
  entries: CreateTestCaseResolutionStatus[]
) => chunk(entries, MAX_BULK_INCIDENT_UPDATE_SIZE);

/** Every call's outcome added up, with each failed entry kept. */
export const mergeBulkResults = (results: BulkOperationResult[]) => ({
  passed: sumBy(results, (result) => result.numberOfRowsPassed ?? 0),
  failures: results.flatMap((result) => result.failedRequest ?? []),
});

/**
 * The bulk status form as the details every entry carries: the assignee of
 * an assignment, or the reason, comment and resolver of a resolution.
 */
export const toBulkStatusDetails = (
  status: CreateStatusTypes.Assigned | CreateStatusTypes.Resolved,
  values: BulkStatusFormValues,
  resolvedBy?: EntityReference
): EntryDetails =>
  status === CreateStatusTypes.Assigned
    ? { assignee: values.assignee?.value }
    : {
        testCaseFailureReason: values.testCaseFailureReason
          ?.id as TestCaseFailureReasonType,
        testCaseFailureComment: values.testCaseFailureComment,
        resolvedBy,
      };
