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
import { Typography } from 'antd';
import { isEmpty, orderBy, toLower } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainNoDataPlaceholder } from '../../../../assets/svg/domain-no-data-placeholder.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domains-widget.svg';
import {
  ERROR_PLACEHOLDER_TYPE,
  SORT_ORDER,
} from '../../../../enums/common.enum';
import { Domain } from '../../../../generated/entity/domains/domain';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { getDomainList } from '../../../../rest/domainAPI';
import { getDomainIcon } from '../../../../utils/DomainUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './domains-widget.less';
import {
  DOMAIN_SORT_BY_KEYS,
  DOMAIN_SORT_BY_OPTIONS,
} from './DomainsWidget.constants';

const DomainsWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey = 'domains-widget',
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    DOMAIN_SORT_BY_KEYS.LATEST
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDomainList({ limit: 100, fields: ['assets'] });
      setDomains(res.data || []);
    } catch {
      setError(t('message.fetch-domain-list-error'));
    } finally {
      setLoading(false);
    }
  };

  const domainsWidget = useMemo(() => {
    const widget = currentLayout?.find(
      (widget: WidgetConfig) => widget.i === widgetKey
    );

    return widget;
  }, [currentLayout, widgetKey]);

  const isFullSize = useMemo(() => {
    return domainsWidget?.w === 2;
  }, [domainsWidget]);

  useEffect(() => {
    fetchDomains();
  }, []);

  const sortedDomains = useMemo(() => {
    if (selectedSortBy === DOMAIN_SORT_BY_KEYS.LATEST) {
      return orderBy(domains, [(item) => item.updatedAt], [SORT_ORDER.DESC]);
    } else if (selectedSortBy === DOMAIN_SORT_BY_KEYS.A_TO_Z) {
      return orderBy(
        domains,
        [(item) => toLower(item.displayName || item.name)],
        [SORT_ORDER.ASC]
      );
    } else if (selectedSortBy === DOMAIN_SORT_BY_KEYS.Z_TO_A) {
      return orderBy(
        domains,
        [(item) => toLower(item.displayName || item.name)],
        [SORT_ORDER.DESC]
      );
    }

    return domains;
  }, [domains, selectedSortBy]);

  const handleSortByClick = useCallback((key: string) => {
    setSelectedSortBy(key);
  }, []);

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        actionButtonLink="/domain"
        actionButtonText="Explore Domain"
        description={t('message.domains-no-data-message')}
        icon={<DomainNoDataPlaceholder />}
        title={t('label.no-domains-yet')}
      />
    ),
    [t]
  );

  const domainsList = useMemo(
    () => (
      <div className="entity-list-body">
        <div className="domains-widget-grid">
          {sortedDomains.map((domain) => (
            <div
              className={`domain-card${isFullSize ? ' domain-card-full' : ''}`}
              key={domain.id}>
              {isFullSize ? (
                <>
                  <div
                    className="domain-card-full-icon"
                    style={{ background: domain.style?.color }}>
                    {getDomainIcon(domain.style?.iconURL)}
                  </div>
                  <div className="domain-card-full-content">
                    <div className="domain-card-full-title-row">
                      <Typography.Text
                        className="text-md"
                        ellipsis={{
                          tooltip: true,
                        }}
                        style={{ fontWeight: 600 }}>
                        {domain.displayName || domain.name}
                      </Typography.Text>
                      <span className="domain-card-full-count">
                        {domain.assets?.length || 0}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="domain-card-bar"
                    style={{ background: domain.style?.color }}
                  />
                  <div className="domain-card-content">
                    <span className="domain-card-title">
                      <div className="domain-card-icon">
                        {getDomainIcon(domain.style?.iconURL)}
                      </div>
                      <Typography.Text
                        className="domain-card-name"
                        ellipsis={{ tooltip: true }}
                        style={{ marginBottom: 0 }}>
                        {domain.displayName || domain.name}
                      </Typography.Text>
                    </span>
                    <span className="domain-card-count">
                      {domain.assets?.length || 0}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    [sortedDomains, isFullSize]
  );

  const footer = useMemo(
    () => (
      <WidgetFooter
        moreButtonLink="/domain"
        moreButtonText={t('label.view-more-count', {
          count:
            sortedDomains.length > 10 ? sortedDomains.length - 10 : undefined,
        })}
        showMoreButton={Boolean(!loading)}
      />
    ),
    [t, sortedDomains.length, loading]
  );

  return (
    <WidgetWrapper
      dataLength={domains.length !== 0 ? domains.length : 10}
      loading={loading}>
      <div className="domains-widget-container">
        <WidgetHeader
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={
            <DomainIcon
              className="domains-widget-globe"
              height={24}
              width={24}
            />
          }
          isEditView={isEditView}
          selectedSortBy={selectedSortBy}
          sortOptions={DOMAIN_SORT_BY_OPTIONS}
          title={t('label.domain-plural')}
          widgetKey={widgetKey}
          widgetWidth={2}
          onSortChange={handleSortByClick}
        />
        <div className="widget-content flex-1">
          {error ? (
            <ErrorPlaceHolder
              className="domains-widget-error border-none"
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              {error}
            </ErrorPlaceHolder>
          ) : isEmpty(sortedDomains) ? (
            emptyState
          ) : (
            domainsList
          )}
        </div>
        {!isEmpty(sortedDomains) && footer}
      </div>
    </WidgetWrapper>
  );
};

export default DomainsWidget;
