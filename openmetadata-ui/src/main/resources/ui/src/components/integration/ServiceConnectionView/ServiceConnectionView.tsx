/*
 *  Copyright 2025 Collate.
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ConfigData, ServicesType } from '../../../interface/service.interface';
import { getServiceByFQN } from '../../../rest/serviceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import ServiceConnectionDetails from '../../Settings/Services/ServiceConnectionDetails/ServiceConnectionDetails.component';

const ServiceConnectionView: React.FC = () => {
  const { t } = useTranslation();
  const { serviceCategory, fqn } = useParams<{
    serviceCategory: string;
    fqn: string;
  }>();

  const decodedFqn = useMemo(() => decodeURIComponent(fqn ?? ''), [fqn]);

  const [isLoading, setIsLoading] = useState(true);
  const [serviceDetails, setServiceDetails] = useState<ServicesType>(
    {} as ServicesType
  );

  const fetchServiceDetails = useCallback(async () => {
    if (!serviceCategory || !decodedFqn) {
      setIsLoading(false);

      return;
    }
    try {
      setIsLoading(true);
      const res = await getServiceByFQN(serviceCategory, decodedFqn, {
        fields: 'owners,connection',
      });
      setServiceDetails(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [serviceCategory, decodedFqn]);

  useEffect(() => {
    fetchServiceDetails();
  }, [fetchServiceDetails]);

  const connectionDetails = useMemo(
    () =>
      (serviceDetails as unknown as { connection?: { config?: ConfigData } })
        ?.connection?.config,
    [serviceDetails]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="tw:p-6">
      {connectionDetails ? (
        <ServiceConnectionDetails
          connectionDetails={connectionDetails}
          serviceCategory={serviceCategory ?? ''}
          serviceFQN={serviceDetails?.serviceType ?? ''}
        />
      ) : (
        <div className="tw:flex tw:h-48 tw:items-center tw:justify-center">
          <p className="tw:text-sm tw:text-gray-400">
            {t('label.no-connection-details')}
          </p>
        </div>
      )}
    </div>
  );
};

export default ServiceConnectionView;
