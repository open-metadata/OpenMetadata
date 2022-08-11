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

import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getWebhooks } from '../../axiosAPIs/webhookAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import WebhooksV1 from '../../components/Webhooks/WebhooksV1';
import {
  getAddWebhookPath,
  getEditWebhookPath,
} from '../../constants/constants';
import { WebhookType } from '../../generated/api/events/createWebhook';
import { Status, Webhook } from '../../generated/entity/events/webhook';
import { Paging } from '../../generated/type/paging';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

export const SlackSettingsPage = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<Webhook[]>([]);

  const history = useHistory();

  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [selectedStatus, setSelectedStatus] = useState<Status[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = (paging?: string) => {
    setIsLoading(true);
    getWebhooks(paging)
      .then((response) => {
        if (response.data) {
          // TODO: We are expecting filter support from BE (backend)
          // Once we got it remove below lines and provide filter API calls
          const slackData = response.data.filter(
            (res) => res.webhookType === 'slack'
          );
          setData(slackData);
          setData(slackData);
          setPaging(response.paging);
        } else {
          setData([]);
          setPaging({} as Paging);

          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-webhook-error']
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handlePageChange = (
    cursorType: string | number,
    activePage?: number
  ) => {
    const pagingString = `&${cursorType}=${
      paging[cursorType as keyof typeof paging]
    }`;
    fetchData(pagingString);
    setCurrentPage(activePage ?? 1);
  };

  const handleStatusFilter = (status: Status[]) => {
    setSelectedStatus(status);
  };

  const handleClickWebhook = (name: string) => {
    history.push(getEditWebhookPath(name));
  };

  const handleAddWebhook = () => {
    history.push(getAddWebhookPath(WebhookType.Slack));
  };

  const fetchSlackData = async () => {
    try {
      const response = await getWebhooks();

      if (response.data) {
        const slackData = response.data.filter(
          (res) => res.webhookType === 'slack'
        );
        setData(slackData);
      }
      setIsLoading(false);
    } catch (error) {
      setData([]);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSlackData();
  }, []);

  return (
    <PageContainerV1 className="tw-pt-4">
      {!isLoading ? (
        <WebhooksV1
          currentPage={currentPage}
          data={data}
          paging={paging}
          selectedStatus={selectedStatus}
          webhookType={WebhookType.Slack}
          onAddWebhook={handleAddWebhook}
          onClickWebhook={handleClickWebhook}
          onPageChange={handlePageChange}
          onStatusFilter={handleStatusFilter}
        />
      ) : (
        <Loader />
      )}
    </PageContainerV1>
  );
};

export default SlackSettingsPage;
