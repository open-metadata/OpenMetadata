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
import { Button } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import {
  addFollower,
  deleteDataProduct,
  getDataProductByName,
  getDataProductVersionData,
  getDataProductVersionsList,
  patchDataProduct,
  removeFollower,
} from '../../../rest/dataProductAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getDomainPath,
  getEntityDetailsPath,
  getVersionPath,
} from '../../../utils/RouterUtils';
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
  const { version } = useRequiredParams<{ version: string }>();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const { fqn: dataProductFqn } = useFqn();
  const [isMainContentLoading, setIsMainContentLoading] = useState(true);
  const [dataProduct, setDataProduct] = useState<DataProduct>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedVersionData, setSelectedVersionData] = useState<DataProduct>();
  const [isFollowingLoading, setIsFollowingLoading] = useState<boolean>(false);

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
            getEntityDetailsPath(
              EntityType.DATA_PRODUCT,
              response.fullyQualifiedName ?? ''
            )
          );
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
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
      const domainPath = getDomainPath();
      navigate(domainPath);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.delete-entity-error', {
          entity: t('label.data-product'),
        })
      );
    }
  };

  const fetchDataProductByFqn = async (fqn: string) => {
    setIsMainContentLoading(true);
    try {
      const data = await getDataProductByName(fqn, {
        fields: [
          TabSpecificField.DOMAIN,
          TabSpecificField.OWNERS,
          TabSpecificField.EXPERTS,
          TabSpecificField.ASSETS,
          TabSpecificField.EXTENSION,
          TabSpecificField.TAGS,
          TabSpecificField.FOLLOWERS,
        ],
      });
      setDataProduct(data);

      if (version) {
        fetchVersionsInfo(data);
        fetchActiveVersion(data);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsMainContentLoading(false);
    }
  };

  const fetchVersionsInfo = async (activeDataProduct: DataProduct) => {
    if (!activeDataProduct) {
      return;
    }

    try {
      const res = await getDataProductVersionsList(activeDataProduct.id);
      setVersionList(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchActiveVersion = async (activeDataProduct: DataProduct) => {
    if (!activeDataProduct) {
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
  };

  const onVersionChange = (selectedVersion: string) => {
    const path = getVersionPath(
      EntityType.DATA_PRODUCT,
      dataProductFqn,
      selectedVersion
    );
    navigate(path);
  };

  const onBackHandler = () => {
    navigate(getEntityDetailsPath(EntityType.DATA_PRODUCT, dataProductFqn));
  };

  const followDataProduct = async () => {
    try {
      if (!dataProduct?.id) {
        return;
      }
      const res = await addFollower(dataProduct.id, currentUserId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setDataProduct(
        (prev) =>
          ({
            ...prev,
            followers: [...(prev?.followers ?? []), ...newValue],
          } as DataProduct)
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(dataProduct),
        })
      );
    }
  };

  const unFollowDataProduct = async () => {
    try {
      if (!dataProduct?.id) {
        return;
      }
      const res = await removeFollower(dataProduct.id, currentUserId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];

      // Filter out the follower that was removed
      const filteredFollowers = dataProduct.followers?.filter(
        (follower) => follower.id !== oldValue[0].id
      );

      setDataProduct(
        (prev) =>
          ({
            ...prev,
            followers: filteredFollowers ?? [],
          } as DataProduct)
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(dataProduct),
        })
      );
    }
  };

  const handleFollowingClick = useCallback(async () => {
    setIsFollowingLoading(true);
    isFollowing ? await unFollowDataProduct() : await followDataProduct();
    setIsFollowingLoading(false);
  }, [isFollowing, unFollowDataProduct, followDataProduct]);

  useEffect(() => {
    if (dataProductFqn) {
      fetchDataProductByFqn(dataProductFqn);
    }
  }, [dataProductFqn, version]);

  if (isMainContentLoading) {
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
        pageTitle={t('label.data-product')}>
        <DataProductsDetailsPage
          dataProduct={
            version ? selectedVersionData ?? dataProduct : dataProduct
          }
          handleFollowingClick={handleFollowingClick}
          isFollowing={isFollowing}
          isFollowingLoading={isFollowingLoading}
          isVersionsView={Boolean(version)}
          onDelete={handleDataProductDelete}
          onUpdate={handleDataProductUpdate}
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
