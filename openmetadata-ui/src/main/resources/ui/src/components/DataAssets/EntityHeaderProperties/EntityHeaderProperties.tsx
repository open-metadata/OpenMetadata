/*
 *  Copyright 2026 Collate.
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
import { Button } from '@openmetadata/ui-core-components';
import { ChevronDown, ChevronUp } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COLLAPSED_HEADER_PROPERTY_COUNT } from '../../../constants/EntityHeaderProperties.constants';
import { getShownHeaderProperties } from '../../../utils/EntityHeaderProperties.utils';
import { EntityHeaderPropertiesProps } from './EntityHeaderProperties.types';
import HeaderPropertyField from './HeaderPropertyField';

const EntityHeaderProperties = ({
  properties,
}: EntityHeaderPropertiesProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const shownProperties = getShownHeaderProperties(properties);

  const hiddenCount = shownProperties.length - COLLAPSED_HEADER_PROPERTY_COUNT;
  const isCollapsed = !isExpanded && hiddenCount > 0;
  const visibleProperties = isCollapsed
    ? shownProperties.slice(0, COLLAPSED_HEADER_PROPERTY_COUNT)
    : shownProperties;

  return (
    <div
      className="tw:flex tw:items-start tw:gap-3"
      data-testid="data-asset-header-metadata">
      <div
        className={classNames('tw:min-w-0 tw:flex-1', {
          'tw:grid tw:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] tw:gap-2':
            isExpanded,
          'tw:flex tw:flex-wrap tw:items-start tw:gap-x-6 tw:gap-y-2':
            !isExpanded,
        })}>
        {visibleProperties.map((property) => (
          <div
            className="tw:min-w-0 tw:rounded-lg tw:px-2.5 tw:py-1.5 tw:transition-colors tw:hover:bg-primary_hover"
            data-testid={`header-property-${property.id}`}
            key={property.id}>
            <HeaderPropertyField property={property} />
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2 tw:py-1.5">
          <Button
            aria-expanded={isExpanded}
            color="secondary"
            data-testid="header-properties-toggle"
            iconTrailing={isExpanded ? ChevronUp : ChevronDown}
            size="sm"
            onPress={() => setIsExpanded((expanded) => !expanded)}>
            {isExpanded
              ? t('label.show-less')
              : t('label.show-count-more', { count: hiddenCount })}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EntityHeaderProperties;
