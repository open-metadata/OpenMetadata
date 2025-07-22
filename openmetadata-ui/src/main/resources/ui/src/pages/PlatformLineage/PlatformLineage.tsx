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
import { Col, Row, Select } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { debounce, startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import { AssetsUnion } from '../../components/DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import EntitySuggestionOption from '../../components/Entity/EntityLineage/EntitySuggestionOption/EntitySuggestionOption.component';
import Lineage from '../../components/Lineage/Lineage.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import LineageProvider from '../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../context/LineageProvider/LineageProvider.interface';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/entity/type';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../hooks/useFqn';
import { getEntityPermissionByFqn } from '../../rest/permissionAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityAPIfromSource } from '../../utils/Assets/AssetsUtils';
import { getLineageEntityExclusionFilter } from '../../utils/EntityLineageUtils';
import { getOperationPermissions } from '../../utils/PermissionsUtils';
import { getEncodedFqn } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './platform-lineage.less';

const PlatformLineage = () => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const history = useHistory();
  const queryParams = new URLSearchParams(location.search);
  const platformView =
    queryParams.get('platformView') ?? LineagePlatformView.Service;
  const { entityType } = useParams<{ entityType: EntityType }>();
  const { fqn: decodedFqn } = useFqn();
  const [selectedEntity, setSelectedEntity] = useState<SourceType>();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<DefaultOptionType[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [defaultValue, setDefaultValue] = useState<string | undefined>(
    decodedFqn || undefined
  );
  const [permissions, setPermissions] = useState<OperationPermission>();

  const handleEntitySelect = useCallback(
    (value: EntityReference) => {
      history.push(
        `/lineage/${(value as SourceType).entityType}/${getEncodedFqn(
          value.fullyQualifiedName ?? ''
        )}`
      );
    },
    [history]
  );
  const debouncedSearch = useCallback(
    debounce(async (value: string) => {
      try {
        setIsSearchLoading(true);
        const searchIndices = [
          SearchIndex.DATA_ASSET,
          SearchIndex.DOMAIN,
          SearchIndex.SERVICE,
        ];

        const response = await searchQuery({
          query: value,
          searchIndex: searchIndices,
          pageSize: PAGE_SIZE_BASE,
          queryFilter: getLineageEntityExclusionFilter(),
          includeDeleted: false,
        });

        setOptions(
          response.hits.hits.map((hit) => ({
            value: hit._source.fullyQualifiedName ?? '',
            label: (
              <EntitySuggestionOption
                showEntityTypeBadge
                entity={hit._source as EntityReference}
                onSelectHandler={handleEntitySelect}
              />
            ),
            data: hit,
          }))
        );
      } finally {
        setIsSearchLoading(false);
      }
    }, 300),
    []
  );

  const init = useCallback(async () => {
    if (!decodedFqn || !entityType) {
      setDefaultValue(undefined);

      return;
    }

    try {
      setLoading(true);
      const [entityResponse, permissionResponse] = await Promise.allSettled([
        getEntityAPIfromSource(entityType as AssetsUnion)(decodedFqn),
        getEntityPermissionByFqn(
          entityType as unknown as ResourceEntity,
          decodedFqn
        ),
      ]);

      if (entityResponse.status === 'fulfilled') {
        setSelectedEntity(entityResponse.value);
        setDefaultValue(decodedFqn || undefined);
      }

      if (permissionResponse.status === 'fulfilled') {
        const operationPermission = getOperationPermissions(
          permissionResponse.value
        );
        setPermissions(operationPermission);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [decodedFqn, entityType]);

  useEffect(() => {
    init();
  }, [init]);

  const lineageElement = useMemo(() => {
    if (loading) {
      return <Loader />;
    }

    return (
      <LineageProvider>
        <Lineage
          isPlatformLineage
          entity={selectedEntity}
          entityType={entityType}
          hasEditAccess={
            permissions?.EditAll || permissions?.EditLineage || false
          }
        />
      </LineageProvider>
    );
  }, [selectedEntity, loading, permissions, entityType]);

  return (
    <PageLayoutV1 pageTitle={t('label.lineage')}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <Row className="">
            <Col span={24}>
              <PageHeader
                data={{
                  ...PAGE_HEADERS.PLATFORM_LINEAGE,
                  header: t('label.platform-type-lineage', {
                    platformType: startCase(platformView),
                  }),
                }}
              />
            </Col>
            <Col span={12}>
              <div className="m-t-md w-full">
                <Select
                  showSearch
                  className="w-full"
                  data-testid="search-entity-select"
                  filterOption={false}
                  loading={isSearchLoading}
                  optionLabelProp="value"
                  options={options}
                  placeholder={t('label.search-entity-for-lineage', {
                    entity: 'entity',
                  })}
                  value={defaultValue}
                  onFocus={() => !defaultValue && debouncedSearch('')}
                  onSearch={debouncedSearch}
                />
              </div>
            </Col>
          </Row>
        </Col>
        <Col span={24}>
          <div className="platform-lineage-container">{lineageElement}</div>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default PlatformLineage;
