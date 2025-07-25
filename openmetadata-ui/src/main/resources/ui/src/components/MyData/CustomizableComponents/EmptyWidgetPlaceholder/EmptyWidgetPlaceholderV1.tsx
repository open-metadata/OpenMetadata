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
import { Button, Typography } from 'antd';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import WidgetWrapper from '../../Widgets/Common/WidgetWrapper/WidgetWrapper';
import './empty-widget-placeholder-v1.less';
import { EmptyWidgetPlaceholderV1Props } from './EmptyWidgetPlaceholderV1.interface';

function EmptyWidgetPlaceholderV1({
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  widgetKey,
}: Readonly<EmptyWidgetPlaceholderV1Props>) {
  const { t } = useTranslation();

  const handleAddClick = useCallback(() => {
    handlePlaceholderWidgetKey(widgetKey);
    handleOpenAddWidgetModal();
  }, []);

  const widgetContent = (
    <div className="empty-widget-placeholder-v1-content">
      <Typography.Title className="add-widgets-title" level={4}>
        {t('label.add-new-widget-plural')}
      </Typography.Title>
      <Typography.Text className="add-widgets-description">
        {t('message.tailor-experience-for-persona')}
      </Typography.Text>
      <Button
        className="add-widgets-button"
        data-testid="add-widget-button"
        icon={<PlusOutlined />}
        type="primary"
        onClick={handleAddClick}>
        {t('label.add-widget-plural')}
      </Button>
    </div>
  );

  return (
    <WidgetWrapper
      className="empty-widget-placeholder-v1"
      data-testid={widgetKey}>
      {widgetContent}
    </WidgetWrapper>
  );
}

export default EmptyWidgetPlaceholderV1;
