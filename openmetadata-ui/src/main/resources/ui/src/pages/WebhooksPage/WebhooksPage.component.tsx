/*
 *  Copyright 2021 Collate
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
import { Paging } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getWebhooks } from '../../axiosAPIs/webhookAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import Webhooks from '../../components/Webhooks/Webhooks';
import {
  getEditWebhookPath,
  pagingObject,
  ROUTES,
} from '../../constants/constants';
import { Status, Webhook } from '../../generated/entity/events/webhook';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const WebhooksPage: FunctionComponent = () => {
  const history = useHistory();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [data, setData] = useState<Array<Webhook>>([]);
  const [selectedStatus, setSelectedStatus] = useState<Status[]>([]);

  const fetchData = (paging?: string) => {
    setIsLoading(true);
    getWebhooks(paging)
      .then((res) => {
        if (res.data?.data) {
          setData(res.data.data);
          setPaging(res.data.paging);
        } else {
          setData([]);
          setPaging(pagingObject);

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

  const handlePageChange = (cursorType: string) => {
    const pagingString = `&${cursorType}=${
      paging[cursorType as keyof typeof paging]
    }`;
    fetchData(pagingString);
  };

  const handleStatusFilter = (status: Status[]) => {
    setSelectedStatus(status);
  };

  const handleAddWebhook = () => {
    history.push(ROUTES.ADD_WEBHOOK);
  };

  const handleClickWebhook = (name: string) => {
    history.push(getEditWebhookPath(name));
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <PageContainerV1 className="tw-pt-4">
      {!isLoading ? (
        <Webhooks
          data={data}
          paging={paging}
          selectedStatus={selectedStatus}
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

export default WebhooksPage;
