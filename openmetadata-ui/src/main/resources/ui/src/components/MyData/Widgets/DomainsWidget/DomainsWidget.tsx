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
import { Button, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DomainNoDataPlaceholder } from '../../../../assets/svg/domain-no-data-placeholder.svg';
import { ReactComponent as DomainIcon } from '../../../../assets/svg/ic-domains-widget.svg';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_LARGE,
  ROUTES,
} from '../../../../constants/constants';
import {
  applySortToData,
  getSortField,
  getSortOrder,
} from '../../../../constants/Widgets.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Domain } from '../../../../generated/entity/domains/domain';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchData } from '../../../../rest/miscAPI';
import { getDomainIcon } from '../../../../utils/DomainUtils';
import { getDomainDetailsPath } from '../../../../utils/RouterUtils';
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
  const navigate = useNavigate();
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    DOMAIN_SORT_BY_KEYS.LATEST
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sortField = getSortField(selectedSortBy);
      const sortOrder = getSortOrder(selectedSortBy);

      const res = await searchData(
        '',
        INITIAL_PAGING_VALUE,
        PAGE_SIZE_LARGE,
        '',
        sortField,
        sortOrder,
        SearchIndex.DOMAIN
      );

      const domains = res?.data?.hits?.hits.map((hit) => hit._source);
      const sortedDomains = applySortToData(domains, selectedSortBy);
      setDomains(sortedDomains as Domain[]);
    } catch {
      setError(t('message.fetch-domain-list-error'));
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSortBy, getSortField, getSortOrder, applySortToData]);

  const handleDomainClick = useCallback(
    (domain: Domain) => {
      navigate(getDomainDetailsPath(domain.fullyQualifiedName ?? ''));
    },
    [navigate]
  );

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
  }, [fetchDomains]);

  const handleSortByClick = useCallback((key: string) => {
    setSelectedSortBy(key);
  }, []);

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        actionButtonLink={ROUTES.DOMAIN}
        actionButtonText={t('label.explore-domain')}
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
          {domains.map((domain) => (
            <Button
              className={classNames('domain-card', {
                'domain-card-full': isFullSize,
                'p-0': !isFullSize,
              })}
              key={domain.id}
              onClick={() => handleDomainClick(domain)}>
              {isFullSize ? (
                <div className="d-flex gap-2">
                  <div
                    className="domain-card-full-icon"
                    style={{ background: domain.style?.color }}>
                    {getDomainIcon(domain.style?.iconURL)}
                  </div>
                  <div className="domain-card-full-content">
                    <div className="domain-card-full-title-row">
                      <Typography.Text
                        className="font-semibold"
                        ellipsis={{
                          tooltip: true,
                        }}>
                        {domain.displayName || domain.name}
                      </Typography.Text>
                      <span className="domain-card-full-count">
                        {domain.assets?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="d-flex domain-card-bar"
                  style={{ borderLeftColor: domain.style?.color }}>
                  <div className="domain-card-content">
                    <span className="domain-card-title">
                      <div className="domain-card-icon">
                        {getDomainIcon(domain.style?.iconURL)}
                      </div>
                      <Typography.Text
                        className="domain-card-name"
                        ellipsis={{ tooltip: true }}>
                        {domain.displayName || domain.name}
                      </Typography.Text>
                    </span>
                    <span className="domain-card-count">
                      {domain.assets?.length || 0}
                    </span>
                  </div>
                </div>
              )}
            </Button>
          ))}
        </div>
      </div>
    ),
    [domains, isFullSize]
  );

  const showWidgetFooterMoreButton = useMemo(
    () => Boolean(!loading) && domains.length > 10,
    [domains, loading]
  );

  const footer = useMemo(
    () => (
      <WidgetFooter
        moreButtonLink="/domain"
        moreButtonText={t('label.view-more-count', {
          countValue: domains.length > 10 ? domains.length - 10 : undefined,
        })}
        showMoreButton={showWidgetFooterMoreButton}
      />
    ),
    [t, domains.length, loading]
  );

  return (
    <WidgetWrapper dataLength={10} loading={loading}>
      <div className="domains-widget-container">
        <WidgetHeader
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={
            <DomainIcon
              className="domains-widget-globe"
              height={22}
              width={22}
            />
          }
          isEditView={isEditView}
          redirectUrlOnTitleClick={ROUTES.DOMAIN}
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
          ) : isEmpty(domains) ? (
            emptyState
          ) : (
            domainsList
          )}
        </div>
        {!isEmpty(domains) && footer}
      </div>
    </WidgetWrapper>
  );
};

export default DomainsWidget;
