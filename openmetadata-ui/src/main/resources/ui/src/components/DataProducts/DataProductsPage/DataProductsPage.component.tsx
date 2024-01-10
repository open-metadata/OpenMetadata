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
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityHistory } from '../../../generated/type/entityHistory';
import {
  deleteDataProduct,
  getDataProductByName,
  getDataProductVersionData,
  getDataProductVersionsList,
  patchDataProduct,
} from '../../../rest/dataProductAPI';
import {
  getDataProductsDetailsPath,
  getDataProductVersionsPath,
  getDomainPath,
} from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../../Loader/Loader';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import DataProductsDetailsPage from '../DataProductsDetailsPage/DataProductsDetailsPage.component';

const DataProductsPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn, version } = useParams<{ fqn: string; version: string }>();
  const [isMainContentLoading, setIsMainContentLoading] = useState(true);
  const [dataProduct, setDataProduct] = useState<DataProduct>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedVersionData, setSelectedVersionData] = useState<DataProduct>();

  const dataProductFqn = fqn ? decodeURIComponent(fqn) : '';

  const handleDataProductUpdate = async (updatedData: DataProduct) => {
    if (dataProduct) {
      const jsonPatch = compare(dataProduct, updatedData);
      try {
        const response = await patchDataProduct(dataProduct.id, jsonPatch);

        setDataProduct(response);

        if (dataProduct?.name !== updatedData.name) {
          history.push(
            getDataProductsDetailsPath(response.fullyQualifiedName ?? '')
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
      history.push(domainPath);
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
      const data = await getDataProductByName(getEncodedFqn(fqn), {
        fields: 'domain,owner,experts,assets',
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
    const path = getDataProductVersionsPath(fqn, selectedVersion);
    history.push(path);
  };

  const onBackHandler = () => {
    const path = getDataProductsDetailsPath(fqn);
    history.push(path);
  };

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
              name: fqn,
            })}
          </p>
          <Button
            ghost
            className="m-t-sm"
            type="primary"
            onClick={() => history.push(getDomainPath())}>
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
          'version-data page-container': version,
        })}
        pageTitle={t('label.data-product')}>
        <DataProductsDetailsPage
          dataProduct={
            version ? selectedVersionData ?? dataProduct : dataProduct
          }
          isVersionsView={Boolean(version)}
          onDelete={handleDataProductDelete}
          onUpdate={handleDataProductUpdate}
        />
      </PageLayoutV1>

      {version && (
        <EntityVersionTimeLine
          currentVersion={toString(version)}
          versionHandler={onVersionChange}
          versionList={versionList}
          onBack={onBackHandler}
        />
      )}
    </>
  );
};

export default DataProductsPage;
