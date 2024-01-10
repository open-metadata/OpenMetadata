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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Severities,
  TestCaseResolutionStatus,
} from '../../../generated/tests/testCaseResolutionStatus';
import {
  getListTestCaseIncidentByStateId,
  updateTestCaseIncidentById,
} from '../../../rest/incidentManagerAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  IncidentManagerContextInterface,
  IncidentManagerProviderProps,
} from './IncidentManagerProvider.interface';

export const IncidentManagerContext = createContext(
  {} as IncidentManagerContextInterface
);

const IncidentManagerProvider = ({
  children,
  testCaseData,
}: IncidentManagerProviderProps) => {
  const [testCaseStatusData, setTestCaseStatusData] = useState<{
    status?: TestCaseResolutionStatus;
    isLoading: boolean;
  }>({
    status: undefined,
    isLoading: false,
  });

  const fetchTestCaseStatus = async (id: string) => {
    setTestCaseStatusData((prev) => ({ ...prev, isLoading: true }));
    try {
      const { data } = await getListTestCaseIncidentByStateId(id);
      setTestCaseStatusData((prev) => ({ ...prev, status: data[0] }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setTestCaseStatusData((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleSeverityUpdate = async (severity: Severities) => {
    if (isUndefined(testCaseStatusData.status)) {
      return;
    }

    const updatedData = { ...testCaseStatusData.status, severity };
    const patch = compare(testCaseStatusData.status, updatedData);
    try {
      await updateTestCaseIncidentById(
        testCaseStatusData.status.id ?? '',
        patch
      );

      setTestCaseStatusData((prev) => {
        if (prev.status) {
          return {
            ...prev,
            status: {
              ...prev.status,
              severity,
            },
          };
        }

        return prev;
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleIncidentStatusUpdate = (data: TestCaseResolutionStatus) => {
    setTestCaseStatusData((prev) => ({ ...prev, status: data }));
  };

  useEffect(() => {
    if (testCaseData?.incidentId && isUndefined(testCaseStatusData.status)) {
      fetchTestCaseStatus(testCaseData.incidentId);
    }
  }, [testCaseData?.incidentId]);

  const data = useMemo(
    () => ({
      testCaseData,
      testCaseStatusData,
      onSeverityUpdate: handleSeverityUpdate,
      onIncidentStatusUpdate: handleIncidentStatusUpdate,
    }),
    [
      testCaseData,
      testCaseStatusData,
      handleSeverityUpdate,
      handleIncidentStatusUpdate,
    ]
  );

  return (
    <IncidentManagerContext.Provider value={data}>
      {children}
    </IncidentManagerContext.Provider>
  );
};

export default IncidentManagerProvider;

export const useIncidentManagerProvider = () =>
  useContext(IncidentManagerContext);
