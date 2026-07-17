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
import { useEffect, useState } from 'react';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import { TestCasePermission } from '../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';

export interface UseIncidentRowPermissionsProps {
  testCaseListData: TestCaseIncidentStatusData;
  getEntityPermissionByFqn: (
    resource: ResourceEntity,
    entityFqn: string
  ) => Promise<OperationPermission>;
}

/**
 * Owns the per-row TEST_CASE permission resolution: the fqn-keyed permission
 * array and its loading flag. The effect fires whenever the loaded incident
 * rows change and resolves a permission for each referenced test case. The
 * rows and the permission resolver are injected.
 */
export const useIncidentRowPermissions = ({
  testCaseListData,
  getEntityPermissionByFqn,
}: UseIncidentRowPermissionsProps) => {
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);
  const [testCasePermissions, setTestCasePermissions] = useState<
    TestCasePermission[]
  >([]);

  const fetchTestCasePermissions = async () => {
    const { data: incident } = testCaseListData;
    try {
      setIsPermissionLoading(true);
      const promises = incident.map((testCase) => {
        return getEntityPermissionByFqn(
          ResourceEntity.TEST_CASE,
          testCase.testCaseReference?.fullyQualifiedName ?? ''
        );
      });
      const testCasePermission = await Promise.allSettled(promises);
      const data = testCasePermission.reduce((acc, status, i) => {
        if (status.status === 'fulfilled') {
          return [
            ...acc,
            {
              ...status.value,
              fullyQualifiedName:
                incident[i].testCaseReference?.fullyQualifiedName ?? '',
            },
          ];
        }

        return acc;
      }, [] as TestCasePermission[]);

      setTestCasePermissions(data);
    } catch {
      // do nothing
    } finally {
      setIsPermissionLoading(false);
    }
  };

  useEffect(() => {
    if (testCaseListData.data.length > 0) {
      fetchTestCasePermissions();
    }
  }, [testCaseListData.data]);

  return {
    isPermissionLoading,
    testCasePermissions,
  };
};
