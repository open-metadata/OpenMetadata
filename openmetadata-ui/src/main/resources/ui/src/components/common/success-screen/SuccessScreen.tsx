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

import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { LoadingState } from 'Models';
import React, { useState } from 'react';
import { AIRFLOW_DOCS } from '../../../constants/constants';
import { FormSubmitType } from '../../../enums/form.enum';
import jsonData from '../../../jsons/en';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { Button } from '../../buttons/Button/Button';
import Loader from '../../Loader/Loader';

type SuccessScreenProps = {
  name: string;
  successMessage?: JSX.Element;
  showIngestionButton: boolean;
  showDeployButton?: boolean;
  state: FormSubmitType;
  isAirflowSetup: boolean;
  handleIngestionClick?: () => void;
  handleViewServiceClick: () => void;
  handleDeployClick?: () => void;
  onCheckAirflowStatus?: () => Promise<void>;
};

const SuccessScreen = ({
  name,
  showIngestionButton,
  showDeployButton = false,
  isAirflowSetup,
  handleIngestionClick,
  handleViewServiceClick,
  handleDeployClick,
  successMessage,
  onCheckAirflowStatus,
}: SuccessScreenProps) => {
  const [airflowCheckState, setAirflowCheckState] =
    useState<LoadingState>('initial');
  const [isAirflowRunning, setIsAirflowRunning] =
    useState<boolean>(isAirflowSetup);

  const handleAirflowStatusCheck = () => {
    if (onCheckAirflowStatus) {
      setAirflowCheckState('waiting');
      onCheckAirflowStatus()
        .then(() => {
          setAirflowCheckState('success');
          setIsAirflowRunning(true);
        })
        .catch(() => {
          showErrorToast(
            jsonData['api-error-messages']['check-status-airflow']
          );
          setAirflowCheckState('initial');
        });
    }
  };

  const getAirflowStatusMessage = () => {
    switch (airflowCheckState) {
      case 'waiting':
        return (
          <div className="tw-flex">
            <Loader size="small" type="default" />{' '}
            <span className="tw-ml-2">Checking Airflow status...</span>
          </div>
        );
      case 'success':
        return (
          <div className="tw-flex">
            <SVGIcons
              alt="success-badge"
              className="tw-w-5"
              icon={Icons.SUCCESS_BADGE}
            />
            <span className="tw-ml-2">Airflow is connected successfully.</span>
          </div>
        );

      case 'initial':
      default:
        return 'If Airflow has been setup, please recheck the status.';
    }
  };

  return (
    <div
      className="tw-flex tw-flex-col tw-items-center tw-mt-14 tw-mb-24"
      data-testid="success-screen-container">
      <div>
        <SVGIcons
          alt="success"
          className="tw-w-10 tw-h-10"
          data-testid="success-icon"
          icon={Icons.SUCCESS_BADGE}
        />
      </div>
      <p className="tw-mt-7" data-testid="success-line">
        {isUndefined(successMessage) ? (
          <span>
            <span className="tw-mr-1 tw-font-semibold">&quot;{name}&quot;</span>
            <span>has been created successfully.</span>
          </span>
        ) : (
          successMessage
        )}
      </p>

      {!isAirflowSetup && (
        <>
          <p className="tw-mt-2" data-testid="airflow-status-msg">
            To set up metadata extraction, you first need to configure and
            connect to Airflow.
          </p>
          <p className="tw-mt-2">
            For more details visit our{' '}
            <a
              data-testid="airflow-doc-link"
              href={AIRFLOW_DOCS}
              rel="noopener noreferrer"
              target="_blank">
              documentation
            </a>
            .
          </p>
          {!isUndefined(onCheckAirflowStatus) && (
            <div
              className="tw-flex tw-justify-between tw-bg-white tw-border tw-border-main tw-shadow tw-rounded tw-p-3 tw-mt-7 tw-w-10/12"
              data-testid="airflow-status-check">
              <div className="tw-self-center tw-mr-3">
                {getAirflowStatusMessage()}
              </div>
              <Button
                className={classNames('tw-self-center tw-py-1 tw-px-1.5', {
                  'tw-opacity-40': airflowCheckState === 'waiting',
                })}
                data-testid="test-connection-btn"
                disabled={airflowCheckState === 'waiting'}
                size="small"
                theme="primary"
                variant="outlined"
                onClick={handleAirflowStatusCheck}>
                Check Status
              </Button>
            </div>
          )}
        </>
      )}

      <div className="tw-mt-7">
        <Button
          data-testid="view-service-button"
          size="regular"
          theme="primary"
          variant="outlined"
          onClick={handleViewServiceClick}>
          <span>View Service</span>
        </Button>

        {showIngestionButton && (
          <Button
            className={classNames('tw-ml-3.5', {
              'tw-opacity-40 tw-pointer-events-none': !isAirflowRunning,
            })}
            data-testid="add-ingestion-button"
            disabled={!isAirflowRunning}
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
              'tw-opacity-40 tw-pointer-events-none': !isAirflowRunning,
            })}
            data-testid="add-ingestion-button"
            disabled={!isAirflowRunning}
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
