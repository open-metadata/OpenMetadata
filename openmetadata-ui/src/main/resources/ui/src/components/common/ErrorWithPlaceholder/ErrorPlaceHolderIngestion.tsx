/*
 *  Copyright 2022 Collate.
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

import { Card, Space, Typography } from 'antd';
import classNames from 'classnames';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import IconCollateSupport from '../../../assets/svg/ic-collate-support.svg?react';
import { AIRFLOW_DOCS } from '../../../constants/docs.constants';
import { PIPELINE_SERVICE_PLATFORM } from '../../../constants/Services.constant';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import brandClassBase from '../../../utils/BrandData/BrandClassBase';
import AirflowMessageBanner from '../AirflowMessageBanner/AirflowMessageBanner';
import Loader from '../Loader/Loader';
import { ErrorPlaceHolderIngestionProps } from './ErrorPlaceHolderIngestion.interface';

const ErrorPlaceHolderIngestion = ({
  cardClassName,
}: ErrorPlaceHolderIngestionProps) => {
  const { platform, isFetchingStatus } = useAirflowStatus();
  const { t } = useTranslation();

  const isAirflowPlatform = platform === PIPELINE_SERVICE_PLATFORM;

  const airflowSetupGuide = useMemo(() => {
    return (
      <div className="mb-5" data-testid="error-steps">
        <Card
          className={classNames(
            'd-flex flex-col justify-between',
            cardClassName
          )}>
          <AirflowMessageBanner className="m-b-xs" />
          {isAirflowPlatform ? (
            <>
              <div>
                <h6 className="text-base text-grey-body font-medium">
                  {t('message.manage-airflow-api-failed')}
                </h6>

                <p className="text-grey-body text-sm mb-5">
                  {t('message.airflow-guide-message')}
                </p>
              </div>

              <p>
                <a
                  href={AIRFLOW_DOCS}
                  rel="noopener noreferrer"
                  target="_blank">
                  {`${t('label.install-airflow-api')} >>`}
                </a>
              </p>
            </>
          ) : (
            <Space
              align="center"
              className="justify-center w-full"
              direction="vertical"
              size={16}>
              <IconCollateSupport height={100} width={100} />
              <Typography>
                {t('message.pipeline-scheduler-message', {
                  brandName: brandClassBase.getPageTitle(),
                })}
              </Typography>
            </Space>
          )}
        </Card>
      </div>
    );
  }, [isAirflowPlatform, cardClassName]);

  return (
    <div className="m-t-lg text-base font-medium">
      {isFetchingStatus ? <Loader /> : airflowSetupGuide}
    </div>
  );
};

export default ErrorPlaceHolderIngestion;
