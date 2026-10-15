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
  Dialog,
  Modal,
  ModalOverlay,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty, sortBy } from 'lodash';
import { Heading } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { CommonWidgetType } from '../../../../constants/CustomizeWidgets.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { DetailPageWidgetKeys } from '../../../../enums/CustomizeDetailPage.enum';
import type { WidgetConfig } from '../../../../interface/customization.interface';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AddCustomPropertiesWidgetTabContent } from './AddCustomPropertiesWidgetTabContent';
import { AddDetailsPageWidgetTabContent } from './AddDetailsPageWidgetTabContent';

const MODAL_WIDTH = 1000;

interface Props {
  entityType?: string;
  open: boolean;
  maxGridSizeSupport: number;
  placeholderWidgetKey: string;
  handleCloseAddWidgetModal: () => void;
  handleAddWidget: (
    widget: CommonWidgetType,
    widgetKey: string,
    widgetSize: number,
    extraConfig?: WidgetConfig['config']
  ) => void;
  widgetsList: Array<CommonWidgetType>;
}

function AddDetailsPageWidgetModal({
  entityType,
  open,
  widgetsList,
  handleCloseAddWidgetModal,
  handleAddWidget,
  maxGridSizeSupport,
  placeholderWidgetKey,
}: Readonly<Props>) {
  const { t } = useTranslation();

  const addWidget = (
    widget: CommonWidgetType,
    widgetSize: number,
    extraConfig?: WidgetConfig['config']
  ) => handleAddWidget(widget, placeholderWidgetKey, widgetSize, extraConfig);

  const renderPanel = (widget: CommonWidgetType) =>
    widget.fullyQualifiedName === DetailPageWidgetKeys.CUSTOM_PROPERTIES ? (
      <AddCustomPropertiesWidgetTabContent
        entityType={entityType}
        maxGridSizeSupport={maxGridSizeSupport}
        widget={widget}
        onAdd={(widget, size, settings) =>
          addWidget(widget, size, { ...settings })
        }
        onCancel={handleCloseAddWidgetModal}
      />
    ) : (
      <AddDetailsPageWidgetTabContent
        maxGridSizeSupport={maxGridSizeSupport}
        widget={widget}
        onAdd={addWidget}
        onCancel={handleCloseAddWidgetModal}
      />
    );

  const renderBody = () => {
    if (isEmpty(widgetsList)) {
      return (
        <ErrorPlaceHolder
          className="h-min-480"
          data-testid="no-widgets-placeholder"
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          {t('message.no-widgets-to-add')}
        </ErrorPlaceHolder>
      );
    }

    const widgets = sortBy(widgetsList, 'name');

    return (
      <Tabs
        className="tw:h-[min(680px,75vh)] tw:flex-row"
        data-testid="widget-info-tabs"
        orientation="vertical">
        <div className="tw:w-56 tw:shrink-0 tw:overflow-y-auto tw:border-r tw:border-secondary tw:p-4">
          <Typography
            className="tw:mb-2 tw:px-3 tw:font-medium tw:text-tertiary"
            size="text-xs">
            {t('label.widget-plural')}
          </Typography>
          <Tabs.List
            aria-label={t('label.widget-plural')}
            className="tw:w-full tw:gap-1"
            type="button-brand">
            {widgets.map((widget) => (
              <Tabs.Item
                className={({ isSelected }) =>
                  isSelected
                    ? 'tw:w-full tw:text-left tw:whitespace-normal'
                    : 'tw:w-full tw:text-left tw:whitespace-normal tw:text-secondary'
                }
                id={widget.fullyQualifiedName}
                key={widget.fullyQualifiedName}>
                <span data-testid={`${widget.name}-widget`}>{widget.name}</span>
              </Tabs.Item>
            ))}
          </Tabs.List>
        </div>
        {widgets.map((widget) => (
          <Tabs.Panel
            className="tw:min-h-0 tw:min-w-0 tw:flex-1"
            id={widget.fullyQualifiedName}
            key={widget.fullyQualifiedName}>
            {renderPanel(widget)}
          </Tabs.Panel>
        ))}
      </Tabs>
    );
  };

  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && handleCloseAddWidgetModal()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="add-widget-modal"
          width={MODAL_WIDTH}
          onClose={handleCloseAddWidgetModal}>
          <Dialog.Header className="tw:border-b tw:border-subtle tw:pr-12 tw:pb-5">
            <Heading
              className="tw:m-0 tw:text-md tw:font-semibold tw:text-primary"
              slot="title">
              {t('label.add-new-entity', { entity: t('label.widget') })}
            </Heading>
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('message.choose-widget-to-add-to-tab')}
            </Typography>
          </Dialog.Header>
          {renderBody()}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export default AddDetailsPageWidgetModal;
