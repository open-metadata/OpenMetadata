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

import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React from 'react';
import { CUSTOM_AIRFLOW_DOCS } from '../../../constants/constants';
import { FormSubmitType } from '../../../enums/form.enum';
import { useAirflowStatus } from '../../../hooks/useAirflowStatus';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
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
          className="tw-w-5"
          data-testid="success-icon"
          icon={Icons.SUCCESS_BADGE}
        />
      );
    } else {
      icon = (
        <SVGIcons
          alt="fail"
          className="tw-w-5"
          data-testid="fail-icon"
          icon={Icons.FAIL_BADGE}
        />
      );
    }

    return icon;
  };

  return (
    <div
      className="tw-flex tw-flex-col tw-mt-14 tw-mb-24 tw-mx-8 tw-px-1"
      data-testid="success-screen-container">
      <div className="tw-flex tw-border tw-border-main tw-rounded tw-shadow tw-p-3">
        <div className="tw-mr-2">
          <SVGIcons
            alt="success"
            className="tw-w-5"
            data-testid="success-icon"
            icon={Icons.SUCCESS_BADGE}
          />
        </div>
        <p data-testid="success-line">
          {isUndefined(successMessage) ? (
            <span>
              <span className="tw-mr-1 tw-font-semibold">
                &quot;{name || 'demo_mysql'}&quot;
              </span>
              {suffix && <span className="tw-mr-1">{suffix}</span>}
              <span>has been created successfully.</span>
            </span>
          ) : (
            successMessage
          )}
        </p>
      </div>

      {!isAirflowAvailable && (
        <div
          className="tw-border tw-border-main tw-rounded tw-shadow tw-mt-7 tw-p-3"
          data-testid="airflow-status-msg">
          <div className="tw-flex tw-justify-between tw-item-center">
            <div className="tw-flex tw-mt-0.5">
              <div className="tw-flex-none tw-mr-2">
                {getAirflowStatusIcon()}
              </div>
              <h6 className="tw-text-base tw-font-medium tw-mb-0.5">
                {isAirflowAvailable
                  ? 'OpenMetadata - Managed Airflow APIs'
                  : 'Failed to find OpenMetadata - Managed Airflow APIs'}
              </h6>
            </div>
            {!isUndefined(fetchAirflowStatus) && (
              <div className="tw-flex-none">
                <Button
                  className={classNames('tw-self-center tw-py-1 tw-px-1.5', {
                    'tw-opacity-40': isFetchingStatus,
                  })}
                  data-testid="airflow-status-check"
                  disabled={isFetchingStatus}
                  size="small"
                  theme="primary"
                  variant="outlined"
                  onClick={fetchAirflowStatus}>
                  Check Status
                </Button>
              </div>
            )}
          </div>
          {!isAirflowAvailable && (
            <p className="tw-mt-3">
              To set up metadata extraction through UI, you first need to
              configure and connect to Airflow. For more details visit our{' '}
              <a
                data-testid="airflow-doc-link"
                href={CUSTOM_AIRFLOW_DOCS}
                rel="noopener noreferrer"
                target="_blank">
                documentation
              </a>
              .
            </p>
          )}
        </div>
      )}

      <div className="tw-mt-7 tw-text-center">
        <Button
          data-testid="view-service-button"
          size="regular"
          theme="primary"
          variant="outlined"
          onClick={handleViewServiceClick}>
          <span>{viewServiceText ?? 'View Service'}</span>
        </Button>

        {showIngestionButton && (
          <Button
            className={classNames('tw-ml-3.5', {
              'tw-opacity-40 tw-pointer-events-none': !isAirflowAvailable,
            })}
            data-testid="add-ingestion-button"
            disabled={!isAirflowAvailable}
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleIngestionClick}>
            <span>Add Ingestion</span>
          </Button>
        )}

        {showDeployButton && (
          <Button
            className={classNames('tw-ml-3.5', {
              'tw-opacity-40 tw-pointer-events-none': !isAirflowAvailable,
            })}
            data-testid="add-ingestion-button"
            disabled={!isAirflowAvailable}
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleDeployClick}>
            <span>Deploy</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default SuccessScreen;
