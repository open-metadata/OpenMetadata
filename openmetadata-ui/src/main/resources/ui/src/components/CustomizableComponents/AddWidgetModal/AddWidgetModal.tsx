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
import { Button, Col, Modal, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Document } from '../../../generated/entity/docStore/document';
import { getAllKnowledgePanels } from '../../../rest/DocStoreAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AddWidgetModalProps } from './AddWidgetModal.interface';
import './AddWidgetModal.less';

function AddWidgetModal({
  open,
  handleCloseAddWidgetModal,
  handleAddWidget,
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
    (widget: Document) => () => handleAddWidget(widget),
    []
  );

  const tabItems = useMemo(
    () =>
      widgetsList?.map((widget) => ({
        label: getEntityName(widget),
        key: widget.fullyQualifiedName,
        children: (
          <Row align="middle" className="h-full" justify="center">
            <Col span={24}>{getEntityName(widget)}</Col>
            <Col span={24}>
              <Button
                ghost
                className="p-x-lg m-t-md"
                data-testid="add-widget-placeholder-button"
                icon={<PlusOutlined />}
                type="primary"
                onClick={getAddWidgetHandler(widget)}>
                {t('label.add')}
              </Button>
            </Col>
          </Row>
        ),
      })),
    [widgetsList]
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
      <Tabs items={tabItems} tabPosition="left" />
    </Modal>
  );
}

export default AddWidgetModal;
