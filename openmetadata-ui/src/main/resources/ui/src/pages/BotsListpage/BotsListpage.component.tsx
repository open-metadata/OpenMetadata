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

import { AxiosError, AxiosResponse } from 'axios';
import React, { Fragment, useEffect, useState } from 'react';
import { getUsers } from '../../axiosAPIs/userAPI';
import BotsList from '../../components/BotsList/BotsList';
import Loader from '../../components/Loader/Loader';
import { User } from '../../generated/entity/teams/user';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const BotsListPage = () => {
  const [bots, setBots] = useState<Array<User>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchBots = () => {
    setIsLoading(true);
    getUsers('', 1000)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { data } = res.data;
          const botsUser = data.filter((user: User) => user?.isBot);
          setBots(botsUser);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchBots();
  }, []);

  return (
    <Fragment>
      {isLoading ? <Loader /> : <BotsList bots={bots || []} />}
    </Fragment>
  );
};

export default BotsListPage;
