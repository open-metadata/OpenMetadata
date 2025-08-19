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

import { Button } from 'antd';
import { Dropdown } from '../../../common/AntdCompat';;
import { isEmpty } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../../../assets/svg/drop-down.svg';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import LimitWrapper from '../../../../hoc/LimitWrapper';
import {
  getIngestionTypes,
  getMenuItems,
  getSupportedPipelineTypes,
} from '../../../../utils/IngestionUtils';
import { getAddIngestionPath } from '../../../../utils/RouterUtils';
import { AddIngestionButtonProps } from './AddIngestionButton.interface';

function AddIngestionButton({
  serviceDetails,
  pipelineType,
  serviceCategory,
  serviceName,
  ingestionList,
}: Readonly<AddIngestionButtonProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const supportedPipelineTypes = useMemo(
    (): PipelineType[] => getSupportedPipelineTypes(serviceDetails),
    [serviceDetails]
  );

  const handleAddIngestionClick = useCallback(
    (type: PipelineType) => {
      navigate(getAddIngestionPath(serviceCategory, serviceName, type));
    },
    [serviceCategory, serviceName]
  );

  const isDataInSightIngestionExists = useMemo(
    () =>
      ingestionList.some(
        (ingestion) => ingestion.pipelineType === PipelineType.DataInsight
      ),
    [ingestionList]
  );

  const types = useMemo(
    (): PipelineType[] =>
      getIngestionTypes(supportedPipelineTypes, ingestionList, pipelineType),
    [pipelineType, supportedPipelineTypes, ingestionList]
  );

  if (isEmpty(types)) {
    return null;
  }

  return (
    <LimitWrapper resource="ingestionPipeline">
      <Dropdown
        menu={{
          items: getMenuItems(types, isDataInSightIngestionExists),
          onClick: (item) => {
            handleAddIngestionClick(item.key as PipelineType);
          },
        }}
        placement="bottomRight"
        trigger={['click']}>
        <Button
          className="flex-center gap-2 border-radius-xs p-md font-medium"
          data-testid="add-new-ingestion-button">
          {t('label.add-agent')}
          <DropdownIcon height={14} width={14} />
        </Button>
      </Dropdown>
    </LimitWrapper>
  );
}

export default AddIngestionButton;
