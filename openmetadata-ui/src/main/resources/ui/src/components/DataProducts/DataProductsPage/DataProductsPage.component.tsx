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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { QueryVote } from '../../../components/Database/TableQueries/TableQueries.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { useMarketplaceStore } from '../../../hooks/useMarketplaceStore';
import {
  addFollower,
  deleteDataProduct,
  getDataProductByName,
  getDataProductVersionData,
  getDataProductVersionsList,
  patchDataProduct,
  removeFollower,
  updateDataProductVotes,
} from '../../../rest/dataProductAPI';
import {
  dataProductQueryFn,
  dataProductQueryKey,
  DATA_PRODUCT_DEFAULT_FIELDS,
} from '../../../rest/queries/dataProductQuery';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getDomainPath, getVersionPath } from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import DataProductsDetailsPage from '../DataProductsDetailsPage/DataProductsDetailsPage.component';

const DataProductsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dataProductBasePath } = useMarketplaceStore();
  const { version } = useRequiredParams<{ version: string }>();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const { fqn: dataProductFqn } = useFqn();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedVersionData, setSelectedVersionData] = useState<DataProduct>();
  const [isFollowingLoading, setIsFollowingLoading] = useState<boolean>(false);

  const dataProductCacheKey = useMemo(
    () => dataProductQueryKey(dataProductFqn, DATA_PRODUCT_DEFAULT_FIELDS),
    [dataProductFqn]
  );

  const {
    data: dataProduct,
    isLoading: dataProductLoading,
    error: dataProductError,
  } = useQuery({
    queryKey: dataProductCacheKey,
    queryFn: dataProductQueryFn(dataProductFqn, DATA_PRODUCT_DEFAULT_FIELDS),
    enabled: Boolean(dataProductFqn),
  });

  useEffect(() => {
    const status = (dataProductError as AxiosError | undefined)?.response
      ?.status;
    if (dataProductError && status !== 404) {
      showErrorToast(dataProductError as AxiosError);
    }
  }, [dataProductError]);

  const setDataProduct = useCallback(
    (
      updater:
        | DataProduct
        | undefined
        | ((prev: DataProduct | undefined) => DataProduct | undefined)
    ) => {
      queryClient.setQueryData<DataProduct | undefined>(
        dataProductCacheKey,
        updater
      );
    },
    [queryClient, dataProductCacheKey]
  );

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: dataProduct?.followers?.some(
        ({ id }) => id === currentUserId
      ),
    };
  }, [dataProduct?.followers, currentUserId]);

  const handleDataProductUpdate = async (updatedData: DataProduct) => {
    if (dataProduct) {
      const jsonPatch = compare(dataProduct, updatedData);
      try {
        const response = await patchDataProduct(dataProduct.id, jsonPatch);

        setDataProduct(response);

        if (dataProduct?.name !== updatedData.name) {
          navigate(
            `${dataProductBasePath}/${getEncodedFqn(
              response.fullyQualifiedName ?? ''
            )}`
          );
        }
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error;
      }
    }
  };

  const handleDataProductDelete = async () => {
    if (!dataProduct) {
      return;
    }

    try {
      await deleteDataProduct(dataProduct.id);
      showSuccessToast(
        t('server.entity-deleted-successfully', {
          entity: t('label.data-product'),
        })
      );
      navigate(dataProductBasePath);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.delete-entity-error', {
          entity: t('label.data-product'),
        })
      );
    }
  };

  const fetchVersionsInfo = useCallback(
    async (activeDataProduct: DataProduct) => {
      if (!activeDataProduct) {
        return;
      }

      try {
        const res = await getDataProductVersionsList(activeDataProduct.id);
        setVersionList(res);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    []
  );

  const fetchActiveVersion = useCallback(
    async (activeDataProduct: DataProduct) => {
      if (!activeDataProduct || !version) {
        return;
      }
      try {
        const res = await getDataProductVersionData(
          activeDataProduct.id,
          version
        );
        setSelectedVersionData(res);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [version]
  );

  useEffect(() => {
    if (dataProduct && version) {
      fetchVersionsInfo(dataProduct);
      fetchActiveVersion(dataProduct);
    }
  }, [dataProduct, version, fetchVersionsInfo, fetchActiveVersion]);

  const onVersionChange = (selectedVersion: string) => {
    const path = getVersionPath(
      EntityType.DATA_PRODUCT,
      dataProductFqn,
      selectedVersion
    );
    navigate(path);
  };

  const onBackHandler = () => {
    navigate(`${dataProductBasePath}/${getEncodedFqn(dataProductFqn)}`);
  };

  const followMutation = useMutation<
    void,
    AxiosError,
    void,
    { previous: DataProduct | undefined }
  >({
    mutationFn: async () => {
      if (!dataProduct?.id) {
        return;
      }
      if (isFollowing) {
        await removeFollower(dataProduct.id, currentUserId);
      } else {
        await addFollower(dataProduct.id, currentUserId);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: dataProductCacheKey });
      const previous = queryClient.getQueryData<DataProduct | undefined>(
        dataProductCacheKey
      );
      queryClient.setQueryData<DataProduct | undefined>(
        dataProductCacheKey,
        (prev) => {
          if (!prev) {
            return prev;
          }
          const currentFollowers = prev.followers ?? [];
          if (isFollowing) {
            return {
              ...prev,
              followers: currentFollowers.filter(
                ({ id }) => id !== currentUserId
              ),
            };
          }

          return {
            ...prev,
            followers: [
              ...currentFollowers,
              { id: currentUserId, type: 'user' },
            ] as DataProduct['followers'],
          };
        }
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<DataProduct | undefined>(
          dataProductCacheKey,
          context.previous
        );
      }
      showErrorToast(
        error as AxiosError,
        isFollowing
          ? t('server.entity-unfollow-error', {
              entity: getEntityName(dataProduct),
            })
          : t('server.entity-follow-error', {
              entity: getEntityName(dataProduct),
            })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dataProductCacheKey });
    },
  });

  const handleFollowingClick = useCallback(async () => {
    setIsFollowingLoading(true);
    try {
      await followMutation.mutateAsync();
    } finally {
      setIsFollowingLoading(false);
    }
  }, [followMutation]);

  const refreshDataProduct = useCallback(async () => {
    if (!dataProductFqn) {
      return;
    }
    try {
      const data = await getDataProductByName(dataProductFqn, {
        fields: DATA_PRODUCT_DEFAULT_FIELDS,
      });
      setDataProduct(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [dataProductFqn, setDataProduct]);

  const handleUpdateVote = useCallback(
    async (data: QueryVote, id: string) => {
      try {
        await updateDataProductVotes(id, data);
        await refreshDataProduct();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [refreshDataProduct]
  );

  if (dataProductLoading) {
    return <Loader />;
  }

  if (!dataProduct) {
    return (
      <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <div className="text-center">
          <p>
            {t('message.no-entity-found-for-name', {
              entity: t('label.data-product'),
              name: dataProductFqn,
            })}
          </p>
          <Button
            ghost
            className="m-t-sm"
            type="primary"
            onClick={() => navigate(getDomainPath())}>
            {t('label.go-back')}
          </Button>
        </div>
      </ErrorPlaceHolder>
    );
  }

  return (
    <>
      <PageLayoutV1
        className={classNames('data-product-page-layout', {
          'version-data': version,
        })}
        pageTitle={getEntityName(dataProduct)}>
        <DataProductsDetailsPage
          dataProduct={
            version ? selectedVersionData ?? dataProduct : dataProduct
          }
          handleFollowingClick={handleFollowingClick}
          isFollowing={isFollowing}
          isFollowingLoading={isFollowingLoading}
          isVersionsView={Boolean(version)}
          onDelete={handleDataProductDelete}
          onRefresh={refreshDataProduct}
          onUpdate={handleDataProductUpdate}
          onUpdateVote={handleUpdateVote}
        />
      </PageLayoutV1>

      {version && (
        <EntityVersionTimeLine
          currentVersion={toString(version)}
          entityType={EntityType.DATA_PRODUCT}
          versionHandler={onVersionChange}
          versionList={versionList}
          onBack={onBackHandler}
        />
      )}
    </>
  );
};

export default DataProductsPage;
