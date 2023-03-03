/*
 *  Copyright 2022 Collate.
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

import { Col, Switch } from 'antd';
import { SwitchChangeEventHandler } from 'antd/lib/switch';
import { t } from 'i18next';
import { orderBy } from 'lodash';
import React, { useMemo, useState } from 'react';
import { Operation } from '../../generated/entity/policies/policy';
import { TestCase } from '../../generated/tests/testCase';
import { Paging } from '../../generated/type/paging';
import { checkPermission } from '../../utils/PermissionsUtils';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import DataQualityTab from '../ProfilerDashboard/component/DataQualityTab';
import TestCaseCommonTabContainer from '../TestCaseCommonTabContainer/TestCaseCommonTabContainer.component';

interface TestCasesTabProps {
  isDataLoading: boolean;
  testCases: Array<TestCase>;
  testCasesPaging: Paging;
  currentPage: number;
  onTestUpdate: (deleted?: boolean) => void;
  testCasePageHandler: (
    cursorValue: string | number,
    activePage?: number | undefined
  ) => void;
}

const TestCasesTab = ({
  isDataLoading,
  testCases,
  testCasesPaging,
  currentPage,
  onTestUpdate,
  testCasePageHandler,
}: TestCasesTabProps) => {
  const { permissions } = usePermissionProvider();
  const sortedTestCases = orderBy(testCases || [], ['name'], 'asc');
  const [deleted, setDeleted] = useState<boolean>(false);

  const createPermission = useMemo(() => {
    return checkPermission(
      Operation.Create,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const handleDeletedTestCaseClick: SwitchChangeEventHandler = (value) => {
    setDeleted(value);
    onTestUpdate(value);
  };

  return (
    <TestCaseCommonTabContainer
      isPaging
      buttonName={t('label.add-entity', { entity: t('label.test') })}
      currentPage={currentPage}
      hasAccess={createPermission}
      paging={testCasesPaging}
      showButton={false}
      testCasePageHandler={testCasePageHandler}>
      <>
        <Col className="flex justify-end items-center" span={24}>
          <span className="m-r-xs">{t('label.deleted-test-plural')}</span>
          <Switch checked={deleted} onClick={handleDeletedTestCaseClick} />
        </Col>
        <Col span={24}>
          <DataQualityTab
            deletedTable={deleted}
            isLoading={isDataLoading}
            testCases={sortedTestCases}
            onTestUpdate={() => onTestUpdate(deleted)}
          />
        </Col>
      </>
    </TestCaseCommonTabContainer>
  );
};

export default TestCasesTab;
