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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Tooltip as MUITooltip } from '@mui/material';
import { Divider, Space, Tooltip, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { InternalAxiosRequestConfig } from 'axios';
import classNames from 'classnames';
import { get, isEmpty, isUndefined, noop } from 'lodash';
import { Fragment, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as DomainIcon } from '../assets/svg/ic-domain.svg';
import { ReactComponent as SubDomainIcon } from '../assets/svg/ic-subdomain.svg';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import { TreeListItem } from '../components/common/DomainSelectableTree/DomainSelectableTree.interface';
import { OwnerLabel } from '../components/common/OwnerLabel/OwnerLabel.component';
import ResizablePanels from '../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { DomainExpertWidget } from '../components/Domain/DomainExpertsWidget/DomainExpertWidget';
import DataProductsTab from '../components/Domain/DomainTabs/DataProductsTab/DataProductsTab.component';
import { DomainTypeWidget } from '../components/Domain/DomainTypeWidget/DomainTypeWidget';
import SubDomainsTable from '../components/Domain/SubDomainsTable/SubDomainsTable.component';
import EntitySummaryPanel from '../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import AssetsTabs from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import {
  DEFAULT_DOMAIN_VALUE,
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
} from '../constants/constants';
import { DOMAIN_TYPE_DATA } from '../constants/Domain.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Domain } from '../generated/entity/domains/domain';
import { Operation } from '../generated/entity/policies/policy';
import { EntityReference } from '../generated/entity/type';
import { PageType } from '../generated/system/ui/page';
import { useDomainStore } from '../hooks/useDomainStore';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { DomainDetailPageTabProps } from './Domain/DomainClassBase';
import { getEntityName, getEntityReferenceFromEntity } from './EntityUtils';
import Fqn from './Fqn';
import { t } from './i18next/LocalUtil';
import { renderIcon } from './IconUtils';
import {
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from './PermissionsUtils';
import { getDomainPath, getPathNameFromWindowLocation } from './RouterUtils';

export const withDomainFilter = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  const isGetRequest = config.method === 'get';
  const activeDomain = useDomainStore.getState().activeDomain;
  const hasActiveDomain = activeDomain !== DEFAULT_DOMAIN_VALUE;
  const currentPath = getPathNameFromWindowLocation();
  const shouldNotIntercept = [
    '/domain',
    '/auth/logout',
    '/auth/refresh',
  ].reduce((prev, curr) => {
    return prev || currentPath.startsWith(curr);
  }, false);

  if (shouldNotIntercept) {
    return config;
  }

  if (isGetRequest && hasActiveDomain) {
    if (config.url?.includes('/search/query')) {
      if (config.params?.index === SearchIndex.TAG) {
        return config;
      }
      let filter: QueryFilterInterface = { query: { bool: {} } };
      if (config.params?.query_filter) {
        try {
          const parsed = JSON.parse(config.params.query_filter as string);
          filter = parsed?.query ? parsed : { query: { bool: {} } };
        } catch {
          filter = { query: { bool: {} } };
        }
      }

      let mustArray: QueryFieldInterface[] = [];
      const existingMust = filter.query?.bool?.must;
      if (Array.isArray(existingMust)) {
        mustArray = [...existingMust];
      } else if (existingMust) {
        mustArray = [existingMust];
      }

      const { bool: existingBool, ...nonBoolClauses } = filter.query ?? {};
      for (const [key, value] of Object.entries(nonBoolClauses)) {
        mustArray.push({ [key]: value } as QueryFieldInterface);
      }

      filter.query = {
        bool: {
          ...existingBool,
          must: [
            ...mustArray,
            {
              bool: {
                should: [
                  {
                    term: {
                      'domains.fullyQualifiedName': activeDomain,
                    },
                  },
                  {
                    prefix: {
                      'domains.fullyQualifiedName': `${activeDomain}.`,
                    },
                  },
                ],
              },
            } as QueryFieldInterface,
          ],
        },
      };

      config.params = {
        ...config.params,
        query_filter: JSON.stringify(filter),
      };
    } else {
      config.params = {
        ...config.params,
        domain: activeDomain,
      };
    }
  }

  return config;
};

