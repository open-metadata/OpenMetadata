/*
 *  Copyright 2023 Collate.
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

import { Button, Dropdown, Space } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import {
  getIngestionButtonText,
  getIngestionTypes,
  getMenuItems,
  getSupportedPipelineTypes,
} from 'utils/IngestionUtils';
import { ReactComponent as DropdownIcon } from '../../assets/svg/DropDown.svg';
import { MetadataServiceType } from '../../generated/api/services/createMetadataService';
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getAddIngestionPath } from '../../utils/RouterUtils';
import { AddIngestionButtonProps } from './AddIngestionButton.interface';

function AddIngestionButton({
  serviceDetails,
  pipelineType,
  serviceCategory,
  serviceName,
  ingestionData,
  ingestionList,
  permissions,
}: AddIngestionButtonProps) {
  const history = useHistory();

  const isOpenMetadataService = useMemo(
    () =>
      serviceDetails?.connection?.config?.type ===
      MetadataServiceType.OpenMetadata,
    [serviceDetails]
  );

  const supportedPipelineTypes = useMemo(
    (): PipelineType[] => getSupportedPipelineTypes(serviceDetails),
    [serviceDetails]
  );

  const handleAddIngestionClick = useCallback(
    (type: PipelineType) => {
      history.push(getAddIngestionPath(serviceCategory, serviceName, type));
    },
    [serviceCategory, serviceName]
  );

  const isDataSightIngestionExists = useMemo(
    () =>
      ingestionData.some(
        (ingestion) => ingestion.pipelineType === PipelineType.DataInsight
      ),
    [ingestionData]
  );

  const types = useMemo(
    (): PipelineType[] =>
      getIngestionTypes(
        supportedPipelineTypes,
        isOpenMetadataService,
        ingestionList,
        pipelineType
      ),
    [pipelineType, supportedPipelineTypes, isOpenMetadataService, ingestionList]
  );

  // Check if service has at least one metadata pipeline available or not
  const hasMetadata = useMemo(
    () =>
      ingestionList.find(
        (ingestion) => ingestion.pipelineType === PipelineType.Metadata
      ),
    [ingestionList]
  );
  if (types.length === 0) {
    return null;
  }

  return (
    <Dropdown
      menu={{
        items: getMenuItems(types, isDataSightIngestionExists),
        onClick: (item) => {
          handleAddIngestionClick(item.key as PipelineType);
        },
      }}
      placement="bottomRight"
      trigger={['click']}>
      <Button
        className={classNames('h-8 rounded-4 m-b-xs')}
        data-testid="add-new-ingestion-button"
        disabled={!permissions.Create}
        size="small"
        type="primary"
        onClick={
          hasMetadata
            ? undefined
            : () =>
                handleAddIngestionClick(
                  pipelineType ? pipelineType : PipelineType.Metadata
                )
        }>
        <Space>
          {getIngestionButtonText(hasMetadata, pipelineType)}
          {hasMetadata && <DropdownIcon height={14} width={14} />}
        </Space>
      </Button>
    </Dropdown>
  );
}

export default AddIngestionButton;
