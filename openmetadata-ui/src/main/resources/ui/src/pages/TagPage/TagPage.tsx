/*
 *  Copyright 2024 Collate.
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
import { Button, Col, Row, Tabs } from 'antd';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import Loader from '../../components/common/Loader/Loader';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { AssetSelectionModal } from '../../components/DataAssets/AssetsSelectionModal/AssetSelectionModal';
import { EntityHeader } from '../../components/Entity/EntityHeader/EntityHeader.component';
import { EntityDetailsObjectInterface } from '../../components/Explore/ExplorePage.interface';
import AssetsTabs, {
  AssetsTabRef,
} from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { MOCK_GLOSSARY_NO_PERMISSIONS } from '../../mocks/Glossary.mock';
import { searchData } from '../../rest/miscAPI';
import { getTagByFqn } from '../../rest/tagAPI';
import { getCountBadge } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import Fqn from '../../utils/Fqn';
import { getQueryFilterToExcludeTerm } from '../../utils/GlossaryUtils';
import {
  getClassificationDetailsPath,
  getClassificationTagPath,
} from '../../utils/RouterUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../utils/StringsUtils';
import './tagpage.less';

const TagPage = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const history = useHistory();
  const { tab } = useParams<{ tab: string }>();
  const tagFqn = pathname.split('/').find((path) => path.includes('.'));
  const [isLoading, setIsLoading] = useState(false);
  const [tagItem, setTagItem] = useState<Tag>();
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [assetCount, setAssetCount] = useState<number>(0);
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const [breadcrumb, setBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const activeTab = useMemo(() => {
    return tab ?? 'overview';
  }, [tab]);

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
    },
    []
  );

  const getTagData = async () => {
    try {
      setIsLoading(true);
      if (tagFqn) {
        const response = await getTagByFqn(tagFqn);
        setTagItem(response);
      }
    } catch (e) {
      // handle error
    } finally {
      setIsLoading(false);
    }
  };

  const handleBreadcrumb = (fqn: string) => {
    if (!fqn) {
      return;
    }

    const arr = Fqn.split(fqn);
    const dataFQN: Array<string> = [];
    const newData = [
      {
        name: 'Classifications',
        url: getClassificationDetailsPath(arr[0]),
        activeTitle: false,
      },
      ...arr.slice(0, -1).map((d) => {
        dataFQN.push(d);

        return {
          name: d,
          url: getClassificationDetailsPath(dataFQN.join(FQN_SEPARATOR_CHAR)),
          activeTitle: false,
        };
      }),
    ];

    setBreadcrumb(newData);
  };

  const activeTabHandler = (tab: string) => {
    if (tagItem) {
      history.push({
        pathname: getClassificationTagPath(
          tagItem.fullyQualifiedName ?? '',
          tab
        ),
      });
    }
  };

  const fetchClassificationTagAssets = async () => {
    try {
      const encodedFqn = getEncodedFqn(escapeESReservedCharacters(tagFqn));
      const res = await searchData(
        '',
        1,
        0,
        `(tags.tagFQN:"${encodedFqn}")`,
        '',
        '',
        SearchIndex.ALL
      );

      setAssetCount(res.data.hits.total.value ?? 0);
    } catch (error) {
      setAssetCount(0);
    }
  };

  const handleAssetSave = useCallback(() => {
    fetchClassificationTagAssets();
    assetTabRef.current?.refreshAssets();
    tab !== 'assets' && activeTabHandler('assets');
  }, [assetTabRef]);

  const tabItems = useMemo(() => {
    const items = [
      {
        label: <div data-testid="overview">{t('label.overview')}</div>,
        key: 'overview',
        children: (
          <Row>
            <Col className="description-content" span={24}>
              <DescriptionV1
                description={tagItem?.description}
                entityFqn={tagItem?.fullyQualifiedName}
                entityName={getEntityName(tagItem)}
                entityType={EntityType.GLOSSARY_TERM}
                showActions={!tagItem?.deleted}
              />
            </Col>
          </Row>
        ),
      },
      {
        label: (
          <div data-testid="assets">
            {t('label.asset-plural')}
            <span className="p-l-xs ">
              {getCountBadge(assetCount ?? 0, '', activeTab === 'assets')}
            </span>
          </div>
        ),
        key: 'assets',
        children: (
          <AssetsTabs
            assetCount={assetCount}
            entityFqn={tagItem?.fullyQualifiedName ?? ''}
            isSummaryPanelOpen={Boolean(previewAsset)}
            permissions={MOCK_GLOSSARY_NO_PERMISSIONS}
            ref={assetTabRef}
            onAddAsset={() => setAssetModalVisible(true)}
            onAssetClick={handleAssetClick}
            onRemoveAsset={handleAssetSave}
          />
        ),
      },
    ];

    return items;
  }, [tagItem, activeTab, assetCount, handleAssetSave]);

  const icon = useMemo(() => {
    if (tagItem?.style && (tagItem as Tag).style?.iconURL) {
      return (
        <img
          className="align-middle object-contain"
          data-testid="icon"
          height={36}
          src={(tagItem as Tag).style?.iconURL}
          width={32}
        />
      );
    }

    return;
  }, [tagItem]);

  useEffect(() => {
    getTagData();
    fetchClassificationTagAssets();
  }, []);

  useEffect(() => {
    if (tagItem) {
      handleBreadcrumb(
        tagItem.fullyQualifiedName ? tagItem.fullyQualifiedName : tagItem.name
      );
    }
  }, [tagItem]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        tagItem && (
          <PageLayoutV1 pageTitle={tagItem.name}>
            <Row>
              <Col span={24}>
                <>
                  <Row
                    className="data-classification"
                    data-testid="data-classification"
                    gutter={[0, 12]}>
                    <Col className="p-x-md" flex="auto">
                      <EntityHeader
                        breadcrumb={breadcrumb}
                        entityData={tagItem}
                        entityType={EntityType.TAG}
                        icon={icon}
                        serviceName=""
                        titleColor={
                          tagItem.style?.color ? tagItem.style.color : 'black'
                        }
                      />
                    </Col>
                    <Col className="p-x-md" flex="320px">
                      <div style={{ textAlign: 'right' }}>
                        <Button
                          data-testid="data-classification-add-button"
                          type="primary"
                          onClick={() => setAssetModalVisible(true)}>
                          {t('label.add-entity', {
                            entity: t('label.asset-plural'),
                          })}
                        </Button>
                      </div>
                    </Col>
                  </Row>
                </>
              </Col>

              <Col span={24}>
                <Tabs
                  destroyInactiveTabPane
                  activeKey={activeTab}
                  className="classification-tabs custom-tab-spacing"
                  items={tabItems}
                  onChange={activeTabHandler}
                />
              </Col>
            </Row>
            {tagItem.fullyQualifiedName && assetModalVisible && (
              <AssetSelectionModal
                entityFqn={tagItem.fullyQualifiedName}
                open={assetModalVisible}
                queryFilter={getQueryFilterToExcludeTerm(
                  tagItem.fullyQualifiedName
                )}
                onCancel={() => setAssetModalVisible(false)}
                onSave={handleAssetSave}
              />
            )}
          </PageLayoutV1>
        )
      )}
    </>
  );
};

export default TagPage;
