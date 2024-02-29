/*
 *  Copyright 2023 Collate.
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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Col, Divider, Row, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
} from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { CSMode } from '../../../../enums/codemirror.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import { TestCaseParameterValue } from '../../../../generated/tests/testCase';
import { updateTestCaseById } from '../../../../rest/testAPI';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
import TestSummary from '../../../Database/Profiler/TestSummary/TestSummary';
import SchemaEditor from '../../../Database/SchemaEditor/SchemaEditor';
import EditTestCaseModal from '../../AddDataQualityTest/EditTestCaseModal';
import '../incident-manager.style.less';
import './test-case-result-tab.style.less';
import { TestCaseResultTabProps } from './TestCaseResultTab.interface';

const TestCaseResultTab = ({
  testCaseData,
  onTestCaseUpdate,
}: TestCaseResultTabProps) => {
  const { t } = useTranslation();
  const [isDescriptionEdit, setIsDescriptionEdit] = useState<boolean>(false);
  const [isParameterEdit, setIsParameterEdit] = useState<boolean>(false);
  const { permissions } = usePermissionProvider();
  const hasEditPermission = useMemo(() => {
    return checkPermission(
      Operation.EditAll,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const { withSqlParams, withoutSqlParams } = useMemo(() => {
    const params = testCaseData?.parameterValues ?? [];

    return params.reduce(
      (result, param) => {
        if (param.name === 'sqlExpression') {
          result.withSqlParams.push(param);
        } else {
          result.withoutSqlParams.push(param);
        }

        return result;
      },
      { withSqlParams: [], withoutSqlParams: [] } as {
        withSqlParams: TestCaseParameterValue[];
        withoutSqlParams: TestCaseParameterValue[];
      }
    );
  }, [testCaseData?.parameterValues]);

  const handleDescriptionChange = useCallback(
    async (description: string) => {
      if (testCaseData) {
        const updatedTestCase = {
          ...testCaseData,
          description,
        };
        const jsonPatch = compare(testCaseData, updatedTestCase);

        if (jsonPatch.length) {
          try {
            const res = await updateTestCaseById(
              testCaseData.id ?? '',
              jsonPatch
            );
            onTestCaseUpdate(res);
            showSuccessToast(
              t('server.update-entity-success', {
                entity: t('label.test-case'),
              })
            );
          } catch (error) {
            showErrorToast(error as AxiosError);
          } finally {
            setIsDescriptionEdit(false);
          }
        }
      }
    },
    [testCaseData, updateTestCaseById, onTestCaseUpdate]
  );

  const handleCancelParameter = useCallback(
    () => setIsParameterEdit(false),
    []
  );

  return (
    <Row
      className="p-lg test-case-result-tab"
      data-testid="test-case-result-tab-container"
      gutter={[0, 20]}>
      <Col span={24}>
        <DescriptionV1
          description={testCaseData?.description}
          entityType={EntityType.TEST_CASE}
          hasEditAccess={hasEditPermission}
          isEdit={isDescriptionEdit}
          showCommentsIcon={false}
          onCancel={() => setIsDescriptionEdit(false)}
          onDescriptionEdit={() => setIsDescriptionEdit(true)}
          onDescriptionUpdate={handleDescriptionChange}
        />
      </Col>

      <Col data-testid="parameter-container" span={24}>
        <Space direction="vertical" size="small">
          <Space align="center" size="middle">
            <Typography.Text className="right-panel-label">
              {t('label.parameter-plural')}
            </Typography.Text>
            {hasEditPermission && Boolean(withoutSqlParams.length) && (
              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.parameter'),
                })}>
                <Icon
                  component={EditIcon}
                  data-testid="edit-parameter-icon"
                  style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                  onClick={() => setIsParameterEdit(true)}
                />
              </Tooltip>
            )}
          </Space>

          {!isEmpty(withoutSqlParams) && !isUndefined(withoutSqlParams) ? (
            <Space
              className="parameter-value-container parameter-value"
              size={6}>
              {withoutSqlParams.map((param, index) => (
                <Space key={param.name} size={4}>
                  <Typography.Text className="text-grey-muted">
                    {`${param.name}:`}
                  </Typography.Text>
                  <Typography.Text>{param.value}</Typography.Text>
                  {withoutSqlParams.length - 1 !== index && (
                    <Divider type="vertical" />
                  )}
                </Space>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">
              {t('label.no-parameter-available')}
            </Typography.Text>
          )}
        </Space>
      </Col>

      {!isUndefined(withSqlParams) ? (
        <Col>
          {withSqlParams.map((param) => (
            <Row
              className="sql-expression-container"
              data-testid="sql-expression-container"
              gutter={[8, 8]}
              key={param.name}>
              <Col span={24}>
                <Typography.Text className="text-grey-muted">
                  {`${param.name}:`}
                </Typography.Text>
              </Col>
              <Col span={24}>
                <SchemaEditor
                  editorClass="table-query-editor"
                  mode={{ name: CSMode.SQL }}
                  options={{
                    styleActiveLine: false,
                  }}
                  value={param.value ?? ''}
                />
              </Col>
            </Row>
          ))}
        </Col>
      ) : null}

      {testCaseData && (
        <Col className="test-case-result-tab-graph" span={24}>
          <TestSummary data={testCaseData} />
        </Col>
      )}

      {testCaseData && isParameterEdit && (
        <EditTestCaseModal
          showOnlyParameter
          testCase={testCaseData}
          visible={isParameterEdit}
          onCancel={handleCancelParameter}
          onUpdate={onTestCaseUpdate}
        />
      )}
    </Row>
  );
};

export default TestCaseResultTab;
