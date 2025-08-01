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

import { Col, Row, Space, Tabs, TabsProps } from 'antd';
import classNames from 'classnames';
import { toString } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import DataAssetsVersionHeader from '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { EntityTabs, EntityType, FqnPart } from '../../enums/entity.enum';
import { ChangeDescription } from '../../generated/entity/data/searchIndex';
import { TagSource } from '../../generated/type/tagLabel';
import { getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../utils/EntityVersionUtils';
import { getVersionPath } from '../../utils/RouterUtils';
import { getUpdatedSearchIndexFields } from '../../utils/SearchIndexVersionUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import Loader from '../common/Loader/Loader';
import TabsLabel from '../common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../Customization/GenericProvider/GenericProvider';
import DataProductsContainer from '../DataProducts/DataProductsContainer/DataProductsContainer.component';
import VersionTable from '../Entity/VersionTable/VersionTable.component';
import { SearchIndexVersionProps } from './SearchIndexVersion.interface';

const SearchIndexVersion: React.FC<SearchIndexVersionProps> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owners,
  domains,
  dataProducts,
  tier,
  breadCrumbList,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
  entityPermissions,
}: SearchIndexVersionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const entityFqn = useMemo(
    () => currentVersionData.fullyQualifiedName ?? '',
    [currentVersionData.fullyQualifiedName ?? '']
  );

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          changeDescription,
          owners,
          tier,
          domains
        ),
      [changeDescription, owners, tier, domains]
    );

  const fields = useMemo(() => {
    return getUpdatedSearchIndexFields(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  const handleTabChange = (activeKey: string) => {
    navigate(
      getVersionPath(
        EntityType.SEARCH_INDEX,
        entityFqn,
        String(version),
        activeKey
      )
    );
  };

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  const tags = useMemo(() => {
    return getEntityVersionTags(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  const description = useMemo(() => {
    return getEntityVersionByField(
      changeDescription,
      EntityField.DESCRIPTION,
      currentVersionData.description
    );
  }, [currentVersionData, changeDescription]);

  const displayName = useMemo(() => {
    return getEntityVersionByField(
      changeDescription,
      EntityField.DISPLAYNAME,
      currentVersionData.displayName
    );
  }, [currentVersionData, changeDescription]);

  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: EntityTabs.FIELDS,
        label: (
          <TabsLabel id={EntityTabs.FIELDS} name={t('label.field-plural')} />
        ),
        children: (
          <Row className="h-full" gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    description={description}
                    entityType={EntityType.SEARCH_INDEX}
                    showActions={false}
                  />
                </Col>
                <Col span={24}>
                  <VersionTable
                    columnName={getPartialNameFromTableFQN(
                      entityFqn,
                      [FqnPart.SearchIndexField],
                      FQN_SEPARATOR_CHAR
                    )}
                    columns={fields}
                    joins={[]}
                  />
                </Col>
              </Row>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="220px">
              <Space className="w-full" direction="vertical" size="large">
                <DataProductsContainer
                  newLook
                  activeDomains={domains}
                  dataProducts={dataProducts ?? []}
                  hasPermission={false}
                />
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    newLook
                    entityType={EntityType.SEARCH_INDEX}
                    key={tagType}
                    permission={false}
                    selectedTags={tags}
                    tagType={TagSource[tagType as TagSource]}
                  />
                ))}
              </Space>
            </Col>
          </Row>
        ),
      },
      {
        key: EntityTabs.CUSTOM_PROPERTIES,
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        children: (
          <CustomPropertyTable
            isVersionView
            entityType={EntityType.SEARCH_INDEX}
            hasEditAccess={false}
            hasPermission={entityPermissions.ViewAll}
          />
        ),
      },
    ],
    [description, entityFqn, fields, currentVersionData, entityPermissions]
  );

  return (
    <>
      {isVersionLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')}>
          <Row gutter={[0, 12]}>
            <Col span={24}>
              <DataAssetsVersionHeader
                breadcrumbLinks={breadCrumbList}
                currentVersionData={currentVersionData}
                deleted={deleted}
                displayName={displayName}
                domainDisplayName={domainDisplayName}
                entityType={EntityType.SEARCH_INDEX}
                ownerDisplayName={ownerDisplayName}
                ownerRef={ownerRef}
                serviceName={currentVersionData.service?.name}
                tierDisplayName={tierDisplayName}
                version={version}
                onVersionClick={backHandler}
              />
            </Col>
            <GenericProvider
              isVersionView
              currentVersionData={currentVersionData}
              data={currentVersionData}
              permissions={entityPermissions}
              type={EntityType.SEARCH_INDEX}
              onUpdate={() => Promise.resolve()}>
              <Col className="entity-version-page-tabs" span={24}>
                <Tabs
                  className="tabs-new"
                  defaultActiveKey={tab}
                  items={tabItems}
                  onChange={handleTabChange}
                />
              </Col>
            </GenericProvider>
          </Row>
        </div>
      )}

      <EntityVersionTimeLine
        currentVersion={toString(version)}
        entityType={EntityType.SEARCH_INDEX}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default SearchIndexVersion;
