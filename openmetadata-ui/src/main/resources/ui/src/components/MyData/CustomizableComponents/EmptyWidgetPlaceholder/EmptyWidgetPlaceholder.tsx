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

import {
    Box,
    Button,
    ButtonUtility,
    Card,
    Typography
} from '@openmetadata/ui-core-components';
import { DotsGrid, Plus, XClose } from '@openmetadata/ui-core-components/icons';
import { isUndefined } from 'lodash';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/add-placeholder.svg';
import { SIZE } from '../../../../enums/common.enum';
import './empty-widget-placeholder.less';
import { EmptyWidgetPlaceholderProps } from './EmptyWidgetPlaceholder.interface';

function EmptyWidgetPlaceholder({
  iconHeight = SIZE.MEDIUM,
  iconWidth = SIZE.MEDIUM,
  widgetKey,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  handleRemoveWidget,
  isEditable = true,
}: Readonly<EmptyWidgetPlaceholderProps>) {
  const { t } = useTranslation();

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, []);

  const handleAddClick = useCallback(() => {
    handlePlaceholderWidgetKey(widgetKey);
    handleOpenAddWidgetModal();
  }, []);

  return (
    <Card
      className="empty-widget-placeholder tw:flex tw:h-full tw:flex-col tw:p-6"
      data-testid={widgetKey}>
      {isEditable && (
        <Box align="center" direction="row" gap={2} justify="end">
          {/* Grid drag handle: react-grid-layout starts a drag on mousedown here. */}
          <span
            aria-hidden
            className="drag-widget-icon tw:flex tw:cursor-grab tw:text-fg-quaternary tw:active:cursor-grabbing"
            data-testid="drag-widget-button">
            <DotsGrid className="tw:size-4" />
          </span>
          <ButtonUtility
            aria-label={t('label.remove-entity', { entity: t('label.widget') })}
            color="tertiary"
            data-testid="remove-widget-button"
            icon={XClose}
            size="xs"
            onPress={handleCloseClick}
          />
        </Box>
      )}
      <Box
        align="center"
        className="tw:flex-1 tw:text-center"
        direction="col"
        justify="center">
        <AddPlaceHolderIcon
          data-testid="no-data-image"
          height={iconHeight}
          width={iconWidth}
        />
        <Typography>
          {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
            entity: t('label.widget'),
          })}
        </Typography>
        <Button
          className="tw:mt-4"
          color="secondary"
          data-testid="add-widget-button"
          iconLeading={Plus}
          onPress={handleAddClick}>
          {t('label.add')}
        </Button>
      </Box>
    </Card>
  );
}

export default EmptyWidgetPlaceholder;
