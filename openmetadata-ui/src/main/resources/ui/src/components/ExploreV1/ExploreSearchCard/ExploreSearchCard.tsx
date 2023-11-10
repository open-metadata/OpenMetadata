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
import { Button, Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { isString, startCase, uniqueId } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/type';
import {
  getEntityPlaceHolder,
  getOwnerValue,
} from '../../../utils/CommonUtils';
import {
  getEntityBreadcrumbs,
  getEntityId,
  getEntityLinkFromType,
  getEntityName,
} from '../../../utils/EntityUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import {
  getEntityIcon,
  getServiceIcon,
  getUsagePercentile,
} from '../../../utils/TableUtils';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import TableDataCardBody from '../../TableDataCardBody/TableDataCardBody';
import { useTourProvider } from '../../TourProvider/TourProvider';
import './explore-search-card.less';
import { ExploreSearchCardProps } from './ExploreSearchCard.interface';

const ExploreSearchCard: React.FC<ExploreSearchCardProps> = forwardRef<
  HTMLDivElement,
  ExploreSearchCardProps
>(
  (
    {
      id,
      className,
      source,
      matches,
      showEntityIcon,
      handleSummaryPanelDisplay,
      showTags = true,
      openEntityInNewPage,
      hideBreadcrumbs = false,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const { tab } = useParams<{ tab: string }>();
    const { isTourOpen } = useTourProvider();
    const otherDetails = useMemo(() => {
      const tierValue = isString(source.tier)
        ? source.tier
        : getEntityName(source.tier);
      const profileName =
        source.owner?.type === OwnerType.USER ? source.owner?.name : undefined;

      const _otherDetails: ExtraInfo[] = [
        {
          key: 'Owner',
          value: getOwnerValue(source.owner as EntityReference),
          placeholderText: getEntityPlaceHolder(
            getEntityName(source.owner as EntityReference),
            source.owner?.deleted
          ),
          id: getEntityId(source.owner as EntityReference),
          isEntityDetails: true,
          isLink: true,
          openInNewTab: false,
          profileName,
        },
      ];

      if (source?.domain) {
        const domain = getEntityName(source.domain);
        const domainLink = getDomainPath(source.domain.fullyQualifiedName);
        _otherDetails.push({
          key: 'Domain',
          value: domainLink,
          placeholderText: domain,
          isLink: true,
          openInNewTab: false,
        });
      }

      if (
        source.entityType !== EntityType.GLOSSARY_TERM &&
        source.entityType !== EntityType.TAG &&
        source.entityType !== EntityType.DATA_PRODUCT
      ) {
        _otherDetails.push({
          key: 'Tier',
          value: tierValue,
        });
      }

      if ('usageSummary' in source) {
        _otherDetails.push({
          value: getUsagePercentile(
            source.usageSummary?.weeklyStats?.percentileRank ?? 0,
            true
          ),
        });
      }

      return _otherDetails;
    }, [source]);

    const serviceIcon = useMemo(() => {
      return getServiceIcon(source);
    }, [source]);

    const breadcrumbs = useMemo(
      () => getEntityBreadcrumbs(source, source.entityType as EntityType, true),
      [source]
    );

    const entityIcon = useMemo(() => {
      if (showEntityIcon) {
        if (source.entityType === 'glossaryTerm') {
          if (source.style?.iconURL) {
            return (
              <img
                className="align-middle m-r-xs object-contain"
                data-testid="icon"
                height={24}
                src={source.style.iconURL}
                width={24}
              />
            );
          }

          return;
        }

        return (
          <span className="w-6 h-6 m-r-xs d-inline-flex text-xl align-middle">
            {getEntityIcon(source.entityType ?? '')}
          </span>
        );
      }

      return;
    }, [source, showEntityIcon, getEntityIcon]);

    const header = useMemo(() => {
      return (
        <Row gutter={[8, 8]}>
          {!hideBreadcrumbs && (
            <Col span={24}>
              <div className="d-flex gap-2 items-center">
                {serviceIcon}
                <div className="entity-breadcrumb" data-testid="category-name">
                  <TitleBreadcrumb
                    titleLinks={breadcrumbs}
                    widthDeductions={780}
                  />
                </div>
              </div>
            </Col>
          )}
          <Col data-testid={`${source.service?.name}-${source.name}`} span={24}>
            {isTourOpen ? (
              <Button data-testid={source.fullyQualifiedName} type="link">
                <Typography.Text
                  className="text-lg font-medium text-link-color"
                  data-testid="entity-header-display-name">
                  {stringToHTML(getEntityName(source))}
                </Typography.Text>
              </Button>
            ) : (
              <div className="w-full d-flex items-start">
                {entityIcon}

                <Link
                  className="no-underline w-full line-height-22"
                  data-testid="entity-link"
                  target={openEntityInNewPage ? '_blank' : '_self'}
                  to={
                    source.fullyQualifiedName && source.entityType
                      ? getEntityLinkFromType(
                          source.fullyQualifiedName,
                          source.entityType as EntityType
                        )
                      : ''
                  }>
                  <Typography.Text
                    className="text-lg font-medium text-link-color break-word"
                    data-testid="entity-header-display-name">
                    {stringToHTML(getEntityName(source))}
                  </Typography.Text>
                </Link>
              </div>
            )}
          </Col>
        </Row>
      );
    }, [breadcrumbs, source, hideBreadcrumbs]);

    return (
      <div
        className={classNames('explore-search-card', className)}
        data-testid="table-data-card"
        id={id}
        ref={ref}
        onClick={() => {
          handleSummaryPanelDisplay?.(source, tab);
        }}>
        {header}

        <div className="p-t-sm">
          <TableDataCardBody
            description={source.description ?? ''}
            extraInfo={otherDetails}
            tags={showTags ? source.tags : []}
          />
        </div>
        {matches && matches.length > 0 ? (
          <div
            className="p-t-sm text-grey-muted text-xs"
            data-testid="matches-stats">
            <span>{`${t('label.matches')}:`}</span>
            {matches.map((data, i) => (
              <span className="m-l-xs" key={uniqueId()}>
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

export default ExploreSearchCard;
