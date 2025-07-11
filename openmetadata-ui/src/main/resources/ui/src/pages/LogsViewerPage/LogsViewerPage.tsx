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

import { DownloadOutlined } from '@ant-design/icons';
import { LazyLog } from '@melloware/react-logviewer';
import { Button, Col, Progress, Row, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isNil, isUndefined, round, toNumber } from 'lodash';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CopyToClipboardButton } from '../../components/common/CopyToClipboardButton/CopyToClipboardButton';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { IngestionRecentRuns } from '../../components/Settings/Services/Ingestion/IngestionRecentRun/IngestionRecentRuns.component';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { TabSpecificField } from '../../enums/entity.enum';
import { PipelineType } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { App, AppScheduleClass } from '../../generated/entity/applications/app';
import {
  IngestionPipeline,
  PipelineStatus,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { useDownloadProgressStore } from '../../hooks/useDownloadProgressStore';
import { useFqn } from '../../hooks/useFqn';
import {
  getApplicationByName,
  getExternalApplicationRuns,
  getLatestApplicationRuns,
} from '../../rest/applicationAPI';
import {
  getIngestionPipelineByFqn,
  getIngestionPipelineLogById,
} from '../../rest/ingestionPipelineAPI';
import { getEpochMillisForPastDays } from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  downloadAppLogs,
  downloadIngestionLog,
} from '../../utils/IngestionLogs/LogsUtils';
import logsClassBase from '../../utils/LogsClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './logs-viewer-page.style.less';
import { LogViewerParams } from './LogsViewerPage.interfaces';
import LogViewerPageSkeleton from './LogsViewerPageSkeleton.component';

