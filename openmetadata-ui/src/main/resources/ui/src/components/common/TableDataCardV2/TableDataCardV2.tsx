/*
 *  Copyright 2022 Collate.
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
  Card,
  Checkbox,
  Owner,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertCircle } from '@openmetadata/ui-core-components/icons';
import { isString } from 'lodash';
import { ExtraInfo } from 'Models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityBreadcrumbs } from '../../../utils/EntityBreadcrumbPureUtils';
import { getEntityLinkFromType } from '../../../utils/EntityLinkUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getServiceIcon } from '../../../utils/EntityServiceIconUtils';
import { handleKeyboardActivation } from '../../../utils/KeyboardUtil';
import { getUsagePercentile } from '../../../utils/TablePureUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import TableDataCardBody from '../../Database/TableDataCardBody/TableDataCardBody';
import { EntityHeader } from '../../Entity/EntityHeader/EntityHeader.component';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';

export interface TableDataCardPropsV2 {
  id: string;
  source: SearchedDataProps['data'][number]['_source'];
  handleSummaryPanelDisplay?: (
    details: SearchedDataProps['data'][number]['_source'],
    entityType: string
  ) => void;
  checked?: boolean;
  showCheckboxes?: boolean;
  openEntityInNewPage?: boolean;
  showBody?: boolean;
  showName?: boolean;
  errorMessage?: string;
}

/**
 * @deprecated will be removed
 */
const TableDataCardV2 = ({
  id,
  source,
  handleSummaryPanelDisplay,
  showCheckboxes,
  showBody = true,
  showName = true,
  checked,
  openEntityInNewPage,
  errorMessage,
}: TableDataCardPropsV2) => {
  const { theme } = useApplicationStore();
  const { t } = useTranslation();
  const { tab } = useRequiredParams<{ tab: string }>();

  const otherDetails = useMemo(() => {
    const _otherDetails: ExtraInfo[] = [
      {
        key: 'Owner',
        value: <Owner owners={(source.owners as EntityReference[]) ?? []} />,
      },
    ];

    if (
      source.entityType !== EntityType.GLOSSARY_TERM &&
      source.entityType !== EntityType.TAG
    ) {
      const tierName = isString(source.tier)
        ? source.tier
        : getEntityName(source.tier);
      _otherDetails.push({
        key: 'Tier',
        value: source.tier ? tierName : '',
      });
    }

    if ('usageSummary' in source) {
      _otherDetails.push({
        value: getUsagePercentile(
          source.usageSummary?.weeklyStats?.percentileRank || 0,
          true
        ),
      });
    }

    if ('tableType' in source) {
      _otherDetails.push({
        key: 'Type',
        value: source.tableType,
        showLabel: true,
      });
    }

    return _otherDetails;
  }, [source]);

  const serviceIcon = useMemo(() => {
    return getServiceIcon(source, 'tw:size-5.5');
  }, [source]);

  const breadcrumbs = useMemo(
    () => getEntityBreadcrumbs(source, source.entityType as EntityType),
    [source]
  );

  const entityUrl = useMemo(() => {
    if (!source.fullyQualifiedName) {
      return undefined;
    }
    const entityPath = getEntityLinkFromType(
      source.fullyQualifiedName,
      source.entityType as EntityType,
      source
    );

    return entityPath
      ? `${globalThis.location.origin}${entityPath}`
      : undefined;
  }, [source]);

  const handleSelect = () => handleSummaryPanelDisplay?.(source, tab);

  return (
    <Card
      className={errorMessage ? 'tw:border-error' : undefined}
      data-testid={'table-data-card_' + (source.fullyQualifiedName ?? '')}
      id={id}
      isClickable={Boolean(handleSummaryPanelDisplay)}
      isSelected={showCheckboxes && checked}
      role="button"
      tabIndex={0}
      variant="elevated"
      onClick={handleSelect}
      onKeyDown={handleKeyboardActivation(handleSelect, true)}>
      <Card.Content>
        <Box direction="col" gap={3}>
          <Box align="start" gap={4} wrap="nowrap">
            {showCheckboxes && (
              // Same test id as ExploreSearchCard's checkbox, so Playwright selects assets the same way.
              // react-aria stops click propagation, so the card handler won't fire.
              <Box className="tw:mt-1">
                <Checkbox
                  aria-label={t('label.select-entity', {
                    entity: t('label.asset'),
                  })}
                  data-testid="asset-checkbox"
                  isSelected={Boolean(checked)}
                  size="md"
                  onChange={handleSelect}
                />
              </Box>
            )}
            <Box
              className="tw:min-w-0 tw:flex-1 tw:[&_[data-testid=entity-header-copy-button]>[data-icon]]:size-3"
              direction="col">
              <EntityHeader
                showOnlyDisplayName
                titleIsLink
                breadcrumb={breadcrumbs}
                displayNameClassName="text-sm"
                entityData={source}
                entityType={source.entityType as EntityType}
                entityUrl={entityUrl}
                icon={serviceIcon}
                nameClassName="text-sm"
                openEntityInNewPage={openEntityInNewPage}
                serviceName={source?.service?.name ?? ''}
                showName={showName}
                titleColor={theme.primaryColor}
              />
            </Box>
          </Box>
          {showBody && (
            <TableDataCardBody
              description={source.description || ''}
              extraInfo={otherDetails}
              tags={source.tags}
            />
          )}
        </Box>
      </Card.Content>
      {errorMessage && (
        <Card.Footer data-testid="table-data-card-error">
          <Box align="start" gap={3}>
            <AlertCircle
              aria-hidden
              className="tw:size-5 tw:text-fg-error-primary"
            />
            <Typography
              as="span"
              className="tw:break-all tw:text-error-primary"
              size="text-xs">
              {errorMessage}
            </Typography>
          </Box>
        </Card.Footer>
      )}
    </Card>
  );
};

export default TableDataCardV2;
