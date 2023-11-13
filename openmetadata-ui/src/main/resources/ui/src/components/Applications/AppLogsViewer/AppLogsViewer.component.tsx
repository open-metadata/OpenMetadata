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

import { Badge, Button, Card, Col, Divider, Row, Space } from 'antd';
import { isEmpty, isNil } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LazyLog } from 'react-lazylog';
import { ReactComponent as IconSuccessBadge } from '../../../assets/svg/success-badge.svg';
import { formatDateTimeWithTimezone } from '../../../utils/date-time/DateTimeUtils';
import CopyToClipboardButton from '../../CopyToClipboardButton/CopyToClipboardButton';
import { AppLogsViewerProps, JobStats } from './AppLogsViewer.interface';

const AppLogsViewer = ({ data }: AppLogsViewerProps) => {
  const { t } = useTranslation();

  const { failureContext, successContext, timestamp } = useMemo(
    () => ({
      ...data,
    }),
    [data]
  );

  const hasSuccessStats = useMemo(
    () => !isEmpty(successContext?.stats),
    [successContext]
  );
  const hasFailureStats = useMemo(
    () => !isEmpty(failureContext?.stats),
    [failureContext]
  );

  const handleJumpToEnd = () => {
    const logsBody = document.getElementsByClassName(
      'ReactVirtualized__Grid'
    )[0];

    if (!isNil(logsBody)) {
      logsBody.scrollTop = logsBody.scrollHeight;
    }
  };

  const logsRender = useCallback(
    (logs: string) =>
      logs && (
        <Row className="p-t-sm">
          <Col className="d-flex justify-end" span={24}>
            <Space size="small">
              <Button
                ghost
                data-testid="jump-to-end-button"
                type="primary"
                onClick={handleJumpToEnd}>
                {t('label.jump-to-end')}
              </Button>

              <CopyToClipboardButton copyText={logs} />
            </Space>
          </Col>

          <Col
            className="p-t-md h-min-400 lazy-log-container"
            data-testid="lazy-log"
            span={24}>
            <LazyLog
              caseInsensitive
              enableSearch
              selectableLines
              extraLines={1} // 1 is to be add so that linux users can see last line of the log
              text={logs}
            />
          </Col>
        </Row>
      ),
    [handleJumpToEnd]
  );

  const statsRender = useCallback(
    (jobStats: JobStats) => (
      <Card size="small">
        <Row gutter={[16, 8]}>
          <Col span={24}>
            <Space wrap direction="horizontal" size={0}>
              <div className="flex">
                <span className="text-grey-muted">{`${t(
                  'label.status'
                )}:`}</span>

                <Space align="center" className="m-l-xs" size={8}>
                  <IconSuccessBadge height={14} width={14} />
                  <span>{t('label.success')}</span>
                </Space>
              </div>
              <Divider type="vertical" />
              <div className="flex">
                <span className="text-grey-muted">{`${t(
                  'label.index-states'
                )}:`}</span>
                <span className="m-l-xs">
                  <Space size={8}>
                    <Badge
                      className="request-badge running"
                      count={jobStats.totalRecords}
                      overflowCount={99999999}
                      title={`${t('label.total-index-sent')}: ${
                        jobStats.totalRecords
                      }`}
                    />

                    <Badge
                      className="request-badge success"
                      count={jobStats.successRecords}
                      overflowCount={99999999}
                      title={`${t('label.entity-index', {
                        entity: t('label.success'),
                      })}: ${jobStats.successRecords}`}
                    />

                    <Badge
                      showZero
                      className="request-badge failed"
                      count={jobStats.failedRecords}
                      overflowCount={99999999}
                      title={`${t('label.entity-index', {
                        entity: t('label.failed'),
                      })}: ${jobStats.failedRecords}`}
                    />
                  </Space>
                </span>
              </div>
              <Divider type="vertical" />
              <div className="flex">
                <span className="text-grey-muted">{`${t(
                  'label.last-updated'
                )}:`}</span>
                <span className="m-l-xs">
                  {timestamp ? formatDateTimeWithTimezone(timestamp) : '--'}
                </span>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>
    ),
    [timestamp, formatDateTimeWithTimezone]
  );

  const successContextRender = useMemo(
    () => (
      <>
        {hasSuccessStats && statsRender(successContext?.stats.jobStats)}
        {logsRender(successContext?.stackTrace)}
      </>
    ),
    [successContext]
  );

  const failureContextRender = useMemo(
    () => (
      <>
        {hasFailureStats && statsRender(failureContext?.stats.jobStats)}
        {logsRender(failureContext?.stackTrace)}
      </>
    ),
    [failureContext]
  );

  return successContext ? successContextRender : failureContextRender;
};

export default AppLogsViewer;