export const getOwner = (
  hasPermission: boolean,
  owners: EntityReference[],
  ownerDisplayNames: Map<string, ReactNode>
) => {
  if (!isEmpty(owners)) {
    return <OwnerLabel ownerDisplayName={ownerDisplayNames} owners={owners} />;
  }
  if (!hasPermission) {
    return <div>{NO_DATA_PLACEHOLDER}</div>;
  }

  return null;
};

export const getQueryFilterToIncludeDomain = (
  domainFqn: string,
  dataProductFqn: string
) => ({
  query: {
    bool: {
      must: [
        {
          term: {
            'domains.fullyQualifiedName': domainFqn,
          },
        },
        {
          bool: {
            must_not: [
              {
                term: {
                  'dataProducts.fullyQualifiedName': dataProductFqn,
                },
              },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                terms: {
                  entityType: [
                    EntityType.DATA_PRODUCT,
                    EntityType.TEST_SUITE,
                    EntityType.QUERY,
                    EntityType.TEST_CASE,
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
});

export const getQueryFilterToExcludeDomainTerms = (
  fqn: string,
  parentFqn?: string
): QueryFilterInterface => {
  const mustTerm: QueryFieldInterface[] = parentFqn
    ? [
        {
          term: {
            'domains.fullyQualifiedName': parentFqn,
          },
        },
      ]
    : [];

  return {
    query: {
      bool: {
        must: mustTerm.concat([
          {
            bool: {
              must_not: [
                {
                  term: {
                    'domains.fullyQualifiedName': fqn,
                  },
                },
              ],
            },
          },
        ]),
      },
    },
  };
};

/**
 * Returns an Elasticsearch query filter for fetching assets belonging to a domain,
 * excluding DataProduct entities. Use this for general domain asset listings.
 * @param domainFqn - The fully qualified name of the domain
 */
export const getQueryFilterForDomain = (domainFqn: string) => {
  if (!domainFqn) {
    return { query: { match_none: {} } };
  }

  return {
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                {
                  term: {
                    'domains.fullyQualifiedName': domainFqn,
                  },
                },
                {
                  prefix: {
                    'domains.fullyQualifiedName': `${domainFqn}.`,
                  },
                },
              ],
            },
          },
        ],
        must_not: [
          {
            term: {
              entityType: 'dataProduct',
            },
          },
        ],
      },
    },
  };
};

/**
 * Returns an Elasticsearch query filter for fetching DataProduct entities within a domain.
 * Unlike getQueryFilterForDomain, this does not exclude any entity types.
 * @param domainFqn - The fully qualified name of the domain
 */
export const getQueryFilterForDataProducts = (domainFqn: string) => {
  if (!domainFqn) {
    return { query: { match_none: {} } };
  }

  return {
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                {
                  term: {
                    'domains.fullyQualifiedName': domainFqn,
                  },
                },
                {
                  prefix: {
                    'domains.fullyQualifiedName': `${domainFqn}.`,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };
};

// Domain type description which will be shown in tooltip
export const domainTypeTooltipDataRender = () => (
  <Space direction="vertical" size="middle">
    {DOMAIN_TYPE_DATA.map(({ type, description }, index) => (
      <Fragment key={type}>
        <Space direction="vertical" size={0}>
          <Typography.Text>{`${t(type)} :`}</Typography.Text>
          <Typography.Paragraph className="m-0 text-grey-muted">
            {t(description)}
          </Typography.Paragraph>
        </Space>

        {index !== 2 && <Divider className="m-0" />}
      </Fragment>
    ))}
  </Space>
);

export const iconTooltipDataRender = () => (
  <MUITooltip arrow placement="top" title={t('message.icon-aspect-ratio')}>
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'help',
        lineHeight: 0,
        pointerEvents: 'auto',
      }}>
      <InfoOutlinedIcon
        data-testid="mui-helper-icon"
        sx={{
          fontSize: 16,
          color: 'text.secondary',
          pointerEvents: 'auto',
        }}
      />
    </Box>
  </MUITooltip>
);

export const getDomainOptions = (domains: Domain[] | EntityReference[]) => {
  const domainOptions: ItemType[] = [
    {
      label: t('label.all-domain-plural'),
      key: DEFAULT_DOMAIN_VALUE,
    },
  ];

  for (const domain of domains) {
    domainOptions.push({
      label: getEntityName(domain),
      key: domain.fullyQualifiedName ?? '',
      icon: get(domain, 'parent') ? (
        <SubDomainIcon
          color={DE_ACTIVE_COLOR}
          height={20}
          name="subdomain"
          width={20}
        />
      ) : (
        <DomainIcon
          color={DE_ACTIVE_COLOR}
          height={20}
          name="domain"
          width={20}
        />
      ),
    });
  }

  return domainOptions;
};

export const renderDomainLink = (
  domain: EntityReference,
  domainDisplayName: ReactNode,
  showDomainHeading: boolean,
  textClassName?: string,
  trimLink?: boolean
) => {
  const displayName = isUndefined(domainDisplayName)
    ? getEntityName(domain)
    : domainDisplayName;

  return (
    <Tooltip title={domainDisplayName ?? getEntityName(domain)}>
      <Link
        className={classNames(
          'no-underline domain-link domain-link-text font-medium',
          {
            'text-sm': !showDomainHeading,
            'text-truncate truncate w-max-full': trimLink,
          },
          textClassName
        )}
        data-testid="domain-link"
        to={getDomainPath(domain?.fullyQualifiedName)}>
        {trimLink ? (
          <Typography.Text
            className="domain-link-name"
            ellipsis={{ tooltip: false }}>
            {displayName}
          </Typography.Text>
        ) : (
          <>{displayName}</>
        )}
      </Link>
    </Tooltip>
  );
};

export const initializeDomainEntityRef = (
  domains: EntityReference[],
  activeDomainKey: string
) => {
  const domain = domains.find((item) => {
    return item.fullyQualifiedName === activeDomainKey;
  });
  if (domain) {
    return getEntityReferenceFromEntity(domain, EntityType.DOMAIN);
  }

  return undefined;
};

export const convertDomainsToTreeOptions = (
  options: EntityReference[] | Domain[] = [],
  level = 0,
  multiple = false
): TreeListItem[] => {
  const treeData = options.map((option) => {
    const hasChildren = 'children' in option && !isEmpty(option?.children);
    const domainOption = option as unknown as Domain;
    const hasChildrenCount =
      'childrenCount' in domainOption && (domainOption.childrenCount ?? 0) > 0;

    return {
      id: option.id,
      value: option.fullyQualifiedName,
      name: option.name,
      label: option.name,
      key: option.fullyQualifiedName,
      displayName: option.displayName,
      childrenCount:
        domainOption.childrenCount || domainOption.children?.length || 0,
      fullyQualifiedName: option.fullyQualifiedName,
      title: (
        <div className="d-flex items-center gap-1">
          {level === 0 ? (
            <DomainIcon
              color={DE_ACTIVE_COLOR}
              height={20}
              name="domain"
              width={20}
            />
          ) : (
            <SubDomainIcon
              color={DE_ACTIVE_COLOR}
              height={20}
              name="subdomain"
              width={20}
            />
          )}

          <Typography.Text ellipsis>{getEntityName(option)}</Typography.Text>
        </div>
      ),
      'data-testid': `tag-${option.fullyQualifiedName}`,
      isLeaf: !hasChildren && !hasChildrenCount,
      selectable: !multiple,
      children: hasChildren
        ? convertDomainsToTreeOptions(
            domainOption?.children as EntityReference[],
            level + 1,
            multiple
          )
        : undefined,
    };
  });

  return treeData;
};

/**
 * Recursively checks if a domain exists in the hierarchy
 * @param domain The domain to search in
 * @param searchDomain The domain to search for
 * @returns boolean indicating if the domain exists
 */
export const isDomainExist = (
  domain: Domain,
  searchDomainFqn: string
): boolean => {
  if (domain.fullyQualifiedName === searchDomainFqn) {
    return true;
  }

  if (domain.children?.length) {
    return domain.children.some((child) =>
      isDomainExist(child as unknown as Domain, searchDomainFqn)
    );
  }

  return false;
};

export const getDomainDetailTabs = ({
  domain,
  isVersionsView,
  domainPermission,
  subDomainsCount,
  dataProductsCount,
  assetCount,
  activeTab,
  onAddDataProduct,
  queryFilter,
  assetTabRef,
  dataProductsTabRef,
  previewAsset,
  setPreviewAsset,
  setAssetModalVisible,
  handleAssetClick,
  handleAssetSave,
  setShowAddSubDomainModal,
  feedCount,
  onFeedUpdate,
  onDeleteSubDomain,
  labelMap,
}: DomainDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          id={EntityTabs.DOCUMENTATION}
          name={get(
            labelMap,
            EntityTabs.DOCUMENTATION,
            t('label.documentation')
          )}
        />
      ),
      key: EntityTabs.DOCUMENTATION,
      children: <GenericTab type={PageType.Domain} />,
    },
    ...(isVersionsView
      ? []
      : [
          {
            label: (
              <TabsLabel
                count={subDomainsCount ?? 0}
                id={EntityTabs.SUBDOMAINS}
                isActive={activeTab === EntityTabs.SUBDOMAINS}
                name={get(
                  labelMap,
                  EntityTabs.SUBDOMAINS,
                  t('label.sub-domain-plural')
                )}
              />
            ),
            key: EntityTabs.SUBDOMAINS,
            children: (
              <SubDomainsTable
                domainFqn={domain.fullyQualifiedName ?? ''}
                permissions={domainPermission}
                subDomainsCount={subDomainsCount}
                onAddSubDomain={() => setShowAddSubDomainModal(true)}
                onDeleteSubDomain={onDeleteSubDomain}
              />
            ),
          },
          {
            label: (
              <TabsLabel
                count={dataProductsCount ?? 0}
                id={EntityTabs.DATA_PRODUCTS}
                isActive={activeTab === EntityTabs.DATA_PRODUCTS}
                name={get(
                  labelMap,
                  EntityTabs.DATA_PRODUCTS,
                  t('label.data-product-plural')
                )}
              />
            ),
            key: EntityTabs.DATA_PRODUCTS,
            children: (
              <DataProductsTab
                domainFqn={domain.fullyQualifiedName}
                permissions={domainPermission}
                ref={dataProductsTabRef}
                onAddDataProduct={onAddDataProduct}
              />
            ),
          },
          {
            label: (
              <TabsLabel
                count={feedCount?.totalCount ?? 0}
                id={EntityTabs.ACTIVITY_FEED}
                isActive={activeTab === EntityTabs.ACTIVITY_FEED}
                name={get(
                  labelMap,
                  EntityTabs.ACTIVITY_FEED,
                  t('label.activity-feed-and-task-plural')
                )}
              />
            ),
            key: EntityTabs.ACTIVITY_FEED,
            children: (
              <ActivityFeedTab
                refetchFeed
                entityFeedTotalCount={feedCount?.totalCount ?? 0}
                entityType={EntityType.DOMAIN}
                feedCount={feedCount}
                layoutType={ActivityFeedLayoutType.THREE_PANEL}
                owners={domain.owners}
                urlFqn={domain.fullyQualifiedName}
                onFeedUpdate={onFeedUpdate ?? noop}
                onUpdateEntityDetails={noop}
              />
            ),
          },
          {
            label: (
              <TabsLabel
                count={assetCount ?? 0}
                id={EntityTabs.ASSETS}
                isActive={activeTab === EntityTabs.ASSETS}
                name={get(labelMap, EntityTabs.ASSETS, t('label.asset-plural'))}
              />
            ),
            key: EntityTabs.ASSETS,
            children: (
              <ResizablePanels
                className="h-full domain-height-with-resizable-panel"
                firstPanel={{
                  wrapInCard: false,
                  className: 'domain-resizable-panel-container',
                  children: (
                    <AssetsTabs
                      assetCount={assetCount}
                      entityFqn={domain.fullyQualifiedName}
                      isSummaryPanelOpen={false}
                      permissions={domainPermission}
                      queryFilter={queryFilter}
                      ref={assetTabRef}
                      type={AssetsOfEntity.DOMAIN}
                      onAddAsset={() => setAssetModalVisible(true)}
                      onAssetClick={handleAssetClick}
                      onRemoveAsset={handleAssetSave}
                    />
                  ),
                  minWidth: 800,
                  flex: 0.67,
                }}
                hideSecondPanel={!previewAsset}
                pageTitle={t('label.domain')}
                secondPanel={{
                  wrapInCard: false,
                  children: previewAsset && (
                    <EntitySummaryPanel
                      entityDetails={previewAsset}
                      handleClosePanel={() => setPreviewAsset(undefined)}
                    />
                  ),
                  minWidth: 400,
                  flex: 0.33,
                  className:
                    'entity-summary-resizable-right-panel-container domain-resizable-panel-container',
                }}
              />
            ),
          },
          {
            label: (
              <TabsLabel
                id={EntityTabs.CUSTOM_PROPERTIES}
                name={get(
                  labelMap,
                  EntityTabs.CUSTOM_PROPERTIES,
                  t('label.custom-property-plural')
                )}
              />
            ),
            key: EntityTabs.CUSTOM_PROPERTIES,
            children: (
              <CustomPropertyTable<EntityType.DOMAIN>
                className="p-lg"
                entityType={EntityType.DOMAIN}
                hasEditAccess={getPrioritizedEditPermission(
                  domainPermission,
                  Operation.EditCustomFields
                )}
                hasPermission={getPrioritizedViewPermission(
                  domainPermission,
                  Operation.ViewCustomFields
                )}
              />
            ),
          },
        ]),
  ];
};

