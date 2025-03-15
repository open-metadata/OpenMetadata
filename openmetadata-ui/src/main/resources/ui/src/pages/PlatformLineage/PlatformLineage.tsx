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
import { Col, Divider, Row, Select, Space } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import Lineage from '../../components/Lineage/Lineage.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import LineageProvider from '../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { ServiceCategoryPlural } from '../../enums/service.enum';
import { Domain } from '../../generated/entity/domains/domain';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { useFqn } from '../../hooks/useFqn';
import { ServicesType } from '../../interface/service.interface';
import { getDomainByName } from '../../rest/domainAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getServiceByFQN } from '../../rest/serviceAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './platform-lineage.less';
import { LineagePlatformView } from './PlatformLineage.interface';

const PlatformLineage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { entityType } = useParams<{ entityType: EntityType }>();
  const { fqn: decodedFqn } = useFqn();
  const [searchType, setSearchType] = useState<LineagePlatformView>(
    entityType === EntityType.DOMAIN
      ? LineagePlatformView.Domain
      : LineagePlatformView.Service
  );
  const [selectedEntity, setSelectedEntity] = useState<ServicesType | Domain>();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<DefaultOptionType[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [defaultValue, setDefaultValue] = useState<string>(
    decodedFqn ?? undefined
  );

  const debouncedSearch = useCallback(
    debounce(async (value: string) => {
      try {
        setIsSearchLoading(true);
        const searchIndices =
          searchType === 'domain'
            ? [SearchIndex.DOMAIN]
            : [
                SearchIndex.DATABASE_SERVICE,
                SearchIndex.DASHBOARD_SERVICE,
                SearchIndex.PIPELINE_SERVICE,
                SearchIndex.ML_MODEL_SERVICE,
                SearchIndex.STORAGE_SERVICE,
                SearchIndex.MESSAGING_SERVICE,
                SearchIndex.SEARCH_SERVICE,
                SearchIndex.API_SERVICE_INDEX,
              ];

        const response = await searchQuery({
          query: `*${value}*`,
          searchIndex: searchIndices,
          pageSize: PAGE_SIZE_BASE,
        });

        setOptions(
          response.hits.hits.map((hit) => ({
            value: hit._source.fullyQualifiedName ?? '',
            label: getEntityName(hit._source),
            data: hit,
          }))
        );
      } finally {
        setIsSearchLoading(false);
      }
    }, 300),
    [searchType]
  );

  const onSearchTypeChange = useCallback((value: LineagePlatformView) => {
    setSearchType(value);
    setOptions([]);
    setDefaultValue('');
  }, []);

  const handleEntitySelect = useCallback(
    (_, option: DefaultOptionType | DefaultOptionType[]) => {
      if (Array.isArray(option)) {
        return;
      }
      setSelectedEntity(option.data._source);
      history.push(
        `/platform-lineage/${option.data._source.entityType}/${option.data._source.fullyQualifiedName}`
      );
    },
    [history]
  );

  const init = useCallback(async () => {
    if (!decodedFqn || !entityType) {
      return;
    }

    try {
      setLoading(true);
      const res =
        entityType === EntityType.DOMAIN
          ? await getDomainByName(decodedFqn)
          : await getServiceByFQN(
              ServiceCategoryPlural[
                entityType as keyof typeof ServiceCategoryPlural
              ],
              decodedFqn
            );
      setSelectedEntity(res);
      setDefaultValue(decodedFqn);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [decodedFqn, entityType]);

  const parsedEntityType = useMemo(() => {
    if (entityType === EntityType.DOMAIN) {
      return EntityType.DOMAIN;
    } else {
      return (selectedEntity as DatabaseService)?.serviceType;
    }
  }, [entityType, selectedEntity]);

  useEffect(() => {
    init();
  }, [init]);

  const lineageElement = useMemo(() => {
    if (loading) {
      return <Loader />;
    }
    if (!selectedEntity) {
      return (
        <ErrorPlaceHolder
          placeholderText={t('label.no-entity-selected', {
            entity: t('label.entity'),
          })}
        />
      );
    }

    return (
      <LineageProvider>
        <Lineage
          isPlatformLineage
          entity={selectedEntity as SourceType}
          entityType={parsedEntityType as EntityType}
          hasEditAccess={false}
        />
      </LineageProvider>
    );
  }, [selectedEntity, loading]);

  return (
    <PageLayoutV1 pageTitle={t('label.query')}>
      <Row gutter={[0, 16]}>
        <Row className="p-x-lg">
          <Col span={24}>
            <PageHeader data={PAGE_HEADERS.PLATFORM_LINEAGE} />
          </Col>
          <Col span={24}>
            <Space className="m-t-md">
              <Select
                data-testid="search-type-select"
                options={[
                  { value: 'service', label: t('label.service') },
                  { value: 'domain', label: t('label.domain') },
                ]}
                style={{ width: 120 }}
                value={searchType}
                onChange={onSearchTypeChange}
              />
              <Select
                showSearch
                data-testid="search-entity-select"
                filterOption={false}
                loading={isSearchLoading}
                options={options}
                placeholder={t('label.search-entity', { entity: searchType })}
                style={{ width: 300 }}
                value={defaultValue}
                onChange={handleEntitySelect}
                onFocus={() => debouncedSearch('')}
                onSearch={debouncedSearch}
              />
            </Space>
          </Col>
        </Row>
        <Col span={24}>
          <Divider className="m-0" />
          <div className="platform-lineage-container">{lineageElement}</div>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default PlatformLineage;
