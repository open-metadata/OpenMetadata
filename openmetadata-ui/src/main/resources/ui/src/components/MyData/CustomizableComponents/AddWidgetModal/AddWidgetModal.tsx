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
import { isEmpty, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LIGHT_GREEN_COLOR,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import {
  LandingPageWidgetKeys,
  WidgetWidths,
} from '../../../../enums/CustomizablePage.enum';
import { Document } from '../../../../generated/entity/docStore/document';
import { getAllKnowledgePanels } from '../../../../rest/DocStoreAPI';
import { getWidgetWidthLabelFromKey } from '../../../../utils/CustomizableLandingPageUtils';
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

      // User can't add / update / delete Announcements widget
      setWidgetsList(
        data.filter(
          (widget) =>
            widget.fullyQualifiedName !== LandingPageWidgetKeys.ANNOUNCEMENTS
        )
      );
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

  const tabItems: TabsProps['items'] = useMemo(
    () =>
      widgetsList?.map((widget) => {
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
            <Space data-testid={`${widget.name}-widget-tab-label`}>
              <span>{widget.name}</span>
              {addedWidgetsList.some(
                (w) =>
                  w.startsWith(widget.fullyQualifiedName) &&
                  !w.includes('EmptyWidgetPlaceholder')
              ) && (
                <CheckOutlined
                  className="m-l-xs"
                  data-testid={`${widget.name}-check-icon`}
                  style={{ color: LIGHT_GREEN_COLOR }}
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
        data-testid="widget-info-tabs"
        items={tabItems}
        tabPosition="left"
      />
    );
  }, [loading, widgetsList, tabItems]);

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

export default AddWidgetModal;
