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
import { getTypeListByCategory } from '../../axiosAPIs/metadataTypeAPI';
import CustomEntityDetail from '../../components/CustomEntityDetail/CustomEntityDetail';
import Loader from '../../components/Loader/Loader';
import { Category, Type } from '../../generated/entity/type';
import { showErrorToast } from '../../utils/ToastUtils';

const CustomEntityPage = () => {
  const [entityTypes, setEntityTypes] = useState<Array<Type>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchEntityType = () => {
    setIsLoading(true);
    getTypeListByCategory(Category.Entity)
      .then((res: AxiosResponse) => {
        setEntityTypes(res.data.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // todo: remove this method once category filter issue fixed
  // https://github.com/open-metadata/OpenMetadata/issues/5036
  const getEntityTypesList = () => {
    return entityTypes.filter((type) => type.category === Category.Entity);
  };

  useEffect(() => {
    fetchEntityType();
  }, []);

  return (
    <Fragment>
      {isLoading ? (
        <Loader />
      ) : (
        <CustomEntityDetail entityTypes={getEntityTypesList()} />
      )}
    </Fragment>
  );
};

export default CustomEntityPage;
