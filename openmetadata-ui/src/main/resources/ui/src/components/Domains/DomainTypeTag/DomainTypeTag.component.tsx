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

import { Popover, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropDownIcon } from '../../../assets/svg/drop-down.svg';
import { ReactComponent as AggregateIconColored } from '../../../assets/svg/tags/ic-aggregate-colored.svg';
import { ReactComponent as AggregateIcon } from '../../../assets/svg/tags/ic-aggregate.svg';
import { ReactComponent as ConsumerAlignedIconColored } from '../../../assets/svg/tags/ic-consumer-aligned-colored.svg';
import { ReactComponent as ConsumerAlignedIcon } from '../../../assets/svg/tags/ic-consumer-aligned.svg';
import { ReactComponent as SourceAlignedIconColored } from '../../../assets/svg/tags/ic-source-aligned-colored.svg';
import { ReactComponent as SourceAlignedIcon } from '../../../assets/svg/tags/ic-source-aligned.svg';
import { DomainType } from '../../../generated/entity/domains/domain';
import {
  DomainTypeConfig,
  DomainTypeTagProps,
} from './DomainTypeTag.interface';

import './domain-type-tag.less';

const { Text } = Typography;

export const DomainTypeTag = ({
  className = '',
  disabled = false,
  domainType,
  onDomainTypeSelect,
  showModal = false,
  size = 'default',
}: DomainTypeTagProps) => {
  const { t } = useTranslation();
  const [isPopoverVisible, setIsPopoverVisible] = useState(false);

  // Domain type configuration
  const domainTypeConfigs: Record<string, DomainTypeConfig> = useMemo(
    () => ({
      [DomainType.Aggregate]: {
        className: 'aggregate-domain-type',
        description: t('message.aggregate-domain-description'),
        icon: <AggregateIcon />,
        coloredIcon: <AggregateIconColored />,
        label: t('label.aggregate'),
      },
      [DomainType.ConsumerAligned]: {
        className: 'consumer-aligned-domain-type',
        description: t('message.consumer-aligned-domain-description'),
        coloredIcon: <ConsumerAlignedIconColored />,
        icon: <ConsumerAlignedIcon />,
        label: t('label.consumer-aligned'),
      },
      [DomainType.SourceAligned]: {
        className: 'source-aligned-domain-type',
        description: t('message.source-aligned-domain-description'),
        icon: <SourceAlignedIcon />,
        coloredIcon: <SourceAlignedIconColored />,
        label: t('label.source-aligned'),
      },
    }),
    [t]
  );

  const currentConfig =
    domainTypeConfigs[domainType] || domainTypeConfigs[DomainType.Aggregate];

  const handleDomainTypeClick = useCallback(
    (selectedType: string) => {
      if (onDomainTypeSelect && !disabled) {
        onDomainTypeSelect(selectedType);
        setIsPopoverVisible(false);
      }
    },
    [onDomainTypeSelect, disabled]
  );

  const renderDomainTypeOption = useCallback(
    (type: string, config: DomainTypeConfig) => (
      <div
        className={`domain-type-option ${config.className} ${
          type === domainType ? 'selected' : ''
        }`}
        key={type}
        onClick={() => handleDomainTypeClick(type)}>
        <div className="domain-type-option-content">
          {config.icon && (
            <span
              className={`${config.className}-icon domain-type-option-icon`}>
              {config.icon}
            </span>
          )}
          <div className="domain-type-option-text">
            <Text className="domain-type-option-label">{config.label}</Text>
          </div>
        </div>
      </div>
    ),
    [domainType, handleDomainTypeClick]
  );

  const popoverContent = useMemo(
    () => (
      <div className="domain-type-popover-content">
        <div className="domain-type-options">
          {Object.entries(domainTypeConfigs).map(([type, config]) =>
            renderDomainTypeOption(type, config)
          )}
        </div>
      </div>
    ),
    [domainTypeConfigs, renderDomainTypeOption, t]
  );

  const shouldShowModal = showModal && !disabled;

  const domainTypeTag = (
    <div
      className={`domain-type-tag ${
        currentConfig.className
      } ${size} ${className} ${disabled ? 'disabled' : ''} ${
        showModal && !disabled ? 'interactive' : ''
      }`}>
      <div className="domain-type-tag-content">
        {currentConfig.coloredIcon && (
          <span className="domain-type-tag-icon">
            {currentConfig.coloredIcon}
          </span>
        )}
        <Text className="domain-type-tag-label">{currentConfig.label}</Text>
        {shouldShowModal && (
          <DropDownIcon
            className="domain-type-tag-dropdown-icon"
            onClick={(e) => {
              e.stopPropagation();
              setIsPopoverVisible(true);
            }}
          />
        )}
      </div>
    </div>
  );

  if (shouldShowModal) {
    return (
      <Popover
        content={popoverContent}
        open={isPopoverVisible}
        overlayClassName="domain-type-tag-popover"
        placement="bottomLeft"
        trigger="click"
        onOpenChange={setIsPopoverVisible}>
        {domainTypeTag}
      </Popover>
    );
  }

  return domainTypeTag;
};

export default DomainTypeTag;
