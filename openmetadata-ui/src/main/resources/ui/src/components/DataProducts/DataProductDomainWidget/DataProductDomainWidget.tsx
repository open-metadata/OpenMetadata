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

import { Modal } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { patchDataProduct } from '../../../rest/dataProductAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getTermQuery } from '../../../utils/SearchUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { DomainLabelV2 } from '../../DataAssets/DomainLabelV2/DomainLabelV2';

export const DataProductDomainWidget = () => {
  const { t } = useTranslation();
  const { data: dataProduct, onUpdate } = useGenericContext<DataProduct>();
  const [assetCount, setAssetCount] = useState<number>(0);
  const [pendingDomains, setPendingDomains] = useState<
    EntityReference | EntityReference[] | null
  >(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAssetCount = useCallback(async () => {
    if (!dataProduct?.fullyQualifiedName) {
      return;
    }
    try {
      const queryFilter = getTermQuery({
        'dataProducts.fullyQualifiedName': dataProduct.fullyQualifiedName,
      });
      const res = await searchQuery({
        query: '',
        pageNumber: 1,
        pageSize: 0,
        queryFilter,
        searchIndex: SearchIndex.ALL,
      });
      setAssetCount(res.hits.total.value ?? 0);
    } catch {
      setAssetCount(0);
    }
  }, [dataProduct?.fullyQualifiedName]);

  useEffect(() => {
    fetchAssetCount();
  }, [fetchAssetCount]);

  const performDomainUpdate = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      if (!dataProduct) {
        return;
      }

      setIsLoading(true);
      try {
        const domains = Array.isArray(selectedDomain)
          ? selectedDomain
          : isEmpty(selectedDomain)
          ? []
          : [selectedDomain];

        const jsonPatch = compare(dataProduct, {
          ...dataProduct,
          domains,
        });

        const updatedDataProduct = await patchDataProduct(
          dataProduct.id,
          jsonPatch
        );

        if (onUpdate) {
          onUpdate(updatedDataProduct);
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoading(false);
        setIsConfirmModalOpen(false);
        setPendingDomains(null);
      }
    },
    [dataProduct, onUpdate]
  );

  const handleDomainUpdate = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      if (assetCount > 0) {
        setPendingDomains(selectedDomain);
        setIsConfirmModalOpen(true);
      } else {
        await performDomainUpdate(selectedDomain);
      }
    },
    [assetCount, performDomainUpdate]
  );

  const handleConfirm = useCallback(async () => {
    if (pendingDomains !== null) {
      await performDomainUpdate(pendingDomains);
    }
  }, [pendingDomains, performDomainUpdate]);

  const handleCancel = useCallback(() => {
    setIsConfirmModalOpen(false);
    setPendingDomains(null);
  }, []);

  const getNewDomainName = () => {
    if (!pendingDomains) {
      return '';
    }
    const domains = Array.isArray(pendingDomains)
      ? pendingDomains
      : [pendingDomains];

    return domains.map((d) => d.displayName ?? d.name).join(', ') || 'None';
  };

  return (
    <>
      <DomainLabelV2 showDomainHeading onUpdate={handleDomainUpdate} />

      <Modal
        centered
        closable={false}
        confirmLoading={isLoading}
        data-testid="domain-change-confirmation-modal"
        maskClosable={false}
        okButtonProps={{ danger: false }}
        okText={t('label.confirm')}
        open={isConfirmModalOpen}
        title={t('label.change-entity', { entity: t('label.domain') })}
        onCancel={handleCancel}
        onOk={handleConfirm}>
        <p>
          {t('message.domain-change-asset-migration-warning', {
            count: assetCount,
            domain: getNewDomainName(),
          })}
        </p>
      </Modal>
    </>
  );
};
