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

import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Modal,
  Row,
  Space,
  Tabs,
  TabsProps,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { Document } from '../../../generated/entity/docStore/document';
import { getAllKnowledgePanels } from '../../../rest/DocStoreAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import { AddWidgetModalProps } from './AddWidgetModal.interface';
import './AddWidgetModal.less';

function AddWidgetModal({
  open,
  addedWidgetsList,
  handleCloseAddWidgetModal,
  handleAddWidget,
  widgetsToShow,
}: Readonly<AddWidgetModalProps>) {
  const { t } = useTranslation();
  const [widgetsList, setWidgetsList] = useState<Array<Document>>();

  const fetchKnowledgePanels = useCallback(async () => {
    try {
      const response = await getAllKnowledgePanels({
        fqnPrefix: 'KnowledgePanel',
      });

      setWidgetsList(
        response.data.filter((widget) =>
          widgetsToShow.includes(widget.fullyQualifiedName)
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [widgetsToShow]);

  const getAddWidgetHandler = useCallback(
    (widget: Document) => () => handleAddWidget(widget),
    []
  );

  const tabItems: TabsProps['items'] = useMemo(
    () =>
      widgetsList?.map((widget) => ({
        label: getEntityName(widget),
        key: widget.fullyQualifiedName,
        disabled: addedWidgetsList.includes(widget.fullyQualifiedName),
        children: (
          <Row align="middle" className="h-min-400" justify="center">
            <Col>
              <Space align="center" direction="vertical">
                <Typography.Text>{getEntityName(widget)}</Typography.Text>
                <Tooltip
                  title={
                    addedWidgetsList.includes(widget.fullyQualifiedName)
                      ? t('message.entity-already-exists', {
                          entity: t('label.widget-lowercase'),
                        })
                      : ''
                  }>
                  <Button
                    ghost
                    className="p-x-lg m-t-md"
                    data-testid="add-widget-placeholder-button"
                    disabled={addedWidgetsList.includes(
                      widget.fullyQualifiedName
                    )}
                    icon={<PlusOutlined />}
                    type="primary"
                    onClick={getAddWidgetHandler(widget)}>
                    {t('label.add')}
                  </Button>
                </Tooltip>
              </Space>
            </Col>
          </Row>
        ),
      })),
    [widgetsList, addedWidgetsList]
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
          className="h-min-400"
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
