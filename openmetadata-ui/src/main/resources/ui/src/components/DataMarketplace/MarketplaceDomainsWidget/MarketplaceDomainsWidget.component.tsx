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

import { Button, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  ROUTES,
} from '../../../constants/constants';
import { DRAWER_HEADER_STYLING } from '../../../constants/DomainsListPage.constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../../generated/api/domains/createDomain';
import { Domain } from '../../../generated/entity/domains/domain';
import { addDomains, patchDomains } from '../../../rest/domainAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { createEntityWithCoverImage } from '../../../utils/CoverImageUploadUtils';
import { getDomainIcon } from '../../../utils/DomainUtils';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getDomainDetailsPath } from '../../../utils/RouterUtils';
import { useFormDrawerWithRef } from '../../common/atoms/drawer';
import Loader from '../../common/Loader/Loader';
import AddDomainForm from '../../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormType } from '../../Domain/DomainPage.interface';
import MarketplaceItemCard from '../MarketplaceItemCard/MarketplaceItemCard.component';
import './marketplace-domains-widget.less';

const DISPLAY_COUNT = 3;

const MarketplaceDomainsWidget = (_props: WidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [form] = useForm();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormLoading, setIsFormLoading] = useState(false);

  const fetchDomains = useCallback(async () => {
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
    } catch {
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const { formDrawer, openDrawer, closeDrawer } = useFormDrawerWithRef({
    title: t('label.add-entity', { entity: t('label.domain') }),
    anchor: 'right',
    width: 670,
    closeOnEscape: false,
    header: {
      sx: DRAWER_HEADER_STYLING,
    },
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
      navigate(getDomainDetailsPath(domain.fullyQualifiedName ?? ''));
    },
    [navigate]
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
            onClick={() => handleClick(domain)}
          />
        ))}
      </div>
    ),
    [domains, handleClick, t]
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
          <Typography.Title
            className="marketplace-widget-title"
            level={5}>
            {t('label.new')} {t('label.domain-plural')}
          </Typography.Title>
          <Typography.Text className="text-grey-muted text-xs">
            {t('label.recently-created-entity', {
              entity: t('label.domain-plural'),
            })}
          </Typography.Text>
        </div>
        <div className="marketplace-widget-actions">
          <Button
            data-testid="add-domain-btn"
            onClick={openDrawer}>
            + {t('label.add-entity', { entity: t('label.domain') })}
          </Button>
          <Link
            className="view-all-link"
            data-testid="view-all-domains"
            to={ROUTES.DOMAIN}>
            {t('label.view-all')} &rarr;
          </Link>
        </div>
      </div>
      {isEmpty(domains) ? (
        <Typography.Text className="text-grey-muted">
          {t('label.no-entity', { entity: t('label.domain-plural') })}
        </Typography.Text>
      ) : (
        cardList
      )}
      {formDrawer}
    </div>
  );
};

export default MarketplaceDomainsWidget;
