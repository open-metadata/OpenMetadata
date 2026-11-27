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
import {
  Box,
  Button,
  Popover,
  PopoverTrigger,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronUp,
  Sliders02,
} from '@openmetadata/ui-core-components/icons';
import { isEqual } from 'lodash';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COLLAPSED_HEADER_PROPERTY_COUNT } from '../../../constants/EntityHeaderProperties.constants';
import { EntityHeader } from '../../../generated/system/ui/page';
import {
  getDefaultEntityHeader,
  getShownHeaderProperties,
} from '../../../utils/EntityHeaderProperties.utils';
import CustomizeEntityHeaderPanel from './CustomizeEntityHeaderPanel';
import { EntityHeaderPropertiesProps } from './EntityHeaderProperties.types';
import HeaderPropertyField from './HeaderPropertyField';

const EntityHeaderProperties = ({
  entityType,
  properties,
  entityHeader,
  personaName,
  onEntityHeaderChange,
}: EntityHeaderPropertiesProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const panelAnchorRef = useRef<HTMLSpanElement>(null);

  const defaultHeader = getDefaultEntityHeader(properties);
  const resolvedHeader = entityHeader ?? defaultHeader;

  const shownProperties = getShownHeaderProperties(properties, resolvedHeader);

  const hiddenCount = shownProperties.length - COLLAPSED_HEADER_PROPERTY_COUNT;
  const isCollapsed = !isExpanded && hiddenCount > 0;
  const visibleProperties = isCollapsed
    ? shownProperties.slice(0, COLLAPSED_HEADER_PROPERTY_COUNT)
    : shownProperties;

  const cells = visibleProperties.map((property) => (
    <Box
      className="tw:min-w-0 tw:rounded-lg tw:px-2.5 tw:py-1.5 tw:transition-colors tw:hover:bg-primary_hover"
      data-testid={`header-property-${property.id}`}
      key={property.id}>
      <HeaderPropertyField property={property} />
    </Box>
  ));

  const handleApply = (updatedHeader: EntityHeader) => {
    if (!isEqual(updatedHeader, resolvedHeader)) {
      onEntityHeaderChange?.(
        isEqual(updatedHeader, defaultHeader) ? undefined : updatedHeader
      );
    }
    setIsPanelOpen(false);
  };

  return (
    <Box align="start" data-testid="data-asset-header-metadata" gap={3}>
      {isExpanded ? (
        <div className="tw:grid tw:min-w-0 tw:flex-1 tw:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] tw:gap-2">
          {cells}
        </div>
      ) : (
        <Box
          align="start"
          className="tw:min-w-0 tw:flex-1"
          colGap={6}
          rowGap={2}
          wrap="wrap">
          {cells}
        </Box>
      )}

      <Box align="center" className="tw:shrink-0 tw:py-1.5" gap={2}>
        {hiddenCount > 0 && (
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
        )}
        {onEntityHeaderChange && (
          <>
            <span
              aria-hidden
              className="tw:pointer-events-none tw:fixed tw:top-3 tw:right-3 tw:size-0"
              ref={panelAnchorRef}
            />
            <PopoverTrigger isOpen={isPanelOpen} onOpenChange={setIsPanelOpen}>
              <Button
                color="primary"
                data-testid="customize-header-button"
                iconLeading={Sliders02}
                size="sm">
                {t('label.customize-entity', { entity: t('label.header') })}
              </Button>
              <Popover
                aria-label={t('label.customize-entity', {
                  entity: t('label.header'),
                })}
                className="tw:flex tw:h-[calc(100dvh-1.5rem)] tw:w-140 tw:max-w-[calc(100vw-1.5rem)] tw:flex-col tw:overflow-hidden"
                containerClassName="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col"
                data-testid="customize-header-panel"
                offset={0}
                placement="bottom end"
                triggerRef={panelAnchorRef}>
                <CustomizeEntityHeaderPanel
                  entityHeader={resolvedHeader}
                  entityType={entityType}
                  personaName={personaName}
                  properties={properties}
                  onApply={handleApply}
                  onClose={() => setIsPanelOpen(false)}
                />
              </Popover>
            </PopoverTrigger>
          </>
        )}
      </Box>
    </Box>
  );
};

export default EntityHeaderProperties;
