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
import Icon from '@ant-design/icons';
import { Card, Typography } from 'antd';
import { startCase } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/ic-check-circle-new.svg';
import { Document as DocStoreDocument } from '../../../../generated/entity/docStore/document';
import { PageType } from '../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import customizeDetailPageClassBase from '../../../../utils/CustomizeDetailPage/CustomizeDetailPageClassBase';
import customizePageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import './widget-card.less';

interface WidgetCardProps {
  widget: DocStoreDocument;
  isSelected: boolean;
  onSelectWidget?: (id: string) => void;
}

const WidgetCard = ({
  widget,
  isSelected,
  onSelectWidget,
}: WidgetCardProps) => {
  const { t } = useTranslation();
  const { currentPageType } = useCustomizeStore();

  const widgetImage = useMemo(() => {
    switch (currentPageType) {
      case PageType.Glossary:
      case PageType.GlossaryTerm:
        return customizeDetailPageClassBase.getGlossaryWidgetImageFromKey(
          widget.fullyQualifiedName,
          1
        );
      case PageType.LandingPage:
        return customizePageClassBase.getWidgetImageFromKey(
          widget.fullyQualifiedName,
          1
        );
      default:
        return customizeDetailPageClassBase.getDetailPageWidgetImageFromKey(
          widget.fullyQualifiedName,
          1
        );
    }
  }, [currentPageType, widget]);

  const handleClick = () => {
    onSelectWidget?.(widget.id ?? '');
  };

  return (
    <Card
      className={`widget-card h-full d-flex flex-col ${
        isSelected ? 'selected' : ''
      }`}
      data-testid="widget-card"
      onClick={handleClick}>
      <div className="widget-card-content d-flex justify-between items-center flex-1">
        <img
          alt={widget.name}
          className="h-full w-full"
          data-testid="widget-image"
          src={widgetImage}
        />
        {isSelected && (
          <div className="check-box bg-white border-radius-sm p-sm d-flex items-center justify-center">
            <Icon className="check-icon" component={CheckIcon} />
          </div>
        )}
      </div>
      <div className="p-t-md p-x-sm">
        <Typography.Text className="text-sm font-medium">
          {startCase(widget.name)}
        </Typography.Text>
        <Typography.Paragraph
          className="widget-desc m-t-xs text-xs font-regular"
          data-testid="widget-description">
          {widget.description ?? t('message.no-description-available')}
        </Typography.Paragraph>
      </div>
    </Card>
  );
};

export default WidgetCard;
