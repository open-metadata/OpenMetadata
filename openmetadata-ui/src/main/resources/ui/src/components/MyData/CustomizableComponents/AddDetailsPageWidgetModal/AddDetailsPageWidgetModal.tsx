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

import { Tabs } from '@openmetadata/ui-core-components';
import { Modal } from 'antd';
import { isEmpty, sortBy, toString } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CommonWidgetType,
  GridSizes,
} from '../../../../constants/CustomizeWidgets.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { WidgetWidths } from '../../../../enums/CustomizablePage.enum';
import { Document } from '../../../../generated/entity/docStore/document';
import { getWidgetWidthLabelFromKey } from '../../../../utils/CustomizableLandingPagePureUtils';
import { DetailsTabItem } from '../../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { WidgetSizeInfo } from '../AddWidgetModal/AddWidgetModal.interface';
import AddWidgetTabContent from '../AddWidgetModal/AddWidgetTabContent';
interface Props {
  open: boolean;
  maxGridSizeSupport: number;
  placeholderWidgetKey: string;
  handleCloseAddWidgetModal: () => void;
  handleAddWidget: (
    widget: CommonWidgetType,
    widgetKey: string,
    widgetSize: number
  ) => void;
  widgetsList: Array<CommonWidgetType>;
}

function AddDetailsPageWidgetModal({
  open,
  widgetsList,
  handleCloseAddWidgetModal,
  handleAddWidget,
  maxGridSizeSupport,
  placeholderWidgetKey,
}: Readonly<Props>) {
  const { t } = useTranslation();

  const getAddWidgetHandler = useCallback(
    (widget: Document, widgetSize: number) => () =>
      handleAddWidget(
        widget as unknown as CommonWidgetType,
        placeholderWidgetKey,
        widgetSize
      ),
    [handleAddWidget, placeholderWidgetKey]
  );

  const tabItems: DetailsTabItem[] = useMemo(
    () =>
      sortBy(widgetsList, 'name').map((widget) => {
        const widgetSizeOptions: Array<WidgetSizeInfo> =
          widget.data.gridSizes.map((size: GridSizes) => ({
            label: (
              <span data-testid={`${size}-size-selector`}>
                {getWidgetWidthLabelFromKey(toString(size))}
              </span>
            ),
            value: WidgetWidths[size],
          }));

        return {
          label: (
            <span data-testid={`${widget.name}-widget`}>{widget.name}</span>
          ),
          key: widget.fullyQualifiedName,
          children: (
            <AddWidgetTabContent
              getAddWidgetHandler={getAddWidgetHandler}
              maxGridSizeSupport={maxGridSizeSupport}
              widget={widget as unknown as Document}
              widgetSizeOptions={widgetSizeOptions}
            />
          ),
        };
      }),
    [widgetsList, getAddWidgetHandler, maxGridSizeSupport]
  );

  const widgetsInfo = useMemo(() => {
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

    return (
      <Tabs
        className="tw:flex-row"
        data-testid="widget-info-tabs"
        orientation="vertical">
        <Tabs.List
          className="tw:shrink-0 tw:border-r tw:border-secondary tw:p-4"
          type="line">
          {tabItems.map(({ key, label }) => (
            <Tabs.Item id={key} key={key}>
              {label}
            </Tabs.Item>
          ))}
        </Tabs.List>
        {tabItems.map(({ key, children }) => (
          <Tabs.Panel
            className="tw:min-w-0 tw:flex-1 tw:p-4"
            id={key}
            key={key}>
            {children}
          </Tabs.Panel>
        ))}
      </Tabs>
    );
  }, [widgetsList, tabItems]);

  return (
    <Modal
      centered
      className="add-widget-modal"
      data-testid="add-widget-modal"
      footer={null}
      open={open}
      title={t('label.add-new-entity', { entity: t('label.widget') })}
      width={750}
      onCancel={handleCloseAddWidgetModal}>
      {widgetsInfo}
    </Modal>
  );
}

export default AddDetailsPageWidgetModal;
