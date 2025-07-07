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

import { Checkbox, Col, Row } from 'antd';
import classNames from 'classnames';
import { isString, startCase } from 'lodash';
import { ExtraInfo } from 'Models';
import { forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getEntityBreadcrumbs,
  getEntityName,
} from '../../../utils/EntityUtils';
import { getServiceIcon, getUsagePercentile } from '../../../utils/TableUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import TableDataCardBody from '../../Database/TableDataCardBody/TableDataCardBody';
import { EntityHeader } from '../../Entity/EntityHeader/EntityHeader.component';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import { OwnerLabel } from '../OwnerLabel/OwnerLabel.component';
import './TableDataCardV2.less';

export interface TableDataCardPropsV2 {
  id: string;
  className?: string;
  source: SearchedDataProps['data'][number]['_source'];
  matches?: {
    key: string;
    value: number;
  }[];
  handleSummaryPanelDisplay?: (
    details: SearchedDataProps['data'][number]['_source'],
    entityType: string
  ) => void;
  checked?: boolean;
  showCheckboxes?: boolean;
  openEntityInNewPage?: boolean;
  showBody?: boolean;
  showName?: boolean;
  nameClassName?: string;
  displayNameClassName?: string;
}

/**
 * @deprecated will be removed
 */
const TableDataCardV2: React.FC<TableDataCardPropsV2> = forwardRef<
  HTMLDivElement,
  TableDataCardPropsV2
>(
  (
    {
      id,
      className,
      source,
      matches,
      handleSummaryPanelDisplay,
      showCheckboxes,
      showBody = true,
      showName = true,
      checked,
      openEntityInNewPage,
      nameClassName = '',
      displayNameClassName = '',
    },
    ref
  ) => {
    const { theme } = useApplicationStore();
    const { t } = useTranslation();
    const { tab } = useRequiredParams<{ tab: string }>();

    const otherDetails = useMemo(() => {
      const _otherDetails: ExtraInfo[] = [
        {
          key: 'Owner',
          value: (
            <OwnerLabel owners={(source.owners as EntityReference[]) ?? []} />
          ),
        },
      ];

      if (
        source.entityType !== EntityType.GLOSSARY_TERM &&
        source.entityType !== EntityType.TAG
      ) {
        _otherDetails.push({
          key: 'Tier',
          value: source.tier
            ? isString(source.tier)
              ? source.tier
              : getEntityName(source.tier)
            : '',
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
      return getServiceIcon(source);
    }, [source]);

    const breadcrumbs = useMemo(
      () => getEntityBreadcrumbs(source, source.entityType as EntityType),
      [source]
    );

    return (
      <div
        className={classNames(
          'data-asset-info-card-container',
          'table-data-card-container',
          className
        )}
        data-testid={'table-data-card_' + (source.fullyQualifiedName ?? '')}
        id={id}
        ref={ref}
        onClick={() => {
          handleSummaryPanelDisplay && handleSummaryPanelDisplay(source, tab);
        }}>
        <Row className="data-asset-info-row" wrap={false}>
          {showCheckboxes && (
            <Col className="flex-center" flex="20px">
              <Checkbox checked={checked} />
            </Col>
          )}
          <Col flex="auto">
            <EntityHeader
              showOnlyDisplayName
              titleIsLink
              breadcrumb={breadcrumbs}
              displayNameClassName={displayNameClassName}
              entityData={source}
              entityType={source.entityType as EntityType}
              icon={serviceIcon}
              nameClassName={nameClassName}
              openEntityInNewPage={openEntityInNewPage}
              serviceName={source?.service?.name ?? ''}
              showName={showName}
              titleColor={theme.primaryColor}
            />
          </Col>
        </Row>

        {showBody && (
          <div className="p-t-sm">
            <TableDataCardBody
              description={source.description || ''}
              extraInfo={otherDetails}
              tags={source.tags}
            />
          </div>
        )}

        {matches && matches.length > 0 ? (
          <div className="p-t-xs" data-testid="matches-stats">
            <span className="text-grey-muted">{`${t('label.matches')}:`}</span>
            {matches.map((data, i) => (
              <span className="m-t-xs" key={i}>
                {`${data.value} in ${startCase(data.key)}${
                  i !== matches.length - 1 ? ',' : ''
                }`}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
);

export default TableDataCardV2;
