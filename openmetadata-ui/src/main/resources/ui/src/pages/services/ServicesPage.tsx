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
import { ServiceCategory } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getServices } from '../../axiosAPIs/serviceAPI';
import Loader from '../../components/Loader/Loader';
import Services from '../../components/Services/Services';
import { pagingObject } from '../../constants/constants';
import { SERVICE_CATEGORY } from '../../constants/services.const';
import { ServiceCategory as Category } from '../../enums/service.enum';
import { Paging } from '../../generated/type/paging';
import { DataService } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const ServicesPage = () => {
  const { tab, settingCategory } =
    useParams<{ [key: string]: keyof ServiceCategory }>();

  const [isLoading, setIsLoading] = useState(true);
  const [serviceDetails, setServiceDetails] = useState<DataService[]>([]);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [serviceName, setServiceName] = useState<Category>(
    Category.DATABASE_SERVICES
  );
  const [currentPage, setCurrentPage] = useState<number>(1);

  const getServiceDetails = async (type: string) => {
    setIsLoading(true);
    try {
      const { data } = await getServices(type);
      setServiceDetails(data.data);
      setPaging(data.paging);
    } catch (error) {
      setServiceDetails([]);
      setPaging(pagingObject);
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-services-error']
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (
    cursorType: string | number,
    activePage?: number
  ) => {
    const pagingString = `${serviceName}?${cursorType}=${
      paging[cursorType as keyof Paging]
    }`;
    setCurrentPage(activePage || 1);
    getServiceDetails(pagingString);
  };

  useEffect(() => {
    if (tab) {
      setServiceName(SERVICE_CATEGORY[tab]);
      setCurrentPage(1);
      getServiceDetails(SERVICE_CATEGORY[tab]);
    }
  }, [tab]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Services
      currentPage={currentPage}
      paging={paging}
      serviceData={serviceDetails}
      serviceName={serviceName}
      onPageChange={handlePageChange}
    />
  );
};

export default ServicesPage;
