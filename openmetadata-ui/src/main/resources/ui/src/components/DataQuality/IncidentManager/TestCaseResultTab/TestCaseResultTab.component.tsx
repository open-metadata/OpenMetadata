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
import { isEmpty, isUndefined, startCase } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
} from '../../../../constants/constants';
import { CSMode } from '../../../../enums/codemirror.enum';
import { EntityType } from '../../../../enums/entity.enum';

import { ReactComponent as StarIcon } from '../../../../assets/svg/ic-suggestions.svg';
import { TestCaseParameterValue } from '../../../../generated/tests/testCase';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { updateTestCaseById } from '../../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
import TestSummary from '../../../Database/Profiler/TestSummary/TestSummary';
import SchemaEditor from '../../../Database/SchemaEditor/SchemaEditor';
import EditTestCaseModal from '../../AddDataQualityTest/EditTestCaseModal';
import '../incident-manager.style.less';
import './test-case-result-tab.style.less';
import testCaseResultTabClassBase from './TestCaseResultTabClassBase';

const TestCaseResultTab = () => {
  const { t } = useTranslation();
  const {
    testCase: testCaseData,
    setTestCase,
    showAILearningBanner,
    testCasePermission,
  } = useTestCaseStore();
  const additionalComponent =
    testCaseResultTabClassBase.getAdditionalComponents();
  const [isParameterEdit, setIsParameterEdit] = useState<boolean>(false);

  const { hasEditPermission, hasEditDescriptionPermission } = useMemo(() => {
    return {
      hasEditPermission: testCasePermission?.EditAll,
      hasEditDescriptionPermission:
        testCasePermission?.EditAll || testCasePermission?.EditDescription,
    };
  }, [testCasePermission]);

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
            setTestCase(res);
            showSuccessToast(
              t('server.update-entity-success', {
                entity: t('label.test-case'),
              })
            );
          } catch (error) {
            showErrorToast(error as AxiosError);
          }
        }
      }
    },
    [testCaseData, updateTestCaseById, setTestCase]
  );

  const handleCancelParameter = useCallback(
    () => setIsParameterEdit(false),
    []
  );

  const AlertComponent = useMemo(
    () => testCaseResultTabClassBase.getAlertBanner(),
    []
  );

  const testCaseParams = useMemo(() => {
    if (testCaseData?.useDynamicAssertion) {
      return (
        <label
          className="d-inline-flex items-center gap-2 text-grey-muted parameter-value-container"
          data-testid="dynamic-assertion">
          <Icon component={StarIcon} /> {t('label.dynamic-assertion')}
        </label>
      );
    } else if (!isEmpty(withoutSqlParams)) {
      return (
        <Space
          wrap
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
      );
    }

    return (
      <Typography.Text type="secondary">
        {t('label.no-parameter-available')}
      </Typography.Text>
    );
  }, [withoutSqlParams, testCaseData]);

  return (
    <Row
      className="p-lg test-case-result-tab"
      data-testid="test-case-result-tab-container"
      gutter={[0, 20]}>
      <Col span={24}>
        <DescriptionV1
          description={testCaseData?.description}
          entityType={EntityType.TEST_CASE}
          hasEditAccess={hasEditDescriptionPermission}
          showCommentsIcon={false}
          onDescriptionUpdate={handleDescriptionChange}
        />
      </Col>

      <Col data-testid="parameter-container" span={24}>
        <Space direction="vertical" size="small">
          <Space align="center" size={8}>
            <Typography.Text className="right-panel-label">
              {t('label.parameter-plural')}
            </Typography.Text>
            {hasEditPermission &&
              Boolean(
                withoutSqlParams.length || testCaseData?.useDynamicAssertion
              ) && (
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

          {testCaseParams}
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
                <Space align="center" size={8}>
                  <Typography.Text className="right-panel-label">
                    {startCase(param.name)}
                  </Typography.Text>
                  {hasEditPermission && (
                    <Tooltip
                      title={t('label.edit-entity', {
                        entity: t('label.parameter'),
                      })}>
                      <Icon
                        component={EditIcon}
                        data-testid="edit-sql-param-icon"
                        style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                        onClick={() => setIsParameterEdit(true)}
                      />
                    </Tooltip>
                  )}
                </Space>
              </Col>
              <Col span={24}>
                <SchemaEditor
                  className="custom-code-mirror-theme query-editor-min-h-60"
                  editorClass="table-query-editor"
                  mode={{ name: CSMode.SQL }}
                  options={{
                    styleActiveLine: false,
                    readOnly: true,
                  }}
                  value={param.value ?? ''}
                />
              </Col>
            </Row>
          ))}
        </Col>
      ) : null}

      {showAILearningBanner &&
        testCaseData?.useDynamicAssertion &&
        AlertComponent && (
          <Col span={24}>
            <AlertComponent />
          </Col>
        )}
      {testCaseData && (
        <Col className="test-case-result-tab-graph" span={24}>
          <TestSummary data={testCaseData} />
        </Col>
      )}

      {!isEmpty(additionalComponent) &&
        additionalComponent.map(({ Component, id }) => (
          <Component key={id} testCaseData={testCaseData} />
        ))}

      {testCaseData && isParameterEdit && (
        <EditTestCaseModal
          showOnlyParameter
          testCase={testCaseData}
          visible={isParameterEdit}
          onCancel={handleCancelParameter}
          onUpdate={setTestCase}
        />
      )}
    </Row>
  );
};

export default TestCaseResultTab;
