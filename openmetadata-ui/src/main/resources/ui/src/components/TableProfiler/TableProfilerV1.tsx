/*
 *  Copyright 2022 Collate
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
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatNumberWithComma,
  formTwoDigitNmber,
} from '../../utils/CommonUtils';
import { getCurrentDatasetTab } from '../../utils/DatasetDetailsUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import ColumnProfileTable from './Component/ColumnProfileTable';
import ProfilerSettingsModal from './Component/ProfilerSettingsModal';
import {
  OverallTableSummeryType,
  TableProfilerProps,
} from './TableProfiler.interface';
import './tableProfiler.less';

const TableProfilerV1: FC<TableProfilerProps> = ({ table, onAddTestClick }) => {
  const { tableProfile, columns } = table;
  const [settingModalVisible, setSettingModalVisible] = useState(false);

  const handleSettingModal = (value: boolean) => {
    setSettingModalVisible(value);
  };
  const overallSummery: OverallTableSummeryType[] = useMemo(() => {
    return [
      {
        title: 'Row Count',
        value: formatNumberWithComma(tableProfile?.rowCount ?? 0),
      },
      {
        title: 'Column Count',
        value: tableProfile?.columnCount ?? 0,
      },
      {
        title: 'Table Sample %',
        value: `${tableProfile?.profileSample ?? 0}%`,
      },
      {
        title: 'Success',
        value: formTwoDigitNmber(0),
        className: 'success',
      },
      {
        title: 'Aborted',
        value: formTwoDigitNmber(0),
        className: 'aborted',
      },
      {
        title: 'Failed',
        value: formTwoDigitNmber(0),
        className: 'failed',
      },
    ];
  }, [tableProfile]);

  if (isUndefined(tableProfile)) {
    return (
      <div
        className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8"
        data-testid="no-profiler-placeholder-container">
        <span>
          Data Profiler is an optional configuration in Ingestion. Please enable
          the data profiler by following the documentation
        </span>
        <Link
          className="tw-ml-1"
          target="_blank"
          to={{
            pathname: 'https://docs.open-metadata.org/connectors',
          }}>
          here.
        </Link>
      </div>
    );
  }

  return (
    <div
      className="table-profiler-container"
      data-testid="table-profiler-container">
      <div className="tw-flex tw-justify-end tw-gap-4 tw-mb-4">
        <Button
          className="tw-rounded"
          data-testid="profiler-add-table-test-btn"
          type="primary"
          onClick={() =>
            onAddTestClick(getCurrentDatasetTab('data-quality'), 'table')
          }>
          Add Test
        </Button>
        <Button
          className="profiler-setting-btn tw-border tw-border-primary tw-rounded tw-text-primary"
          data-testid="profiler-setting-btn"
          icon={<SVGIcons alt="setting" icon={Icons.SETTINGS_PRIMERY} />}
          type="default"
          onClick={() => handleSettingModal(true)}>
          Settings
        </Button>
      </div>

      <Row className="tw-rounded tw-border tw-p-4 tw-mb-4">
        {overallSummery.map((summery) => (
          <Col
            className="overall-summery-card"
            data-testid={`header-card-${summery.title}`}
            key={summery.title}
            span={4}>
            <p className="overall-summery-card-title tw-font-medium tw-text-grey-muted tw-mb-1">
              {summery.title}
            </p>
            <p
              className={classNames(
                'tw-text-2xl tw-font-semibold',
                summery.className
              )}>
              {summery.value}
            </p>
          </Col>
        ))}
      </Row>

      <ColumnProfileTable
        columnProfile={(tableProfile?.columnProfile || []).map((col) => ({
          ...col,
          key: col.name,
        }))}
        columns={columns}
        onAddTestClick={onAddTestClick}
      />

      <ProfilerSettingsModal
        columnProfile={tableProfile.columnProfile || []}
        tableId={table.id}
        visible={settingModalVisible}
        onVisibilityChange={handleSettingModal}
      />
    </div>
  );
};

export default TableProfilerV1;
