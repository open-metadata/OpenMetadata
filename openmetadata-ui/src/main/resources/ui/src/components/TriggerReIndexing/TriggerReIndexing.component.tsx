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

import { AxiosError } from 'axios';
import { useWebSocketConnector } from 'components/web-scoket/web-scoket.provider';
import {
  ELASTIC_SEARCH_INDEX_ENTITIES,
  ELASTIC_SEARCH_INITIAL_VALUES,
} from 'constants/elasticsearch.constant';
import { ELASTIC_SEARCH_RE_INDEX_PAGE_TABS } from 'enums/ElasticSearch.enum';
import { isEqual } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  getBatchJobReIndexStatus,
  getStreamJobReIndexStatus,
  reIndexByPublisher,
} from 'rest/elasticSearchReIndexAPI';
import { SOCKET_EVENTS } from '../../constants/constants';
import { CreateEventPublisherJob } from '../../generated/api/createEventPublisherJob';
import {
  EventPublisherJob,
  RunMode,
} from '../../generated/system/eventPublisherJob';
import { getJobDetailsCard } from '../../utils/EventPublisherUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ReIndexAllModal from './ElasticSearchReIndexModal.component';

function TriggerReIndexing() {
  const { t } = useTranslation();
  const { fqn } = useParams<{ fqn: string }>();
  const [batchJobData, setBatchJobData] = useState<EventPublisherJob>();
  const [streamJobData, setStreamJobData] = useState<EventPublisherJob>();

  const [batchLoading, setBatchLoading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { socket } = useWebSocketConnector();

  const isOnDemandTab = useMemo(
    () => fqn === ELASTIC_SEARCH_RE_INDEX_PAGE_TABS.ON_DEMAND,
    [fqn]
  );

  const handleModalVisibility = (state: boolean) => {
    setIsModalOpen(state);
  };

  const fetchBatchReIndexedData = useCallback(async () => {
    try {
      setBatchLoading(true);
      const response = await getBatchJobReIndexStatus();

      setBatchJobData(response);
    } catch {
      showErrorToast(t('server.fetch-re-index-data-error'));
    } finally {
      setBatchLoading(false);
    }
  }, [setBatchJobData, setBatchLoading]);

  const fetchStreamReIndexedData = useCallback(async () => {
    try {
      setStreamLoading(true);
      const response = await getStreamJobReIndexStatus();

      setStreamJobData(response);
    } catch {
      showErrorToast(t('server.fetch-re-index-data-error'));
    } finally {
      setStreamLoading(false);
    }
  }, [setStreamJobData, setStreamLoading]);

  const performReIndexAll = useCallback(
    async (data: CreateEventPublisherJob) => {
      try {
        setConfirmLoading(true);
        await reIndexByPublisher({
          ...data,
          entities: isEqual(
            data.entities,
            ELASTIC_SEARCH_INITIAL_VALUES.entities
          )
            ? ELASTIC_SEARCH_INDEX_ENTITIES.map((e) => e.value)
            : data.entities ?? [],
          runMode: RunMode.Batch,
        } as CreateEventPublisherJob);

        showSuccessToast(t('server.re-indexing-started'));
      } catch (err) {
        showErrorToast(err as AxiosError, t('server.re-indexing-error'));
      } finally {
        setIsModalOpen(false);
        setConfirmLoading(false);
      }
    },
    [setIsModalOpen, setConfirmLoading]
  );

  useEffect(() => {
    if (socket) {
      socket.on(SOCKET_EVENTS.JOB_STATUS, (newActivity) => {
        if (newActivity) {
          const activity = JSON.parse(newActivity) as EventPublisherJob;
          if (activity.runMode === RunMode.Batch) {
            setBatchJobData(activity);
          } else {
            setStreamJobData(activity);
          }
        }
      });
    }

    return () => {
      socket && socket.off(SOCKET_EVENTS.JOB_STATUS);
    };
  }, [socket]);

  const jobDetailsCard = useMemo(
    () =>
      isOnDemandTab
        ? getJobDetailsCard(
            batchLoading,
            fetchBatchReIndexedData,
            batchJobData,
            batchJobData?.failure?.sourceError,
            handleModalVisibility
          )
        : getJobDetailsCard(
            streamLoading,
            fetchStreamReIndexedData,
            streamJobData,
            streamJobData?.failure?.sinkError
          ),
    [
      isOnDemandTab,
      batchLoading,
      streamLoading,
      fetchBatchReIndexedData,
      fetchStreamReIndexedData,
      batchJobData,
      streamJobData,
    ]
  );

  useEffect(() => {
    if (isOnDemandTab) {
      fetchBatchReIndexedData();
    } else {
      fetchStreamReIndexedData();
    }
  }, [isOnDemandTab]);

  return (
    <>
      {jobDetailsCard}
      <ReIndexAllModal
        confirmLoading={confirmLoading}
        visible={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSave={performReIndexAll}
      />
    </>
  );
}

export default TriggerReIndexing;
