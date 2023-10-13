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

import { CheckOutlined } from '@ant-design/icons';
import { Modal, Space, Tabs, TabsProps } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { WidgetWidths } from '../../../enums/CustomizablePage.enum';
import { Document } from '../../../generated/entity/docStore/document';
import { getAllKnowledgePanels } from '../../../rest/DocStoreAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import {
  AddWidgetModalProps,
  WidgetSizeInfo,
} from './AddWidgetModal.interface';
import './AddWidgetModal.less';
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

  const fetchKnowledgePanels = useCallback(async () => {
    try {
      const response = await getAllKnowledgePanels({
        fqnPrefix: 'KnowledgePanel',
      });

      setWidgetsList(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, []);

  const getAddWidgetHandler = useCallback(
    (widget: Document, widgetSize: number) => () =>
      handleAddWidget(widget, placeholderWidgetKey, widgetSize),
    [handleAddWidget, placeholderWidgetKey]
  );

  const tabItems: TabsProps['items'] = useMemo(
    () =>
      widgetsList?.map((widget) => {
        const widgetSizeOptions: Array<WidgetSizeInfo> =
          widget.data.gridSizes.map((size: WidgetWidths) => ({
            label: size,
            value: WidgetWidths[size],
          }));

        return {
          label: (
            <Space>
              <span>{widget.name}</span>
              {addedWidgetsList.some((w) =>
                w.startsWith(widget.fullyQualifiedName)
              ) && (
                <CheckOutlined
                  className="m-l-xs"
                  style={{ color: '#4CAF50' }}
                />
              )}
            </Space>
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

  useEffect(() => {
    fetchKnowledgePanels();
  }, []);

  return (
    <Modal
      centered
      className="add-widget-modal"
      footer={null}
      open={open}
      title={t('label.add-new-entity', { entity: t('label.widget') })}
      width={750}
      onCancel={handleCloseAddWidgetModal}>
      {isEmpty(widgetsList) ? (
        <ErrorPlaceHolder
          className="h-min-480"
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          {t('message.no-widgets-to-add')}
        </ErrorPlaceHolder>
      ) : (
        <Tabs items={tabItems} tabPosition="left" />
      )}
    </Modal>
  );
}

export default AddWidgetModal;
