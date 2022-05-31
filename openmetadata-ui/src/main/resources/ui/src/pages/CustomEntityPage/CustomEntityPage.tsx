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
import { useParams } from 'react-router-dom';
import { getTypeListByCategory } from '../../axiosAPIs/metadataTypeAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import CustomEntityDetail from '../../components/CustomEntityDetail/CustomEntityDetail';
import Loader from '../../components/Loader/Loader';
import { Category, Type } from '../../generated/entity/type';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const CustomEntityPage = () => {
  const { entityTypeFQN } = useParams<{ [key: string]: string }>();
  const [entityTypes, setEntityTypes] = useState<Array<Type>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const fetchEntityType = () => {
    setIsLoading(true);
    getTypeListByCategory(Category.Entity)
      .then((res: AxiosResponse) => {
        setEntityTypes(res.data.data);
      })
      .catch((err: AxiosError) => {
        setIsError(true);
        showErrorToast(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchEntityType();
  }, []);

  const Component = () =>
    isError ? (
      <ErrorPlaceHolder>
        {jsonData['api-error-messages']['unexpected-server-response']}
      </ErrorPlaceHolder>
    ) : (
      <CustomEntityDetail
        entityTypeFQN={entityTypeFQN}
        entityTypes={entityTypes}
      />
    );

  return <Fragment>{isLoading ? <Loader /> : <Component />}</Fragment>;
};

export default CustomEntityPage;
