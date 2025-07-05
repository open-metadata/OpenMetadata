/*
 *  Copyright 2025 Collate.
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

import { MoreOutlined } from '@ant-design/icons';
import { Button, Card, Dropdown } from 'antd';
import { MenuInfo } from 'rc-menu/lib/interface';
import { ReactNode } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { WidgetConfig } from '../../../../../pages/CustomizablePage/CustomizablePage.interface';
import EntityListSkeleton from '../../../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import './widget-wrapper.less';

export interface WidgetWrapperProps {
  children: ReactNode;
  loading?: boolean;
  dataLength?: number;
  skeletonContainerStyle?: React.CSSProperties;
  className?: string;
  dataTestId?: string;
  isEditView?: boolean;
  widgetKey?: string;
  currentLayout?: Layout[];
  handleRemoveWidget?: (widgetKey: string) => void;
  handleLayoutUpdate?: (layout: Layout[]) => void;
  widgetConfig?: WidgetConfig;
  customMoreMenuItems?: Array<{
    key: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
  }>;
  onCustomMoreMenuClick?: (e: MenuInfo) => void;
}

const WidgetWrapper = ({
  children,
  loading = false,
  dataLength = 5,
  skeletonContainerStyle = { marginLeft: '20px', marginTop: '20px' },
  className = '',
  dataTestId = 'widget-wrapper',
  isEditView = false,
  widgetKey = '',
  currentLayout = [],
  handleRemoveWidget,
  handleLayoutUpdate,
  widgetConfig,
  customMoreMenuItems = [],
  onCustomMoreMenuClick,
}: WidgetWrapperProps) => {
  const { t } = useTranslation();

  const handleSizeChange = (value: number) => {
    if (handleLayoutUpdate && widgetConfig) {
      const hasCurrentWidget = currentLayout?.find(
        (layout: WidgetConfig) => layout.i === widgetKey
      );

      const updatedLayout = hasCurrentWidget
        ? currentLayout?.map((layout: WidgetConfig) =>
            layout.i === widgetKey
              ? { ...layout, config: { ...layout.config }, w: value }
              : layout
          )
        : [
            ...(currentLayout || []),
            {
              ...widgetConfig,
              i: widgetKey,
              config: {
                ...widgetConfig.config,
              },
              w: value,
            },
          ];

      handleLayoutUpdate(updatedLayout as Layout[]);
    }
  };

  const handleMoreClick = (e: MenuInfo) => {
    if (e.key === 'remove') {
      handleRemoveWidget?.(widgetKey);
    } else if (e.key === 'half_size') {
      handleSizeChange(1);
    } else if (e.key === 'full_size') {
      handleSizeChange(2);
    } else {
      onCustomMoreMenuClick?.(e);
    }
  };

  const getMoreMenuItems = () => {
    const defaultItems = [
      {
        key: 'half_size',
        label: t('label.half-size'),
      },
      {
        key: 'full_size',
        label: t('label.full-size'),
      },
      {
        key: 'remove',
        label: t('label.remove'),
      },
    ];

    return [...customMoreMenuItems, ...defaultItems];
  };

  const renderMoreOptions = () => {
    if (!isEditView) {
      return null;
    }

    return (
      <Dropdown
        className="widget-wrapper-more-options"
        data-testid="widget-more-options"
        menu={{
          items: getMoreMenuItems(),
          selectable: false,
          onClick: handleMoreClick,
          className: 'widget-wrapper-more-menu',
        }}
        placement="bottomLeft"
        trigger={['click']}>
        <Button
          className="widget-wrapper-more-button"
          data-testid="widget-more-button"
          icon={<MoreOutlined size={20} />}
        />
      </Dropdown>
    );
  };

  return (
    <Card
      className={`widget-wrapper-container card-widget ${className}`}
      data-testid={dataTestId}>
      <EntityListSkeleton
        dataLength={dataLength}
        loading={loading}
        skeletonContainerStyle={skeletonContainerStyle}>
        <div className="widget-wrapper-content">
          {children}
          {renderMoreOptions()}
        </div>
      </EntityListSkeleton>
    </Card>
  );
};

export default WidgetWrapper;
