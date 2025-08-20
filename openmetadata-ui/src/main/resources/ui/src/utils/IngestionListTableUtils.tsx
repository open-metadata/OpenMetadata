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

import Icon from '@ant-design/icons';
import { Col, Row, Tag, Typography } from 'antd';
import classNames from 'classnames';
import cronstrue from 'cronstrue/i18n';
import { capitalize, isUndefined, startCase } from 'lodash';
import ActiveIcon from '../assets/svg/check-colored.svg?react';
import PausedIcon from '../assets/svg/ic-pause.svg?react';
import TimeDateIcon from '../assets/svg/time-date.svg?react';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import {
  IngestionPipeline,
  PipelineType,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getEntityName, highlightSearchText } from './EntityUtils';
import { getCurrentLocaleForConstrue } from './i18next/i18nextUtil';
import { t } from './i18next/LocalUtil';
import { stringToHTML } from './StringsUtils';

export const renderNameField =
  (searchText?: string) => (_: string, record: IngestionPipeline) =>
    (
      <Typography.Text
        className="m-b-0 d-block break-word"
        data-testid="pipeline-name">
        {stringToHTML(highlightSearchText(getEntityName(record), searchText))}
      </Typography.Text>
    );

export const renderTypeField =
  (searchText?: string) => (_: string, record: IngestionPipeline) => {
    const typeText =
      record.pipelineType === PipelineType.Dbt
        ? record.pipelineType
        : startCase(record.pipelineType);

    return (
      <Typography.Text
        className="m-b-0 d-block break-word"
        data-testid="pipeline-type">
        {stringToHTML(highlightSearchText(typeText, searchText))}
      </Typography.Text>
    );
  };

export const renderStatusField = (_: string, record: IngestionPipeline) => {
  const statusIcon = record.enabled ? ActiveIcon : PausedIcon;

  return (
    <Tag
      className={classNames(
        'ingestion-run-badge latest pipeline-status',
        record.enabled ? 'success' : 'paused'
      )}
      data-testid="pipeline-active-status">
      <Icon component={statusIcon} />
      {record.enabled ? t('label.active') : t('label.paused')}
    </Tag>
  );
};

export const renderScheduleField = (_: string, record: IngestionPipeline) => {
  if (isUndefined(record.airflowConfig?.scheduleInterval)) {
    return (
      <Typography.Text data-testid="scheduler-no-data">
        {NO_DATA_PLACEHOLDER}
      </Typography.Text>
    );
  }
  const scheduleDescription = cronstrue.toString(
    record.airflowConfig.scheduleInterval,
    {
      use24HourTimeFormat: false,
      verbose: true,
      locale: getCurrentLocaleForConstrue(), // To get localized string
    }
  );

  const firstSentenceEndIndex = scheduleDescription.indexOf(',');

  const descriptionFirstPart = scheduleDescription
    .slice(0, firstSentenceEndIndex)
    .trim();

  const descriptionSecondPart = capitalize(
    scheduleDescription.slice(firstSentenceEndIndex + 1).trim()
  );

  return (
    <Row gutter={[8, 8]} wrap={false}>
      <Col>
        <TimeDateIcon className="m-t-xss" height={20} width={20} />
      </Col>
      <Col>
        <Row className="line-height-16">
          <Col span={24}>
            <Typography.Text
              className="font-medium"
              data-testid="schedule-primary-details">
              {descriptionFirstPart}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <Typography.Text
              className="text-xs text-grey-muted"
              data-testid="schedule-secondary-details">
              {descriptionSecondPart}
            </Typography.Text>
          </Col>
        </Row>
      </Col>
    </Row>
  );
};
