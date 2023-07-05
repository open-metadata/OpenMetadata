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

import { Button, Typography } from 'antd';
import { AIRFLOW_DOCS } from 'constants/docs.constants';
import { isUndefined } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Transi18next } from 'utils/CommonUtils';
import { FormSubmitType } from '../../../enums/form.enum';
import { useAirflowStatus } from '../../../hooks/useAirflowStatus';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import Loader from '../../Loader/Loader';

type SuccessScreenProps = {
  name: string;
  suffix?: string;
  successMessage?: JSX.Element;
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
  const { isAirflowAvailable, fetchAirflowStatus, isFetchingStatus } =
    useAirflowStatus();

  const getAirflowStatusIcon = () => {
    let icon;
    if (isFetchingStatus) {
      icon = <Loader size="small" type="default" />;
    } else if (isAirflowAvailable) {
      icon = (
        <SVGIcons
          alt="success"
          data-testid="success-icon"
          icon={Icons.SUCCESS_BADGE}
        />
      );
    } else {
      icon = (
        <SVGIcons alt="fail" data-testid="fail-icon" icon={Icons.FAIL_BADGE} />
      );
    }

    return icon;
  };

  return (
    <div className="d-flex flex-col" data-testid="success-screen-container">
      <div className="d-flex ">
        <SVGIcons
          alt="success"
          data-testid="success-icon"
          icon={Icons.SUCCESS_BADGE}
        />
        <Typography.Paragraph data-testid="success-line" ellipsis={{ rows: 3 }}>
          {isUndefined(successMessage) ? (
            <span>
              <span className="font-semibold">
                {`"${name || 'demo_mysql'}"`}
              </span>
              {suffix && <span>{suffix}</span>}
              <span>{t('message.has-been-created-successfully')}</span>
            </span>
          ) : (
            successMessage
          )}
        </Typography.Paragraph>
      </div>

      {!isAirflowAvailable && (
        <div data-testid="airflow-status-msg">
          <div className="d-flex justify-between items-center">
            <div className="d-flex ">
              <div className="flex-none ">{getAirflowStatusIcon()}</div>
              <h6 className="text-base font-medium ">
                {isAirflowAvailable
                  ? t('message.manage-airflow-api')
                  : t('message.manage-airflow-api-failed')}
              </h6>
            </div>
            {!isUndefined(fetchAirflowStatus) && (
              <div className="flex-none">
                <Button
                  ghost
                  data-testid="airflow-status-check"
                  loading={isFetchingStatus}
                  size="small"
                  type="primary"
                  onClick={fetchAirflowStatus}>
                  {t('label.check-status')}
                </Button>
              </div>
            )}
          </div>
          {!isAirflowAvailable && (
            <Transi18next
              i18nKey="message.configure-airflow"
              renderElement={
                <a
                  data-testid="airflow-doc-link"
                  href={AIRFLOW_DOCS}
                  rel="noopener noreferrer"
                  target="_blank"
                />
              }
              values={{
                text: t('label.documentation-lowercase'),
              }}
            />
          )}
        </div>
      )}

      <div className="text-center">
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
            data-testid="add-ingestion-button"
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
