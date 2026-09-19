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

import axios from 'axios';
import { IncidentGroupBy } from '../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes } from '../generated/tests/testCaseResolutionStatus';
import {
  bulkCreateResolutionStatus,
  getListTestCaseIncidentStatus,
  listIncidentGroups,
} from './incidentManagerAPI';
import APIClient from './index';

jest.mock('./index', () => ({
  get: jest.fn(),
  put: jest.fn(),
}));

const INCIDENT_URL = '/dataQuality/testCases/testCaseIncidentStatus';

const groupsResponse = {
  data: {
    data: [{ groupBy: IncidentGroupBy.Table, name: 'customers' }],
    paging: { total: 12, after: 'MTA=', before: 'MA==' },
  },
};

const incidentsResponse = { data: { data: [], paging: { total: 0 } } };

const getCallConfig = (call: number) =>
  (APIClient.get as jest.Mock).mock.calls[call][1];

describe('incidentManagerAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (APIClient.get as jest.Mock).mockResolvedValue(groupsResponse);
    (APIClient.put as jest.Mock).mockResolvedValue({ data: {} });
  });

  describe('listIncidentGroups', () => {
    it('should call the incidentGroups endpoint with a default limit', async () => {
      const data = await listIncidentGroups({
        groupBy: IncidentGroupBy.TestDefinition,
      });

      expect(APIClient.get).toHaveBeenCalledWith(
        `${INCIDENT_URL}/incidentGroups`,
        expect.objectContaining({
          params: { groupBy: IncidentGroupBy.TestDefinition, limit: 10 },
        })
      );
      expect(data).toEqual(groupsResponse.data);
    });

    it('should serialize repeatable status and timestamp params', async () => {
      await listIncidentGroups({
        groupBy: IncidentGroupBy.Owner,
        status: [
          TestCaseResolutionStatusTypes.New,
          TestCaseResolutionStatusTypes.ACK,
        ],
        dateField: 'updatedAt',
        startTs: 1700000000000,
        endTs: 1700086400000,
        limit: 25,
      });

      const { params, paramsSerializer } = getCallConfig(0);

      expect(params).toEqual({
        groupBy: IncidentGroupBy.Owner,
        status: ['New', 'Ack'],
        dateField: 'updatedAt',
        startTs: 1700000000000,
        endTs: 1700086400000,
        limit: 25,
      });
      // `indexes: null` is axios' repeat format — `status=New&status=Ack`.
      expect(paramsSerializer).toEqual({ indexes: null });
      expect(axios.getUri({ url: '', params, paramsSerializer })).toBe(
        '?groupBy=owner&status=New&status=Ack&dateField=updatedAt' +
          '&startTs=1700000000000&endTs=1700086400000&limit=25'
      );
    });

    it('should pass a paging cursor back verbatim as the offset', async () => {
      const { paging } = groupsResponse.data;

      await listIncidentGroups({
        groupBy: IncidentGroupBy.Table,
        offset: paging.after,
      });
      await listIncidentGroups({
        groupBy: IncidentGroupBy.Table,
        offset: paging.before,
      });

      expect(getCallConfig(0).params.offset).toBe('MTA=');
      expect(getCallConfig(1).params.offset).toBe('MA==');
    });
  });

  describe('getListTestCaseIncidentStatus', () => {
    beforeEach(() => {
      (APIClient.get as jest.Mock).mockResolvedValue(incidentsResponse);
    });

    it('should call the incident listing with the drill-down filters', async () => {
      const data = await getListTestCaseIncidentStatus({
        testDefinition: 'columnValuesToBeUnique',
        owner: 'aaron_johnson0',
        assignee: 'tomas_montiel',
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
        latest: true,
        limit: 4,
        offset: 'NA==',
      });

      expect(APIClient.get).toHaveBeenCalledWith(INCIDENT_URL, {
        params: {
          testDefinition: 'columnValuesToBeUnique',
          owner: 'aaron_johnson0',
          assignee: 'tomas_montiel',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
          latest: true,
          limit: 4,
          offset: 'NA==',
        },
      });
      expect(data).toEqual(incidentsResponse.data);
    });

    it('should apply the default limit without any filter', async () => {
      await getListTestCaseIncidentStatus({});

      expect(APIClient.get).toHaveBeenCalledWith(INCIDENT_URL, {
        params: { limit: 10 },
      });
    });
  });

  describe('bulkCreateResolutionStatus', () => {
    it('should PUT the entries to the bulk endpoint', async () => {
      const entries = [
        {
          testCaseReference: 'sample.customers.row_count',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
        },
      ];

      await bulkCreateResolutionStatus(entries);

      expect(APIClient.put).toHaveBeenCalledWith(
        `${INCIDENT_URL}/bulk`,
        entries
      );
    });
  });
});
