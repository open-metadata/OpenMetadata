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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty, noop } from 'lodash';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../../generated/api/domains/createDomain';
import { Domain } from '../../../generated/entity/domains/domain';
import { useMarketplaceStore } from '../../../hooks/useMarketplaceStore';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { addDomains, patchDomains } from '../../../rest/domainAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { createEntityWithCoverImage } from '../../../utils/CoverImageUploadUtils';
import dataMarketplaceClassBase from '../../../utils/DataMarketplace/DataMarketplaceClassBase';
import { getDomainIcon } from '../../../utils/DomainUtils';
import { getDomainDetailsPath } from '../../../utils/RouterUtils';
import { useFormDrawerWithRef } from '../../common/atoms/drawer';
import Loader from '../../common/Loader/Loader';
import AddDomainForm from '../../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormType } from '../../Domain/DomainPage.interface';
import '../marketplace-widget-shared.less';
import MarketplaceItemCard from '../MarketplaceItemCard/MarketplaceItemCard.component';

const DISPLAY_COUNT = 3;

const MarketplaceDomainsWidget = ({
  isEditView,
  dragHandle,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { domainBasePath } = useMarketplaceStore();
  const { permissions } = usePermissionProvider();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [form] = useForm();
  const [domains, setDomains] = useState<Domain[]>(
    isEditView ? dataMarketplaceClassBase.getDummyDomains() : []
  );
  const [loading, setLoading] = useState(!isEditView);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchDomains = useCallback(async () => {
    if (isEditView) {
      return;
    }
    setLoading(true);
    try {
      const res = await searchQuery({
        query: '',
        pageNumber: INITIAL_PAGING_VALUE,
        pageSize: DISPLAY_COUNT,
        sortField: 'updatedAt',
        sortOrder: 'desc',
        searchIndex: SearchIndex.DOMAIN,
      });
      const domainList = res.hits.hits.map((hit) => hit._source) as Domain[];
      setDomains(domainList ?? []);
      setTotalCount(res.hits.total.value ?? 0);
    } catch {
      setDomains([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [isEditView]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const { formDrawer, openDrawer, closeDrawer } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.domain') }),
    width: 670,
    closeOnEscape: false,
    className: 'tw:z-[20]',
    onCancel: () => {
      form.resetFields();
    },
    form: (
      <AddDomainForm
        isFormInDialog
        formRef={form}
        loading={isFormLoading}
        type={DomainFormType.DOMAIN}
        onCancel={() => {
          // No-op: handled by useFormDrawerWithRef
        }}
        onSubmit={async (formData: CreateDomain | CreateDataProduct) => {
          setIsFormLoading(true);
          try {
            await createEntityWithCoverImage({
              formData: formData as CreateDomain,
              entityType: EntityType.DOMAIN,
              entityLabel: t('label.domain'),
              entityPluralLabel: 'domains',
              createEntity: addDomains,
              patchEntity: patchDomains,
              onSuccess: () => {
                closeDrawer();
                fetchDomains();
              },
              enqueueSnackbar,
              closeSnackbar,
              t,
            });
          } finally {
            setIsFormLoading(false);
          }
        }}
      />
    ),
    formRef: form,
    onSubmit: () => {
      form.submit();
    },
  });

  const handleClick = useCallback(
    (domain: Domain) => {
      if (isEditView) {
        return;
      }
      navigate(getDomainDetailsPath(domain.fullyQualifiedName ?? ''));
    },
    [navigate, isEditView]
  );

  const cardList = useMemo(
    () => (
      <div className="marketplace-widget-cards">
        {domains.map((domain) => (
          <MarketplaceItemCard
            backgroundColor={domain.style?.color}
            dataTestId={`marketplace-domain-card-${domain.id}`}
            icon={getDomainIcon(domain.style?.iconURL)}
            key={domain.id}
            name={domain.displayName || domain.name}
            subtitle={
              domain.domainType
                ? `${t('label.type')}: ${domain.domainType}`
                : ''
            }
            onClick={isEditView ? noop : () => handleClick(domain)}
          />
        ))}
      </div>
    ),
    [domains, handleClick, isEditView, t]
  );

  if (loading) {
    return (
      <div
        className="marketplace-widget-section"
        data-testid="marketplace-domains-widget">
        <Loader size="small" />
      </div>
    );
  }

  return (
    <div
      className="marketplace-widget-section"
      data-testid="marketplace-domains-widget">
      <div className="marketplace-widget-header">
        <div>
          <Typography
            as="h5"
            className="marketplace-widget-title tw:text-text-primary tw:m-0"
            size="text-md"
            weight="semibold">
            {t('label.new')} {t('label.domain-plural')}
          </Typography>
          <Typography as="span" className="tw:text-xs tw:text-text-tertiary">
            {t('label.recently-created-entity', {
              entity: t('label.domain-plural'),
            })}
          </Typography>
        </div>
        {dragHandle}
        {!isEditView && (
          <div className="marketplace-widget-actions">
            {permissions.domain?.Create && (
              <Button
                color="secondary"
                data-testid="add-domain-btn"
                onPress={openDrawer}>
                + {t('label.add-entity', { entity: t('label.domain') })}
              </Button>
            )}
            {totalCount > DISPLAY_COUNT && (
              <Link
                className="view-all-link"
                data-testid="view-all-domains"
                to={domainBasePath}>
                {t('label.view-all')} &rarr;
              </Link>
            )}
          </div>
        )}
      </div>
      {isEmpty(domains) ? (
        <div className="tw:flex tw:items-center tw:justify-center tw:min-h-16">
          <Typography as="span" className="tw:text-sm tw:text-text-tertiary">
            {t('label.no-entity', { entity: t('label.domain-plural') })}
          </Typography>
        </div>
      ) : (
        cardList
      )}
      {!isEditView && formDrawer}
    </div>
  );
};

export default MarketplaceDomainsWidget;
