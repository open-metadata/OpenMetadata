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
import React, { Fragment } from 'react';
import { LITE_GRAY_COLOR, PRIMERY_COLOR } from '../../../constants/constants';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
type Props = {
  className?: string;
  ingestionName: string;
  action: string;
  progress: number;
  isIngestionCreated: boolean;
  isDeployed: boolean;
};
const DeployIngestionLoaderModal = ({
  className,
  ingestionName,
  action,
  progress,
  isIngestionCreated,
  isDeployed,
}: Props) => {
  const isActive = (value: boolean) => {
    return value ? PRIMERY_COLOR : LITE_GRAY_COLOR;
  };

  return (
    <dialog
      className={classNames('tw-modal', className)}
      data-testid="deploy-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-w-120">
        <div className="tw-modal-body tw-h-40" data-testid="body-text">
          <div
            className={classNames('ingestion-content tw-relative', className)}>
            <Fragment>
              <span
                className={classNames('ingestion-deploy-line')}
                style={{
                  background: `linear-gradient(to right, ${PRIMERY_COLOR} ${progress}%, ${LITE_GRAY_COLOR} ${progress}%)`,
                }}
              />

              <div
                className="ingestion-wrapper tw-absolute"
                style={{ left: '16%' }}>
                <span
                  className={classNames(
                    'ingestion-deploy-rounder tw-self-center'
                  )}
                  style={{
                    background: isActive(isIngestionCreated),
                  }}>
                  <span className="tw-flex-center tw-h-full">
                    <SVGIcons alt="" icon={Icons.CREATE_INGESTION} />
                  </span>
                </span>
              </div>
              <div
                className="ingestion-wrapper tw-absolute"
                style={{ left: '72%' }}>
                <span
                  className={classNames(
                    'ingestion-deploy-rounder tw-self-center'
                  )}
                  style={{
                    background: isActive(isDeployed),
                  }}>
                  <span className="tw-flex-center tw-h-full">
                    <SVGIcons alt="" icon={Icons.DEPLOY_INGESTION} />
                  </span>
                </span>
              </div>
            </Fragment>
          </div>
          <p className="tw-text-center tw-mt-24">
            {action}
            <span className="tw-font-semibold tw-ml-1">“{ingestionName}”</span>
          </p>
        </div>
      </div>
    </dialog>
  );
};

export default DeployIngestionLoaderModal;
