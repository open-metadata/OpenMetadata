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
import { Button, Col, Image, Radio, RadioChangeEvent, Row, Space, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageType } from '../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import customizeDetailPageClassBase from '../../../../utils/CustomizeDetailPage/CustomizeDetailPageClassBase';
import customizePageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { Tooltip } from '../../../common/AntdCompat';
import { AddWidgetTabContentProps } from './AddWidgetModal.interface';
;

function AddWidgetTabContent({
  getAddWidgetHandler,
  maxGridSizeSupport,
  widget,
  widgetSizeOptions,
}: Readonly<AddWidgetTabContentProps>) {
  const { t } = useTranslation();
  const [selectedWidgetSize, setSelectedWidgetSize] = useState<number>(
    widgetSizeOptions[0].value
  );
  const { currentPageType } = useCustomizeStore();

  const widgetAddable = useMemo(
    () => selectedWidgetSize <= maxGridSizeSupport,
    [selectedWidgetSize, maxGridSizeSupport]
  );

  const widgetImage = useMemo(() => {
    switch (currentPageType) {
      case PageType.Glossary:
      case PageType.GlossaryTerm:
        return customizeDetailPageClassBase.getGlossaryWidgetImageFromKey(
          widget.fullyQualifiedName,
          selectedWidgetSize
        );
      case PageType.LandingPage:
        return customizePageClassBase.getWidgetImageFromKey(
          widget.fullyQualifiedName,
          selectedWidgetSize
        );
      default:
        return customizeDetailPageClassBase.getDetailPageWidgetImageFromKey(
          widget.fullyQualifiedName,
          selectedWidgetSize
        );
    }
  }, [widget, selectedWidgetSize, currentPageType]);

  const handleSizeChange = useCallback((e: RadioChangeEvent) => {
    setSelectedWidgetSize(e.target.value);
  }, []);

  return (
    <Row data-testid={widget.id}>
      <Col span={24}>
        <Space>
          <Typography.Text>{`${t('label.size')}:`}</Typography.Text>
          <Radio.Group
            data-testid="size-selector-button"
            defaultValue={selectedWidgetSize}
            optionType="button"
            options={widgetSizeOptions}
            onChange={handleSizeChange}
          />
        </Space>
      </Col>
      <Col span={24}>
        <Row className="h-min-480" justify="center">
          <Col>
            <Space align="center" direction="vertical">
              <Image
                className="p-y-md"
                data-testid="widget-image"
                preview={false}
                src={widgetImage}
              />
              <Typography.Paragraph
                className="d-block text-center"
                data-testid="widget-description">
                {widget.description}
              </Typography.Paragraph>
              <Tooltip
                placement="bottom"
                title={widgetAddable ? '' : t('message.can-not-add-widget')}>
                <Button
                  className="p-x-lg m-t-md"
                  data-testid="add-widget-button"
                  disabled={!widgetAddable}
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={getAddWidgetHandler(widget, selectedWidgetSize)}>
                  {t('label.add')}
                </Button>
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Col>
    </Row>
  );
}

export default AddWidgetTabContent;
