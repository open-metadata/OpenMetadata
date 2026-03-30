/*
 *  Copyright 2025 Collate.
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

import { Button, Col, Row } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ChangeDescription } from '../../../../generated/tests/testCase';

import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import {
    getChangedEntityNewValue,
    getChangedEntityOldValue,
    getChangedEntityStatus,
    getDiffByFieldName,
    getDiffDisplayValue
} from '../../../../utils/EntityVersionUtils';
import Loader from '../../../common/Loader/Loader';
import QueryViewer from '../../../common/QueryViewer/QueryViewer.component';
import '../TestCaseResultTab/test-case-result-tab.style.less';
import AddSqlQueryFormModal from './AddSqlQueryFormModal/AddSqlQueryFormModal.component';

const SqlQueryTab = () => {
  const { testCase, isLoading } = useTestCaseStore();
  const { version } = useParams<{ version: string }>();
  const isVersionPage = !isUndefined(version);
  const { permissions } = usePermissionProvider();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const versionDiffInspectionQuery = useMemo(() => {
    const diff = getDiffByFieldName(
      'inspectionQuery',
      testCase?.changeDescription as ChangeDescription,
      true
    );

    let oldValue = getChangedEntityOldValue(diff) ?? '';
    let newValue = getChangedEntityNewValue(diff) ?? '';
    if (isEmpty(oldValue) && isEmpty(newValue)) {
      oldValue = testCase?.inspectionQuery ?? '';
      newValue = testCase?.inspectionQuery ?? '';
    }
    const status = getChangedEntityStatus(oldValue, newValue);

    return (
      <div className="m-t-sm version-sql-expression-container">
        {getDiffDisplayValue({
          oldValue,
          newValue,
          status,
        })}
      </div>
    );
  }, [testCase?.changeDescription, testCase?.inspectionQuery]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row className="p-md" gutter={[16, 16]}>
      {permissions.query?.Create && !isVersionPage && (
        <Col className="d-flex justify-end" span={24}>
          <Button
            data-testid="add-to-table-button"
            type="primary"
            onClick={() => setIsOpen(true)}>
            {t('label.add-to-table')}
          </Button>
        </Col>
      )}
      <Col span={24}>
        {isVersionPage ? (
          versionDiffInspectionQuery
        ) : (
          <QueryViewer sqlQuery={testCase?.inspectionQuery ?? ''} />
        )}
      </Col>
      {isOpen && (
        <Col span={24}>
          <AddSqlQueryFormModal
            open={isOpen}
            onCancel={() => {
              setIsOpen(false);
            }}
          />
        </Col>
      )}
    </Row>
  );
};

export default SqlQueryTab;
