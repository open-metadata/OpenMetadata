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
  Dialog,
  Modal,
  ModalOverlay,
  Tabs,
} from '@openmetadata/ui-core-components';
import { Check } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LIGHT_GREEN_COLOR,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { WidgetWidths } from '../../../../enums/CustomizablePage.enum';
import { Document } from '../../../../generated/entity/docStore/document';
import { useVisitedTabs } from '../../../../hooks/useVisitedTabs';
import { getAllKnowledgePanels } from '../../../../rest/DocStoreAPI';
import { getWidgetWidthLabelFromKey } from '../../../../utils/CustomizableLandingPagePureUtils';
import { DetailsTabItem } from '../../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../common/Loader/Loader';
import './add-widget-modal.less';
import {
  AddWidgetModalProps,
  WidgetSizeInfo,
} from './AddWidgetModal.interface';
import AddWidgetTabContent from './AddWidgetTabContent';

function AddWidgetModal({
  open,
  addedWidgetsList,
  handleCloseAddWidgetModal,
  handleAddWidget,
  maxGridSizeSupport,
  placeholderWidgetKey,
}: Readonly<AddWidgetModalProps>) {
  const { t } = useTranslation();
  const [widgetsList, setWidgetsList] = useState<Array<Document>>();
  const [loading, setLoading] = useState<boolean>(true);

  const fetchKnowledgePanels = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getAllKnowledgePanels({
        fqnPrefix: 'KnowledgePanel',
        limit: PAGE_SIZE_MEDIUM,
      });

      setWidgetsList(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, []);

  const getAddWidgetHandler = useCallback(
    (widget: Document, widgetSize: number) => () =>
      handleAddWidget(widget, placeholderWidgetKey, widgetSize),
    [handleAddWidget, placeholderWidgetKey]
  );

  const tabItems: DetailsTabItem[] = useMemo(
    () =>
      (widgetsList ?? []).map((widget) => {
        const widgetSizeOptions: Array<WidgetSizeInfo> =
          widget.data.gridSizes.map((size: WidgetWidths) => ({
            label: (
              <span data-testid={`${size}-size-selector`}>
                {getWidgetWidthLabelFromKey(toString(size))}
              </span>
            ),
            value: WidgetWidths[size],
          }));

        return {
          label: (
            <Box
              align="center"
              data-testid={`${widget.name}-widget-tab-label`}
              direction="row"
              gap={1}>
              <span>{widget.name}</span>
              {addedWidgetsList.some(
                (w) =>
                  w.startsWith(widget.fullyQualifiedName) &&
                  !w.includes('EmptyWidgetPlaceholder')
              ) && (
                <Check
                  className="m-l-xs tw:size-4"
                  data-testid={`${widget.name}-check-icon`}
                  style={{ color: LIGHT_GREEN_COLOR }}
                />
              )}
            </Box>
          ),
          key: widget.fullyQualifiedName,
          children: (
            <AddWidgetTabContent
              getAddWidgetHandler={getAddWidgetHandler}
              maxGridSizeSupport={maxGridSizeSupport}
              widget={widget}
              widgetSizeOptions={widgetSizeOptions}
            />
          ),
        };
      }),
    [widgetsList, addedWidgetsList, getAddWidgetHandler, maxGridSizeSupport]
  );

  const [selectedTab, setSelectedTab] = useState<string>();
  const activeTab = selectedTab ?? tabItems[0]?.key ?? '';
  // Keeps the widget size picked on a tab when the user browses other widgets.
  const visitedTabs = useVisitedTabs(activeTab);

  useEffect(() => {
    fetchKnowledgePanels();
  }, []);

  const widgetsInfo = useMemo(() => {
    if (loading) {
      return <Loader />;
    }

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
        orientation="vertical"
        selectedKey={activeTab}
        onSelectionChange={(key) => setSelectedTab(String(key))}>
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
            className="tw:min-w-0 tw:flex-1 tw:p-4 tw:data-inert:hidden"
            id={key}
            key={key}
            shouldForceMount={visitedTabs.has(key)}>
            {children}
          </Tabs.Panel>
        ))}
      </Tabs>
    );
  }, [loading, widgetsList, tabItems, activeTab, visitedTabs]);

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && handleCloseAddWidgetModal()}>
      <Modal className="add-widget-modal">
        <Dialog
          data-testid="add-widget-modal"
          dividers="scroll"
          title={t('label.add-new-entity', { entity: t('label.widget') })}
          width={750}
          onClose={handleCloseAddWidgetModal}>
          <Dialog.Content>{widgetsInfo}</Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export default AddWidgetModal;
