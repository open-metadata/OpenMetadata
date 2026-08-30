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
  getMetricApprovalHistoryLabel,
  getMetricApprovalHistoryStatusLabel,
} from './MetricApprovalHistory.utils';

const t = ((key: string) => key) as never;

describe('MetricApprovalHistory utilities', () => {
  it.each([
    ['Metric Status: Approved', 'label.approved'],
    ['Metric Status: Rejected', 'label.rejected'],
    ['Changes Rolled Back', 'label.rolled-back'],
    ['Set Status to Draft', 'label.draft'],
    ['Create User Approval Task', 'label.in-review'],
    ['Check if Metric has Reviewers', 'label.in-review'],
    ['internalNode42', 'label.workflow · label.stage'],
  ])('localizes workflow stage %s', (label, expected) => {
    expect(
      getMetricApprovalHistoryLabel(t, {
        id: label,
        isAutomatic: true,
        label,
        status: 'Running',
        timestamp: 1,
      })
    ).toBe(expected);
  });

  it.each([
    ['Open', 'label.open'],
    ['InProgress', 'label.running'],
    ['Approved', 'label.approved'],
    ['AutoApproved', 'label.approved'],
    ['Rejected', 'label.rejected'],
    ['Finished', 'label.completed'],
    ['internalState', 'label.unknown'],
  ])('localizes approval status %s', (status, expected) => {
    expect(getMetricApprovalHistoryStatusLabel(t, status)).toBe(expected);
  });
});
