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

import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { Key, ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../../../assets/svg/drop-down.svg';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import LimitWrapper from '../../../../hoc/LimitWrapper';
import {
  getIngestionTypes,
  getSupportedPipelineTypes,
} from '../../../../utils/IngestionConfigUtils';
import { getMenuItems } from '../../../../utils/IngestionUtils';
import { getAddIngestionPath } from '../../../../utils/RouterUtils';
import { useAgentActionAvailability } from '../../../ServiceAgents/hooks/useAgentActionAvailability';
import { AddIngestionButtonProps } from './AddIngestionButton.interface';

interface AddIngestionMenuItem {
  key: string;
  label: ReactNode;
  disabled?: boolean;
  'data-testid'?: string;
  onClick?: () => void;
}

const isAddIngestionMenuItem = (item: unknown): item is AddIngestionMenuItem =>
  typeof item === 'object' && item !== null && 'key' in item && 'label' in item;

function AddIngestionButton({
  serviceDetails,
  pipelineType,
  serviceCategory,
  serviceName,
  ingestionList,
  extraMenuItems,
}: Readonly<AddIngestionButtonProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isUnavailable } = useAgentActionAvailability();

  const supportedPipelineTypes = useMemo(
    (): PipelineType[] =>
      getSupportedPipelineTypes(serviceDetails, serviceCategory),
    [serviceDetails, serviceCategory]
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

  // `extraMenuItems` keeps the antd item shape because the Collate override of
  // `getExtraIngestionMenuItems` returns it.
  const menuItems = useMemo(
    () =>
      [
        ...getMenuItems(types, isDataInSightIngestionExists),
        ...(extraMenuItems ?? []),
      ].filter(isAddIngestionMenuItem),
    [types, isDataInSightIngestionExists, extraMenuItems]
  );

  const handleAction = useCallback(
    (key: Key) => {
      if ((types as string[]).includes(String(key))) {
        handleAddIngestionClick(key as PipelineType);

        return;
      }
      menuItems.find((item) => item.key === key)?.onClick?.();
    },
    [types, menuItems, handleAddIngestionClick]
  );

  if (isEmpty(types) && isEmpty(extraMenuItems)) {
    return null;
  }

  return (
    <Dropdown.Root>
      {/* Creating an agent deploys it to the pipeline service, so the whole control closes down
          when that service is unreachable. */}
      <LimitWrapper resource="ingestionPipeline">
        <Button
          className="tw:font-semibold"
          color="secondary"
          data-testid="add-new-ingestion-button"
          iconLeading={<Plus height={14} width={14} />}
          iconTrailing={<DropdownIcon height={12} width={12} />}
          isDisabled={isUnavailable}>
          {t('label.add-agent')}
        </Button>
      </LimitWrapper>
      <Dropdown.Popover className="tw:w-auto">
        <Dropdown.Menu
          aria-label={t('label.add-agent')}
          disabledKeys={menuItems
            .filter((item) => item.disabled)
            .map((item) => item.key)}
          selectionMode="none"
          onAction={handleAction}>
          {menuItems.map((item) => (
            <Dropdown.Item
              data-testid={item['data-testid']}
              id={item.key}
              key={item.key}>
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

export default AddIngestionButton;
