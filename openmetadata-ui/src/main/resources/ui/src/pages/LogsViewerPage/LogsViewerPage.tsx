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
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { AxiosError } from 'axios';
import { isEmpty, isNil, isUndefined, toNumber } from 'lodash';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as TimeDateIcon } from '../../assets/svg/time-date.svg';
import { CopyToClipboardButton } from '../../components/common/CopyToClipboardButton/CopyToClipboardButton';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { IngestionRecentRuns } from '../../components/Settings/Services/Ingestion/IngestionRecentRun/IngestionRecentRuns.component';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
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
import { ExtraInfoLabel } from '../../utils/DataAssetsHeader.utils';
import {
  getEpochMillisForPastDays,
  getScheduleDescriptionTexts,
} from '../../utils/date-time/DateTimeUtils';
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

const LogsViewerPage = () => {
  const { logEntityType } = useRequiredParams<LogViewerParams>();
  const { fqn: ingestionName } = useFqn();

  const { t } = useTranslation();
  const theme = useTheme();
  const { progress, reset, updateProgress } = useDownloadProgressStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<string>('');
  const [ingestionDetails, setIngestionDetails] = useState<IngestionPipeline>();
  const [appData, setAppData] = useState<App>();
  const [appRuns, setAppRuns] = useState<PipelineStatus[]>([]);
  const [paging, setPaging] = useState<Paging>();
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const lazyLogRef = useRef<LazyLog>(null);

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
        paging?.total === paging?.after ? '' : paging?.after
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

  const fetchMoreLogs = useCallback(() => {
    fetchLogs(ingestionDetails?.id, ingestionDetails?.pipelineType);
  }, [ingestionDetails, fetchLogs]);

  const handleScroll = useCallback(
    (scrollValues: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
    }) => {
      const scrollTop = scrollValues.scrollTop;
      const scrollHeight = scrollValues.scrollHeight;
      const clientHeight = scrollValues.clientHeight;
      // Fetch more logs when user is at the bottom of the log
      // with a margin of about 40px (approximate height of one line)
      const isBottom = Math.abs(clientHeight + scrollTop - scrollHeight) < 40;

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
    },
    [isLogsLoading, paging, fetchMoreLogs]
  );

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

  const handleJumpToEnd = useCallback(() => {
    if (lazyLogRef.current?.listRef.current) {
      // Get the total number of lines
      const totalLines = lazyLogRef.current.state.count;
      // Scroll to the last line
      lazyLogRef.current.listRef.current.scrollToIndex(totalLines - 1);
    }
  }, [lazyLogRef.current]);

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

  const handleIngestionDownloadClick = useCallback(async () => {
    try {
      reset();
      updateProgress(1);
      let fileName = `${getEntityName(ingestionDetails)}-${
        ingestionDetails?.pipelineType
      }.log`;

      if (isApplicationType) {
        const logs = await downloadAppLogs(ingestionName);
        fileName = `${ingestionName}.log`;
        const element = document.createElement('a');
        const file = new Blob([logs || ''], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = fileName;
        document.body.appendChild(element);
        element.click();
        element.remove();
      } else {
        const logsBlob = await downloadIngestionLog(ingestionDetails?.id);

        const element = document.createElement('a');
        element.href = URL.createObjectURL(logsBlob as Blob);
        element.download = fileName;
        document.body.appendChild(element);
        element.click();
        element.remove();
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
      reset();
    }
  }, [
    ingestionDetails,
    ingestionName,
    isApplicationType,
    reset,
    updateProgress,
  ]);

  const logsSkeleton = useMemo(
    () => (
      <Stack data-testid="skeleton-container" spacing={4}>
        <Skeleton variant="text" width="50%" />
        <Skeleton sx={{ fontSize: '28px' }} variant="text" width="30%" />
        <Skeleton height={80} variant="rounded" />
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="flex-end"
          spacing={4}>
          <Skeleton height={30} variant="rounded" width={120} />
          <Skeleton height={30} variant="circular" width={30} />
          <Skeleton height={30} variant="circular" width={30} />
        </Stack>
        <Skeleton height="80vh" variant="rounded" />
      </Stack>
    ),
    []
  );

  const logsContainer = useMemo(() => {
    if (isLoading) {
      return logsSkeleton;
    }

    return (
      <Stack spacing={4}>
        <TitleBreadcrumb
          titleLinks={logsClassBase.getLogBreadCrumbs(
            logEntityType,
            ingestionName,
            ingestionDetails
          )}
        />
        <Typography variant="h6">
          {ingestionDetails?.name ?? appData?.name}
        </Typography>

        <Stack
          className="logs-viewer-header-container"
          data-testid="summary-card"
          direction="row"
          divider={<Divider flexItem orientation="vertical" />}
          spacing={2}>
          {Object.entries(logSummaries).map(([key, value]) => {
            let valueText = value;

            if (key === 'Schedule') {
              const { descriptionFirstPart, descriptionSecondPart } =
                getScheduleDescriptionTexts((value ?? '') as string);

              valueText = (
                <Stack alignItems="center" direction="row" spacing={1}>
                  <TimeDateIcon className="m-t-xss" height={20} width={20} />
                  <Stack spacing={1}>
                    <Typography
                      data-testid="schedule-primary-details"
                      sx={{
                        fontSize: 14,
                        fontWeight: 600,
                        lineHeight: '16px',
                        marginBottom: '0px !important',
                      }}
                      variant="body1">
                      {descriptionFirstPart}
                    </Typography>
                    <Typography
                      data-testid="schedule-secondary-details"
                      sx={{
                        fontSize: 12,
                        lineHeight: '14px',
                        marginBottom: '0px !important',
                        color: theme.palette.grey[500],
                      }}
                      variant="body1">
                      {descriptionSecondPart}
                    </Typography>
                  </Stack>
                </Stack>
              );
            }

            return (
              <Fragment key={key}>
                <ExtraInfoLabel label={key} value={valueText} />
              </Fragment>
            );
          })}
        </Stack>

        {isEmpty(logs) && !isLogsLoading ? (
          <Stack alignItems="center" height="50vh" justifyContent="center">
            <ErrorPlaceHolder
              className="bg-white"
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              {t('label.no-entity-available', {
                entity: t('label.log-lowercase-plural'),
              })}
            </ErrorPlaceHolder>
          </Stack>
        ) : (
          <Stack spacing={4}>
            <Stack
              alignItems="center"
              direction="row"
              justifyContent="flex-end"
              spacing={4}>
              <Button
                color="primary"
                data-testid="jump-to-end-button"
                size="small"
                variant="outlined"
                onClick={handleJumpToEnd}>
                {t('label.jump-to-end')}
              </Button>

              <CopyToClipboardButton copyText={logs} position="top" />

              {progress ? (
                <Tooltip
                  placement="top"
                  title={t('label.downloading-log-plural')}>
                  <CircularProgress size={16} />
                </Tooltip>
              ) : (
                <IconButton
                  data-testid="download"
                  sx={{ padding: 0 }}
                  onClick={handleIngestionDownloadClick}>
                  <DownloadOutlined data-testid="download-icon" width="16" />
                </IconButton>
              )}
            </Stack>

            <Box className="h-80vh lazy-log-container" data-testid="lazy-log">
              <LazyLog
                caseInsensitive
                enableSearch
                selectableLines
                extraLines={1} // 1 is to be add so that linux users can see last line of the log
                loading={isLogsLoading}
                ref={lazyLogRef}
                text={logs}
                onScroll={handleScroll}
              />
            </Box>
          </Stack>
        )}
      </Stack>
    );
  }, [
    isLoading,
    isLogsLoading,
    logs,
    logsSkeleton,
    logEntityType,
    ingestionName,
    ingestionDetails,
    appData,
    logSummaries,
    progress,
    handleJumpToEnd,
    handleIngestionDownloadClick,
    handleScroll,
  ]);

  useEffect(() => {
    if (isApplicationType) {
      fetchAppDetails();
    } else {
      fetchIngestionDetailsByName();
    }
  }, []);

  return (
    <PageLayoutV1 pageTitle={t('label.log-viewer')}>
      {logsContainer}
    </PageLayoutV1>
  );
};

export default LogsViewerPage;
