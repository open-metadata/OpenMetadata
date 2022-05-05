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
import { compare } from 'fast-json-patch';
import React, { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getUserByName, updateUserDetail } from '../../axiosAPIs/userAPI';
import BotsDetail from '../../components/BotsDetail/BotsDetail.component';
import Loader from '../../components/Loader/Loader';
import { UserDetails } from '../../components/Users/Users.interface';
import { User } from '../../generated/entity/teams/user';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const BotsPage = () => {
  const { botsName } = useParams<{ [key: string]: string }>();

  const [botsData, setBotsData] = useState<User>({} as User);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBotsData = () => {
    setIsLoading(true);
    getUserByName(botsName)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setBotsData(res.data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-user-details-error']
        );
      })
      .finally(() => setIsLoading(false));
  };

  const updateBotsDetails = (data: UserDetails) => {
    const updatedDetails = { ...botsData, ...data };
    const jsonPatch = compare(botsData, updatedDetails);
    updateUserDetail(botsData.id, jsonPatch)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setBotsData((prevData) => ({ ...prevData, ...data }));
        } else {
          throw jsonData['api-error-messages']['unexpected-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  useEffect(() => {
    fetchBotsData();
  }, [botsName]);

  return (
    <Fragment>
      {isLoading ? (
        <Loader />
      ) : (
        <BotsDetail botsData={botsData} updateBotsDetails={updateBotsDetails} />
      )}
    </Fragment>
  );
};

export default BotsPage;
