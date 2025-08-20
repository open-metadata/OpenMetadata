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

import { Button, Card, Space, Typography } from 'antd';
import { isUndefined } from 'lodash';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import IconCollateSupport from '../../../assets/svg/ic-collate-support.svg?react';
import IconSuccessBadge from '../../../assets/svg/success-badge.svg?react';
import { AIRFLOW_DOCS } from '../../../constants/docs.constants';
import { PIPELINE_SERVICE_PLATFORM } from '../../../constants/Services.constant';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { FormSubmitType } from '../../../enums/form.enum';
import brandClassBase from '../../../utils/BrandData/BrandClassBase';
import AirflowMessageBanner from '../AirflowMessageBanner/AirflowMessageBanner';
import Loader from '../Loader/Loader';

export type SuccessScreenProps = {
  name: string;
  suffix?: string;
  successMessage?: ReactNode;
  showIngestionButton: boolean;
  showDeployButton?: boolean;
  state: FormSubmitType;
  viewServiceText?: string;
  handleIngestionClick?: () => void;
  handleViewServiceClick: () => void;
  handleDeployClick?: () => void;
};

const SuccessScreen = ({
  name,
  suffix,
  showIngestionButton,
  showDeployButton = false,
  handleIngestionClick,
  handleViewServiceClick,
  handleDeployClick,
  successMessage,
  viewServiceText,
}: SuccessScreenProps) => {
  const { t } = useTranslation();
  const { isAirflowAvailable, platform, isFetchingStatus } = useAirflowStatus();

  const isAirflowPlatform = useMemo(
    () => platform === PIPELINE_SERVICE_PLATFORM,
    [platform]
  );

  const messageElement = useMemo(
    () =>
      isAirflowPlatform ? (
        <div data-testid="airflow-platform-message">
          <div>
            <h6 className="text-base text-grey-body font-medium">
              {t('message.manage-airflow-api-failed')}
            </h6>

            <p className="text-grey-body text-sm m-b-md">
              {t('message.airflow-guide-message')}
            </p>
          </div>

          <p>
            <a href={AIRFLOW_DOCS} rel="noopener noreferrer" target="_blank">
              {`${t('label.install-airflow-api')} >>`}
            </a>
          </p>
        </div>
      ) : (
        <Space
          align="center"
          className="justify-center w-full m-t-sm"
          data-testid="argo-platform-message"
          direction="vertical"
          size={16}>
          <IconCollateSupport
            data-testid="collate-support"
            height={100}
            width={100}
          />
          <Typography>
            {t('message.pipeline-scheduler-message', {
              brandName: brandClassBase.getPageTitle(),
            })}
          </Typography>
        </Space>
      ),
    [isAirflowPlatform]
  );

  return (
    <div
      className="d-flex flex-col mt-14 mb-24 mx-8 p-x-xss"
      data-testid="success-screen-container">
      <Card>
        <Space>
          <IconSuccessBadge data-testid="success-icon" width="20px" />
          <Typography.Paragraph className="m-b-0" data-testid="success-line">
            {isUndefined(successMessage) ? (
              <span>
                <span className="m-r-xss font-semibold">
                  {`"${name || 'demo_mysql'}"`}
                </span>
                {suffix && <span className="m-r-xss">{suffix}</span>}
                <span>{t('message.has-been-created-successfully')}</span>
              </span>
            ) : (
              successMessage
            )}
          </Typography.Paragraph>
        </Space>
      </Card>
      <div className="m-t-sm">
        {isFetchingStatus ? (
          <Loader size="small" />
        ) : (
          <>
            {!isAirflowAvailable && (
              <>
                <AirflowMessageBanner />
                <Card className="m-t-sm">{messageElement}</Card>
              </>
            )}
          </>
        )}
      </div>

      <div className="mt-7 text-center">
        <Button
          ghost
          data-testid="view-service-button"
          type="primary"
          onClick={handleViewServiceClick}>
          <span>
            {viewServiceText ??
              t('label.view-entity', { entity: t('label.service') })}
          </span>
        </Button>

        {showIngestionButton && (
          <Button
            className="m-l-3.5"
            data-testid="add-ingestion-button"
            disabled={!isAirflowAvailable}
            type="primary"
            onClick={handleIngestionClick}>
            <span>
              {t('label.add-entity', { entity: t('label.ingestion') })}
            </span>
          </Button>
        )}

        {showDeployButton && (
          <Button
            className="m-l-3.5"
            data-testid="deploy-ingestion-button"
            disabled={!isAirflowAvailable}
            type="primary"
            onClick={handleDeployClick}>
            <span>{t('label.deploy')}</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default SuccessScreen;
