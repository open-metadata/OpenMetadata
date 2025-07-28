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

import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb.component';
import EntityTable from '../../components/common/EntityTable/EntityTable.component';
import { EntityTableFilters } from '../../components/common/EntityTable/EntityTable.interface';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderCard from '../../components/common/HeaderCard/HeaderCard.component';
import AddEntityFormV2 from '../../components/Domains/AddEntityForm/AddEntityForm.component';
import { ES_MAX_PAGE_SIZE, ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { CreateDataProduct } from '../../generated/api/domains/createDataProduct';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { Operation } from '../../generated/entity/policies/policy';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useDynamicEntitySearch } from '../../hooks/useDynamicEntitySearch';
import { useFqn } from '../../hooks/useFqn';
import {
  addDataProducts,
  deleteDataProduct,
  getDataProductByName,
} from '../../rest/dataProductAPI';
import { createFormConfig } from '../../utils/AddEntityFormUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

import './data-products-page.less';

const DataProductsPage = () => {
  const { fqn: dataProductFqn } = useFqn();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const [isMainContentLoading, setIsMainContentLoading] = useState(false);
  const [isAddDataProductPanelOpen, setIsAddDataProductPanelOpen] =
    useState(false);
  const [isDataProductFormLoading, setIsDataProductFormLoading] =
    useState(false);

  // Use dynamic search hook for handling search and filtering
  const {
    data: searchResults,
    loading: searchLoading,
    total,
    searchTerm,
    filters,
    setSearchTerm,
    setFilters,
    refetch,
  } = useDynamicEntitySearch<DataProduct>({
    searchIndex: SearchIndex.DATA_PRODUCT,
    pageSize: ES_MAX_PAGE_SIZE,
    enableFilters: true,
    enableSearch: true,
  });

  const [
    createDataProductPermission,
    viewBasicDataProductPermission,
    viewAllDataProductPermission,
  ] = useMemo(() => {
    return [
      checkPermission(
        Operation.Create,
        ResourceEntity.DATA_PRODUCT,
        permissions
      ),
      checkPermission(
        Operation.ViewBasic,
        ResourceEntity.DATA_PRODUCT,
        permissions
      ),
      checkPermission(
        Operation.ViewAll,
        ResourceEntity.DATA_PRODUCT,
        permissions
      ),
    ];
  }, [permissions]);

  // Breadcrumb items for the data products page
  const breadcrumbItems = useMemo(
    () => [
      {
        name: t('label.data-product-plural'),
        url: ROUTES.DATA_PRODUCTS,
      },
    ],
    [t]
  );

  const handleAddDataProductClick = useCallback(() => {
    setIsAddDataProductPanelOpen(true);
  }, []);

  const handleAddDataProductPanelClose = useCallback(() => {
    setIsAddDataProductPanelOpen(false);
  }, []);

  const handleDataProductSave = useCallback(
    async (values: CreateDataProduct) => {
      setIsDataProductFormLoading(true);
      try {
        // Create new data product using addDataProducts API
        await addDataProducts(values);

        // Close the panel after successful creation
        setIsAddDataProductPanelOpen(false);

        // Refresh data products list to show the new data product
        await refetch();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsDataProductFormLoading(false);
      }
    },
    [refetch]
  );

  const handleDataProductDelete = async (id: string) => {
    try {
      await deleteDataProduct(id);
      await refetch();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleBulkDataProductDelete = async (ids: Key[]) => {
    try {
      // Execute delete operations in parallel
      await Promise.all(ids.map((id) => deleteDataProduct(id as string)));
      await refetch();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // Handle search term changes from EntityTable
  const handleSearchChange = useCallback(
    (newSearchTerm: string) => {
      setSearchTerm(newSearchTerm);
    },
    [setSearchTerm]
  );

  // Handle filter changes from EntityTable
  const handleFiltersUpdate = useCallback(
    (newFilters: EntityTableFilters) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  const fetchDataProductByName = async (dataProductFqn: string) => {
    setIsMainContentLoading(true);
    try {
      await getDataProductByName(dataProductFqn, {
        fields: [
          TabSpecificField.DOMAIN,
          TabSpecificField.OWNERS,
          TabSpecificField.EXPERTS,
          TabSpecificField.TAGS,
          TabSpecificField.FOLLOWERS,
        ],
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.data-product-lowercase'),
        })
      );
    } finally {
      setIsMainContentLoading(false);
    }
  };

  useEffect(() => {
    if (dataProductFqn) {
      fetchDataProductByName(dataProductFqn);
    }
  }, [dataProductFqn]);

  if (!(viewBasicDataProductPermission || viewAllDataProductPermission)) {
    return (
      <div className="d-flex justify-center items-center full-height">
        <ErrorPlaceHolder
          className="mt-0-important border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.data-product'),
          })}
          size={SIZE.X_LARGE}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      </div>
    );
  }

  if (isEmpty(searchResults) && !searchLoading) {
    return (
      <div className="d-flex justify-center items-center full-height">
        <ErrorPlaceHolder
          buttonId="add-data-product"
          className="mt-0-important border-none"
          heading={t('label.data-product')}
          permission={createDataProductPermission}
          permissionValue={
            createDataProductPermission
              ? t('label.create-entity', {
                  entity: t('label.data-product'),
                })
              : ''
          }
          size={SIZE.X_LARGE}
          type={
            createDataProductPermission
              ? ERROR_PLACEHOLDER_TYPE.CREATE
              : ERROR_PLACEHOLDER_TYPE.CUSTOM
          }
          onClick={handleAddDataProductClick}>
          {t('message.data-products-not-configured')}
        </ErrorPlaceHolder>
      </div>
    );
  }

  return (
    <div className="data-products-page-container">
      <Breadcrumb titleLinks={breadcrumbItems} />
      <HeaderCard
        addLabel={t('label.add-entity', {
          entity: t('label.data-product'),
        })}
        description="Test description"
        disabled={!createDataProductPermission}
        title={t('label.data-product-plural')}
        onAdd={handleAddDataProductClick}
      />
      <EntityTable
        data={searchResults}
        filters={filters}
        loading={searchLoading}
        searchIndex={SearchIndex.DATA_PRODUCT}
        searchTerm={searchTerm}
        total={total}
        type="data-products"
        onBulkDelete={handleBulkDataProductDelete}
        onDelete={handleDataProductDelete}
        onFiltersUpdate={handleFiltersUpdate}
        onSearchChange={handleSearchChange}
      />
      <AddEntityFormV2<CreateDataProduct>
        config={createFormConfig.dataProduct({
          onSubmit: handleDataProductSave,
        })}
        loading={isDataProductFormLoading}
        open={isAddDataProductPanelOpen}
        onClose={handleAddDataProductPanelClose}
      />
    </div>
  );
};

export default withPageLayout(DataProductsPage);