export const getDomainWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.EXPERTS)) {
    return <DomainExpertWidget />;
  } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DOMAIN_TYPE)) {
    return <DomainTypeWidget />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.DOMAIN}
      showTaskHandler={false}
      widgetConfig={widgetConfig}
    />
  );
};

export const getDomainIcon = (iconURL?: string) => {
  // Try to render the icon using the utility (handles both URLs and icon names)
  const iconElement = renderIcon(iconURL, {
    size: 24,
    className: 'domain-icon-url h-6 w-6',
  });

  // If we got an icon element, return it
  if (iconElement) {
    return iconElement;
  }

  // Otherwise return the default domain icon
  return <DomainIcon className="domain-default-icon" />;
};

export const DomainListItemRenderer = (props: EntityReference) => {
  const isSubDomain = Fqn.split(props.fullyQualifiedName ?? '').length > 1;
  const fqn = `(${props.fullyQualifiedName ?? ''})`;

  return (
    <div className="d-flex items-center gap-2">
      <DomainIcon
        color={DE_ACTIVE_COLOR}
        height={20}
        name="folder"
        width={20}
      />
      <div className="d-flex items-center w-max-400">
        <Typography.Text ellipsis>{getEntityName(props)}</Typography.Text>
        {isSubDomain && (
          <Typography.Text
            ellipsis
            className="m-l-xss text-xs"
            type="secondary">
            {fqn}
          </Typography.Text>
        )}
      </div>
    </div>
  );
};

export const domainBuildESQuery = (
  filters: Record<string, string[]>,
  baseFilter?: string
): Record<string, unknown> => {
  let query = baseFilter ? JSON.parse(baseFilter) : null;

  if (!query) {
    query = {
      query: {
        bool: {
          must: [],
        },
      },
    };
  }

  if (!query.query) {
    query.query = { bool: { must: [] } };
  }
  if (!query.query.bool) {
    query.query.bool = { must: [] };
  }
  if (!query.query.bool.must) {
    query.query.bool.must = [];
  }

  for (const [filterKey, values] of Object.entries(filters)) {
    if (!values || values.length === 0) {
      continue;
    }

    if (values.length === 1) {
      query.query.bool.must.push({
        term: {
          [filterKey]: values[0],
        },
      });
    } else {
      query.query.bool.must.push({
        terms: {
          [filterKey]: values,
        },
      });
    }
  }

  return query;
};
