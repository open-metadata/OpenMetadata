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

import { Typography } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import classNames from 'classnames';
import React, { Fragment } from 'react';
import { LITE_GRAY_COLOR, PRIMERY_COLOR } from '../../../constants/constants';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { DeployIngestionLoaderModalProps } from './DeployIngestionLoaderModal.interface';

const DeployIngestionLoaderModal = ({
  className,
  ingestionName,
  action,
  progress,
  isIngestionCreated,
  isDeployed,
  visible,
}: DeployIngestionLoaderModalProps) => {
  const isActive = (value: boolean) => {
    return value ? PRIMERY_COLOR : LITE_GRAY_COLOR;
  };

  return (
    <Modal
      centered
      destroyOnClose
      className={classNames('h-40', className)}
      closable={false}
      data-testid="deploy-modal"
      footer={null}
      open={visible}>
      <div className="p-y-lg d-flex flex-col" data-testid="body-text">
        <div className={classNames('ingestion-content relative', className)}>
          <Fragment>
            <Typography.Text
              className={classNames('ingestion-deploy-line')}
              style={{
                background: `linear-gradient(to right, ${PRIMERY_COLOR} ${progress}%, ${LITE_GRAY_COLOR} ${progress}%)`,
              }}
            />

            <div className="ingestion-wrappe absolute" style={{ left: '16%' }}>
              <Typography.Text
                className={classNames('ingestion-deploy-rounder self-center')}
                style={{
                  background: isActive(isIngestionCreated),
                }}>
                <Typography.Text className="flex-center h-full">
                  <SVGIcons alt="" icon={Icons.CREATE_INGESTION} />
                </Typography.Text>
              </Typography.Text>
            </div>
            <div className="ingestion-wrapper absolute" style={{ left: '72%' }}>
              <Typography.Text
                className={classNames('ingestion-deploy-rounder self-center')}
                style={{
                  background: isActive(isDeployed),
                }}>
                <Typography.Text className="flex-center h-full">
                  <SVGIcons alt="" icon={Icons.DEPLOY_INGESTION} />
                </Typography.Text>
              </Typography.Text>
            </div>
          </Fragment>
        </div>
        <Typography.Text className="text-center mt-24">
          {action}
          <Typography.Text className="font-semibold m-l-xss">
            {`“${ingestionName}”`}
          </Typography.Text>
        </Typography.Text>
      </div>
    </Modal>
  );
};

export default DeployIngestionLoaderModal;
