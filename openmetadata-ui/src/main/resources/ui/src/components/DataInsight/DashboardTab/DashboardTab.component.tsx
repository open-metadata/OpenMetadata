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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Space } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { AdvanceSearchProvider } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import PageHeader from '../../PageHeader/PageHeader.component';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ChartWidgetForm from './WidgetForm/ChartWidgetForm.component';
import TableWidgetForm from './WidgetForm/TableWidgetForm.component';

const DashboardTab = () => {
  const { t } = useTranslation();
  const [activeWidgetForm, setActiveWidgetForm] = useState<string | undefined>(
    'chart'
  );
  const onWidgetFormCancel = () => setActiveWidgetForm(undefined);

  if (activeWidgetForm === 'chart') {
    return (
      <AdvanceSearchProvider>
        <ChartWidgetForm onCancel={onWidgetFormCancel} />
      </AdvanceSearchProvider>
    );
  }
  if (activeWidgetForm === 'table') {
    return <TableWidgetForm onCancel={onWidgetFormCancel} />;
  }

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card
          className="data-insight-card"
          data-testid="chart-1"
          id="chart-1"
          title={
            <PageHeader
              data={{
                header: 'Chart',
                subHeader: 'Add a chart here',
              }}
            />
          }>
          <Space
            className="w-full justify-center items-center"
            direction="vertical">
            <ErrorPlaceHolder
              permission
              button={
                <Button
                  ghost
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={() => setActiveWidgetForm('chart')}>
                  {t('label.add-entity', {
                    entity: t('label.kpi-uppercase'),
                  })}
                </Button>
              }
              className="m-0" // add permission here
              size={SIZE.MEDIUM}
              type={ERROR_PLACEHOLDER_TYPE.ASSIGN}>
              Add new chart from here
            </ErrorPlaceHolder>
          </Space>
        </Card>
      </Col>
      <Col span={24}>
        <Card
          className="data-insight-card"
          data-testid="chart-1"
          id="chart-1"
          title={
            <PageHeader
              data={{
                header: 'Table',
                subHeader: 'Add Table here',
              }}
            />
          }>
          <Space
            className="w-full justify-center items-center"
            direction="vertical">
            <ErrorPlaceHolder
              permission
              button={
                <Button
                  ghost
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={() => setActiveWidgetForm('table')}>
                  {t('label.add-entity', {
                    entity: t('label.kpi-uppercase'),
                  })}
                </Button>
              }
              className="m-0" // add permission here
              size={SIZE.MEDIUM}
              type={ERROR_PLACEHOLDER_TYPE.ASSIGN}>
              Add new table from here
            </ErrorPlaceHolder>
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

export default DashboardTab;