const LogsViewerPage = () => {
  const { logEntityType } = useRequiredParams<LogViewerParams>();
  const { fqn: ingestionName } = useFqn();

  const { t } = useTranslation();
  const { progress, reset, updateProgress } = useDownloadProgressStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<string>('');
  const [ingestionDetails, setIngestionDetails] = useState<IngestionPipeline>();
  const [appData, setAppData] = useState<App>();
  const [appRuns, setAppRuns] = useState<PipelineStatus[]>([]);
  const [paging, setPaging] = useState<Paging>();
  const [isLogsLoading, setIsLogsLoading] = useState(true);

  const isApplicationType = useMemo(
    () => logEntityType === GlobalSettingOptions.APPLICATIONS,
    [logEntityType]
  );

  const fetchLogs = async (
    ingestionId?: string,
    pipelineType?: PipelineType
  ) => {
    setIsLogsLoading(true);
    try {
      if (isApplicationType) {
        const currentTime = Date.now();
        const oneDayAgo = getEpochMillisForPastDays(1);
        const { data } = await getExternalApplicationRuns(ingestionName, {
          startTs: oneDayAgo,
          endTs: currentTime,
        });

        const logs = await getLatestApplicationRuns(ingestionName);
        setAppRuns(data);
        setLogs(logs.data_insight_task || logs.application_task);

        return;
      }
      const res = await getIngestionPipelineLogById(
        ingestionId || ingestionDetails?.id || '',
        paging?.total !== paging?.after ? paging?.after : ''
      );

      setPaging({
        after: res.data.after,
        total: toNumber(res.data.total),
      });

      switch (pipelineType || ingestionDetails?.pipelineType) {
        case PipelineType.Metadata:
          setLogs(logs.concat(res.data?.ingestion_task ?? ''));

          break;
        case PipelineType.Application:
          setLogs(logs.concat(res.data?.application_task ?? ''));

          break;
        case PipelineType.Profiler:
          setLogs(logs.concat(res.data?.profiler_task ?? ''));

          break;
        case PipelineType.Usage:
          setLogs(logs.concat(res.data?.usage_task ?? ''));

          break;
        case PipelineType.Lineage:
          setLogs(logs.concat(res.data?.lineage_task ?? ''));

          break;
        case PipelineType.Dbt:
          setLogs(logs.concat(res.data?.dbt_task ?? ''));

          break;
        case PipelineType.TestSuite:
          setLogs(logs.concat(res.data?.test_suite_task ?? ''));

          break;
        case PipelineType.DataInsight:
          setLogs(logs.concat(res.data?.data_insight_task ?? ''));

          break;

        case PipelineType.ElasticSearchReindex:
          setLogs(logs.concat(res.data?.elasticsearch_reindex_task ?? ''));

          break;

        case PipelineType.AutoClassification:
          setLogs(logs.concat(res.data?.auto_classification_task ?? ''));

          break;

        default:
          setLogs('');

          break;
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLogsLoading(false);
    }
  };

  const fetchIngestionDetailsByName = async () => {
    try {
      setIsLoading(true);
      const res = await getIngestionPipelineByFqn(ingestionName, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.PIPELINE_STATUSES],
      });
      if (res) {
        setIngestionDetails(res);

        fetchLogs(res.id, res.pipelineType);
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getApplicationByName(ingestionName, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      });
      setAppData(data);
      fetchLogs();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [ingestionName]);

  const fetchMoreLogs = () => {
    fetchLogs(ingestionDetails?.id, ingestionDetails?.pipelineType);
  };

  useEffect(() => {
    if (isApplicationType) {
      fetchAppDetails();
    } else {
      fetchIngestionDetailsByName();
    }
  }, []);

  const handleScroll = (event: Event) => {
    const targetElement = event.target as HTMLDivElement;

    const scrollTop = targetElement.scrollTop;
    const scrollHeight = targetElement.scrollHeight;
    const clientHeight = targetElement.clientHeight;
    const isBottom = clientHeight + scrollTop === scrollHeight;

    if (
      !isLogsLoading &&
      isBottom &&
      !isNil(paging) &&
      !isUndefined(paging.after) &&
      toNumber(paging?.after) < toNumber(paging?.total)
    ) {
      fetchMoreLogs();
    }

    return;
  };

  useLayoutEffect(() => {
    const logBody = document.getElementsByClassName(
      'ReactVirtualized__Grid'
    )[0];

    if (logBody) {
      logBody.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      logBody && logBody.removeEventListener('scroll', handleScroll);
    };
  });

  useLayoutEffect(() => {
    const lazyLogSearchBarInput = document.getElementsByClassName(
      'react-lazylog-searchbar-input'
    )[0] as HTMLInputElement;

    if (lazyLogSearchBarInput) {
      lazyLogSearchBarInput.placeholder = `${t('label.search-entity', {
        entity: t('label.log-plural'),
      })}...`;
    }
  });

  const handleJumpToEnd = () => {
    const logsBody = document.getElementsByClassName(
      'ReactVirtualized__Grid'
    )[0];

    if (!isNil(logsBody)) {
      logsBody.scrollTop = logsBody.scrollHeight;
    }
  };

  const recentRuns = useMemo(() => {
    if (!isUndefined(ingestionDetails) || appRuns) {
      return (
        <IngestionRecentRuns
          appRuns={appRuns}
          fetchStatus={!isApplicationType}
          ingestion={ingestionDetails}
        />
      );
    }

    return '--';
  }, [isApplicationType, appRuns, ingestionDetails]);

  const logSummaries = useMemo(() => {
    const scheduleClass = appData?.appSchedule as AppScheduleClass;

    return {
      Type:
        ingestionDetails?.pipelineType ??
        scheduleClass?.scheduleTimeline ??
        '--',
      Schedule:
        ingestionDetails?.airflowConfig.scheduleInterval ??
        scheduleClass?.cronExpression ??
        '--',
      ['Recent Runs']: recentRuns,
    };
  }, [ingestionDetails, appData, recentRuns]);

  const handleIngestionDownloadClick = async () => {
    try {
      reset();
      const progress = round(
        (Number(paging?.after) * 100) / Number(paging?.total)
      );

      updateProgress(paging?.after ? progress : 1);
      let logs = '';
      let fileName = `${getEntityName(ingestionDetails)}-${
        ingestionDetails?.pipelineType
      }.log`;
      if (isApplicationType) {
        logs = await downloadAppLogs(ingestionName);
        fileName = `${ingestionName}.log`;
      } else {
        logs = await downloadIngestionLog(
          ingestionDetails?.id,
          ingestionDetails?.pipelineType
        );
      }

      const element = document.createElement('a');
      const file = new Blob([logs || ''], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = fileName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
      reset();
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.log-viewer')}>
      <Space align="start" className="w-full m-md m-t-xs" direction="vertical">
        <Space align="center">
          <TitleBreadcrumb
            titleLinks={logsClassBase.getLogBreadCrumbs(
              logEntityType,
              ingestionName,
              ingestionDetails
            )}
          />
        </Space>
        <Space>
          <Typography.Title level={5}>
            {ingestionDetails?.name ?? appData?.name}
          </Typography.Title>
        </Space>
      </Space>

      {!isEmpty(logs) ? (
        <>
          {/* Summary section moved to header */}
          <Space
            className="p-md w-full border-top border-bottom"
            data-testid="summary-card"
            direction="vertical">
            <Typography.Title level={5}>
              {t('label.summary')}
            </Typography.Title>

            <div>
              <Typography.Text type="secondary">
                {t('label.basic-configuration')}
              </Typography.Text>

              <Row className="m-t-xs" gutter={[16, 8]}>
                {Object.entries(logSummaries).map(([key, value]) => {
                  return (
                    <Fragment key={key}>
                      <Col className="summary-key" xs={24} sm={12} md={8} lg={6}>
                        <strong>{key}:</strong>
                      </Col>
                      <Col className="flex" xs={24} sm={12} md={16} lg={18}>
                        {value}
                      </Col>
                    </Fragment>
                  );
                })}
              </Row>
            </div>
          </Space>

          {/* Logs section now takes full width */}
          <Row>
            <Col className="p-md" span={24}>
              <Row className="relative" gutter={[16, 16]}>
                <Col span={24}>
                  <Row justify="end">
                    <Col>
                      <Button
                        ghost
                        data-testid="jump-to-end-button"
                        type="primary"
                        onClick={handleJumpToEnd}>
                        {t('label.jump-to-end')}
                      </Button>
                    </Col>
                    <Col>
                      <CopyToClipboardButton copyText={logs} />
                    </Col>
                    <Col>
                      {progress ? (
                        <Tooltip title={`${progress}%`}>
                          <Progress
                            className="h-8 m-l-md relative flex-center"
                            percent={progress}
                            strokeWidth={5}
                            type="circle"
                            width={32}
                          />
                        </Tooltip>
                      ) : (
                        <Button
                          className="h-8 m-l-md relative flex-center"
                          data-testid="download"
                          icon={
                            <DownloadOutlined
                              data-testid="download-icon"
                              width="16"
                            />
                          }
                          type="text"
                          onClick={handleIngestionDownloadClick}
                        />
                      )}
                    </Col>
                  </Row>
                </Col>
                <Col
                  className="h-min-80 lazy-log-container"
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
            </Col>
          </Row>
        </>
      ) : (
        <LogViewerPageSkeleton />
      )}
    </PageLayoutV1>
  );
};

export default LogsViewerPage;
