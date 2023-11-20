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
import { Col, Divider, Row, Space, Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import '../resolution-center.less';
import { TestCaseResultTabProps } from './TestCaseResultTab.interface';

const TestCaseResultTab = ({ testCaseData }: TestCaseResultTabProps) => {
  const { t } = useTranslation();
  const [isDescriptionEdit, setIsDescriptionEdit] = useState<boolean>(false);
  const [isParameterEdit, setIsParameterEdit] = useState<boolean>(false);

  const hasEditPermission = true;

  const parameterValuesWithoutSqlExpression = useMemo(
    () =>
      testCaseData?.parameterValues && testCaseData.parameterValues.length > 0
        ? testCaseData.parameterValues.filter(
            (param) => param.name !== 'sqlExpression'
          )
        : undefined,
    [testCaseData?.parameterValues]
  );

  const handleDescriptionChange = useCallback(async (description: string) => {
    //   await updateUserDetails({ description });

    setIsDescriptionEdit(false);
  }, []);

  return (
    <Row className="p-lg" gutter={[0, 20]}>
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

      <Col span={24}>
        <Space direction="vertical" size="middle">
          <Space align="center" size="middle">
            <Typography.Text className="right-panel-label">
              {t('label.parameter-plural')}
            </Typography.Text>
            <Icon
              component={EditIcon}
              data-testid="edit-description"
              style={{ color: DE_ACTIVE_COLOR }}
              onClick={() => setIsParameterEdit(true)}
            />
          </Space>

          {!isEmpty(parameterValuesWithoutSqlExpression) &&
          !isUndefined(parameterValuesWithoutSqlExpression) ? (
            <Space className="parameter-value-container" size={6}>
              {parameterValuesWithoutSqlExpression.map((param, index) => (
                <Space key={param.name} size={4}>
                  <Typography.Text className="text-grey-muted">
                    {`${param.name}:`}
                  </Typography.Text>
                  <Typography.Text>{param.value}</Typography.Text>
                  {parameterValuesWithoutSqlExpression.length - 1 !== index && (
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
    </Row>
  );
};

export default TestCaseResultTab;
