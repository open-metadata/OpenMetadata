import { CloseOutlined } from '@ant-design/icons';
import { Col, Divider, Row, Space, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TableType } from '../../../generated/entity/data/table';
import ColumnSummary from '../ColumnSummary/ColumnSummary.component';
import {
  BasicTableInfo,
  EntitySummaryPanelProps,
} from './EntitySummaryPanel.interface';
import './EntitySummaryPanel.style.less';

export default function EntitySummaryPanel({
  entityDetails,
  handleClosePanel,
  overallSummery,
  showPanel,
}: EntitySummaryPanelProps) {
  const { t } = useTranslation();

  const { tableType, columns, tableQueries } = entityDetails;

  const basicTableInfo: BasicTableInfo = {
    Type: tableType || TableType.Regular,
    Queries: tableQueries?.length ? `${tableQueries?.length}` : '-',
    Columns: columns?.length ? `${columns?.length}` : '-',
  };

  return (
    <div
      className={classNames(
        'summary-panel-container',
        showPanel ? 'show-panel' : ''
      )}>
      <Space
        className={classNames('basic-info-container m-4')}
        direction="vertical">
        <Typography.Title level={5}>{entityDetails.name}</Typography.Title>
        <Space className={classNames('w-full')} direction="vertical">
          {Object.keys(basicTableInfo).map((fieldName) => (
            <Row gutter={16} key={fieldName}>
              <Col className="text-gray" span={10}>
                {fieldName}
              </Col>
              <Col span={12}>
                {basicTableInfo[fieldName as keyof BasicTableInfo]}
              </Col>
            </Row>
          ))}
        </Space>
      </Space>
      <Divider className="m-0" />
      <Space className={classNames('m-4')} direction="vertical">
        <Typography.Text className="section-header">
          {t('label.profiler-amp-data-quality')}
        </Typography.Text>
        <Row gutter={[16, 16]}>
          {overallSummery.map((field) => (
            <Col key={field.title} span={10}>
              <Space direction="vertical" size={6}>
                <Typography.Text className="text-gray">
                  {field.title}
                </Typography.Text>
                <Typography.Text
                  className={classNames(
                    'tw-text-2xl tw-font-semibold',
                    field.className
                  )}>
                  {field.value}
                </Typography.Text>
              </Space>
            </Col>
          ))}
        </Row>
      </Space>
      <Divider className="m-0" />
      <Space className={classNames('m-4')} direction="vertical">
        <Typography.Text className="section-header">
          {t('label.schema')}
        </Typography.Text>
        <ColumnSummary columns={columns} />
      </Space>
      <CloseOutlined className="close-icon" onClick={handleClosePanel} />
    </div>
  );
}
