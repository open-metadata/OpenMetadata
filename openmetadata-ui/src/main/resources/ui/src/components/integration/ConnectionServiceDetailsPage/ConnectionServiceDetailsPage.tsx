/*
 *  Copyright 2026 Collate.
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

import {
  Badge,
  Button,
  Dropdown,
  FeaturedIcon,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Settings01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  INITIAL_TABLE_FILTERS,
  pagingObject,
} from '../../../constants/constants';
import { ExportTypes } from '../../../constants/Export.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { Include } from '../../../generated/type/include';
import { Paging } from '../../../generated/type/paging';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useTableFilters } from '../../../hooks/useTableFilters';
import { ConfigData, ServicesType } from '../../../interface/service.interface';
import { ServicePageData } from '../../../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { getApiCollections } from '../../../rest/apiCollectionsAPI';
import { getDashboards } from '../../../rest/dashboardAPI';
import { getDatabases } from '../../../rest/databaseAPI';
import { getMlModels } from '../../../rest/mlModelAPI';
import { getPipelines } from '../../../rest/pipelineAPI';
import { getSearchIndexes } from '../../../rest/SearchIndexAPI';
import {
  exportDatabaseServiceDetailsInCSV,
  getServiceByFQN,
  patchService,
  restoreService,
} from '../../../rest/serviceAPI';
import { getContainers } from '../../../rest/storageAPI';
import { getTopics } from '../../../rest/topicsAPI';
import connectionsRouterClassBase from '../../../utils/ConnectionsRouterClassBase';
import { getServiceLogo } from '../../../utils/EntityDisplayUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityImportPath } from '../../../utils/EntityPureUtils';
import {
  ActionContribution,
  EXTENSION_POINTS,
  PluginEntityDetailsContext,
  SlotContribution,
  TabContribution,
} from '../../../utils/ExtensionPointTypes';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  getCountLabel,
  getEntityTypeFromServiceCategory,
  getResourceEntityFromServiceCategory,
  shouldTestConnection,
} from '../../../utils/ServicePureUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import DeleteEntityModal from '../../common/DeleteWidget/DeleteEntityModal';
import AnnouncementDrawer from '../../common/EntityPageInfos/AnnouncementDrawer/AnnouncementDrawer';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../../common/HeaderShell/HeaderShell.component';
import Loader from '../../common/Loader/Loader';
import TestConnection from '../../common/TestConnection/TestConnection';
import { useEntityExportModalProvider } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import EntityNameModal from '../../Modals/EntityNameModal/EntityNameModal.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import { useApplicationsProvider } from '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import ServiceConnectionDetails from '../../Settings/Services/ServiceConnectionDetails/ServiceConnectionDetails.component';
import { useSlotInset } from '../hooks/useSlotInset';
import {
  getConnectionsRootBreadcrumb,
  getServiceCategoryBreadcrumb,
} from './connectionsBreadcrumb.utils';
import DataAssetHeaderDetailsRow from './DataAssetHeaderDetailsRow/DataAssetHeaderDetailsRow';
import DataAssetsTab from './DataAssetsTab';

type StaticTabKey = 'dataAssets' | 'connection';
type TabKey = StaticTabKey | string;

interface DetailsTab {
  key: TabKey;
  label: ReactNode;
  order: number;
  badge?: number;
}

// OSS built-in tabs. A plugin (e.g. Collate's summary/insights/agents) contributes the rest via
// SERVICE_DETAILS_TABS with its own `order`; sorting the merged list ascending is what lets a
// contribution land before or after these without either side knowing about the other.
const DATA_ASSETS_TAB_ORDER = 40;
const CONNECTION_TAB_ORDER = 50;

const getActionButtonColor = (action: ActionContribution) => {
  if (action.danger) {
    return 'primary-destructive';
  }

  return action.type === 'primary' ? 'primary' : 'secondary';
};

const ConnectionServiceDetailsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { serviceCategory, fqn, tab } = useParams<{
    serviceCategory: string;
    fqn: string;
    tab?: string;
  }>();

  const decodedFqn = useMemo(() => decodeURIComponent(fqn ?? ''), [fqn]);

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { extensionRegistry } = useApplicationsProvider();

  const [activeTab, setActiveTab] = useState<TabKey>(() => tab ?? 'dataAssets');

  const handleTabChange = useCallback(
    (tabKey: TabKey) => {
      setActiveTab(tabKey);
      navigate(
        `/connections/${encodeURIComponent(
          serviceCategory ?? ''
        )}/${encodeURIComponent(decodedFqn)}/${encodeURIComponent(tabKey)}`
      );
    },
    [navigate, serviceCategory, decodedFqn]
  );
  const [serviceDetails, setServiceDetails] = useState<ServicesType>(
    {} as ServicesType
  );
  const [servicePermission, setServicePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isServicePermissionLoading, setIsServicePermissionLoading] =
    useState<boolean>(true);
  const [data, setData] = useState<ServicePageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isServiceLoading, setIsServiceLoading] = useState<boolean>(false);

  const pagingInfo = usePaging();
  const { paging, pageSize, currentPage, handlePagingChange } = pagingInfo;

  const { filters: tableFilters, setFilters } = useTableFilters(
    INITIAL_TABLE_FILTERS
  );
  const { showDeletedTables: showDeleted } = tableFilters;

  const fetchServiceDetails = useCallback(async () => {
    if (!serviceCategory || !decodedFqn) {
      return;
    }
    try {
      setIsLoading(true);
      const res = await getServiceByFQN(serviceCategory, decodedFqn, {
        fields:
          serviceCategory === 'metadataServices'
            ? 'owners,tags,followers,domains'
            : 'owners,tags,followers,domains,dataProducts',
        // Include.All so a soft-deleted service still resolves. The default is NonDeleted, which
        // 404s the moment a service is deleted — the page then shows only an error toast, even
        // though everything it renders (description, owners, tags) still exists. Classic
        // service details does the same.
        include: Include.All,
      });
      setServiceDetails(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [serviceCategory, decodedFqn]);

  const fetchServicePermission = useCallback(async () => {
    if (!serviceCategory || !decodedFqn) {
      return;
    }
    try {
      setIsServicePermissionLoading(true);
      const resource = getResourceEntityFromServiceCategory(serviceCategory);
      const perm = await getEntityPermissionByFqn(resource, decodedFqn);
      setServicePermission(perm);
    } catch {
      setServicePermission(DEFAULT_ENTITY_PERMISSION);
    } finally {
      setIsServicePermissionLoading(false);
    }
  }, [serviceCategory, decodedFqn, getEntityPermissionByFqn]);

  const contentScrollRef = useRef<HTMLDivElement>(null);

  // The AI plugin fills this region with its own composer/summary strip; OSS core has nothing of
  // its own to put here, so it renders only what is contributed and reserves no space when nothing
  // is (mirrors ConnectionsPage's CONNECTIONS_PAGE_FOOTER wiring).
  const { ref: footerRef, inset: footerInset } = useSlotInset();

  // Each tab is a different list; carrying the previous tab's scroll offset into it drops the
  // user part-way down a list they have not seen the top of.
  useEffect(() => {
    if (contentScrollRef.current) {
      // scrollTop rather than scrollTo: jumping is what a tab change wants, and scrollTo is not
      // implemented in jsdom so the tests could not cover this.
      contentScrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const handleRestoreService = useCallback(async () => {
    try {
      await restoreService(serviceCategory ?? '', serviceDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', { entity: t('label.service') })
      );
      // Refetch rather than patching local state: restoring revives the service's children too,
      // and the tabs read those from their own requests.
      fetchServiceDetails();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', { entity: t('label.service') })
      );
    }
  }, [serviceCategory, serviceDetails.id, t, fetchServiceDetails]);

  const isServiceDeleted = useMemo(
    () => serviceDetails.deleted ?? false,
    [serviceDetails.deleted]
  );

  const categoryBreadcrumb = useMemo(
    () => getServiceCategoryBreadcrumb(t, serviceCategory),
    [t, serviceCategory]
  );

  const getOtherDetails = useCallback(
    async (paging?: Omit<Paging, 'total'>) => {
      try {
        setIsServiceLoading(true);
        const pagingParams = { ...paging, limit: pageSize };
        // A soft-deleted service's children are soft-deleted with it, so asking for live ones
        // returns nothing and the tab reads as empty rather than as deleted.
        const childInclude = isServiceDeleted
          ? Include.Deleted
          : Include.NonDeleted;
        switch (serviceCategory as ServiceCategory) {
          case ServiceCategory.DATABASE_SERVICES: {
            const res = await getDatabases(decodedFqn, '', pagingParams);
            setData(res.data);
            handlePagingChange(res.paging);

            break;
          }
          case ServiceCategory.MESSAGING_SERVICES: {
            const res = await getTopics(decodedFqn, '', pagingParams);
            setData(res.data);
            handlePagingChange(res.paging);

            break;
          }
          case ServiceCategory.DASHBOARD_SERVICES: {
            const res = await getDashboards(decodedFqn, '', pagingParams);
            setData(res.data);
            handlePagingChange(res.paging);

            break;
          }
          case ServiceCategory.PIPELINE_SERVICES: {
            const res = await getPipelines(decodedFqn, '', pagingParams);
            setData(res.data);
            handlePagingChange(res.paging);

            break;
          }
          case ServiceCategory.ML_MODEL_SERVICES: {
            const res = await getMlModels(decodedFqn, '', pagingParams);
            setData(res.data);
            handlePagingChange(res.paging);

            break;
          }
          case ServiceCategory.STORAGE_SERVICES: {
            const res = await getContainers({
              service: decodedFqn,
              fields: '',
              paging: pagingParams,
              include: childInclude,
            });
            setData(res.data);
            handlePagingChange(res.paging);

            break;
          }
          case ServiceCategory.SEARCH_SERVICES: {
            const res = await getSearchIndexes({
              service: decodedFqn,
              fields: '',
              paging: pagingParams,
              include: childInclude,
            });
            setData(res.data);
            handlePagingChange(res.paging);

            break;
          }
          case ServiceCategory.API_SERVICES: {
            const res = await getApiCollections({
              service: decodedFqn,
              fields: '',
              paging: pagingParams,
              include: childInclude,
            });
            setData(res.data);
            handlePagingChange(res.paging);

            break;
          }
          default:
            break;
        }
      } catch {
        setData([]);
        handlePagingChange(pagingObject);
      } finally {
        setIsServiceLoading(false);
      }
    },
    [
      serviceCategory,
      decodedFqn,
      pageSize,
      handlePagingChange,
      isServiceDeleted,
    ]
  );

  const onDescriptionUpdate = useCallback(
    async (updatedHTML: string) => {
      if (!serviceCategory || !serviceDetails.id) {
        return;
      }
      const updatedData = { ...serviceDetails, description: updatedHTML };
      const jsonPatch = compare(serviceDetails, updatedData);
      const res = await patchService(
        serviceCategory,
        serviceDetails.id,
        jsonPatch
      );
      setServiceDetails(res);
    },
    [serviceCategory, serviceDetails]
  );

  const saveUpdatedServiceData = useCallback(
    async (updatedData: ServicesType) => {
      if (!serviceCategory || !serviceDetails.id) {
        return;
      }
      const jsonPatch = compare(serviceDetails, updatedData);
      const res = await patchService(
        serviceCategory,
        serviceDetails.id,
        jsonPatch
      );
      setServiceDetails(res);
    },
    [serviceCategory, serviceDetails]
  );

  const onUpdateOwners = useCallback(
    async (owners?: EntityReference[]) => {
      await saveUpdatedServiceData({ ...serviceDetails, owners });
    },
    [saveUpdatedServiceData, serviceDetails]
  );

  const onUpdateDomain = useCallback(
    async (domain: EntityReference | EntityReference[]) => {
      const domains = Array.isArray(domain) ? domain : [domain];
      await saveUpdatedServiceData({
        ...serviceDetails,
        domains: domains as unknown as typeof serviceDetails.domains,
      });
    },
    [saveUpdatedServiceData, serviceDetails]
  );

  const onUpdateTier = useCallback(
    async (tier?: Tag) => {
      const nonTierTags = (serviceDetails.tags ?? []).filter(
        (tag) => !tag.tagFQN?.startsWith('Tier.')
      );
      const updatedTags = tier
        ? [
            ...nonTierTags,
            {
              tagFQN: tier.fullyQualifiedName ?? '',
              source: TagSource.Classification,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : nonTierTags;
      await saveUpdatedServiceData({ ...serviceDetails, tags: updatedTags });
    },
    [saveUpdatedServiceData, serviceDetails]
  );

  const onDataProductUpdate = useCallback(
    async (dataProducts: DataProduct[]) => {
      if (!serviceCategory || !serviceDetails.id) {
        return;
      }
      const updatedData = {
        ...serviceDetails,
        dataProducts: dataProducts.map((dp) => ({
          id: dp.id,
          type: 'dataProduct',
          name: dp.name,
          fullyQualifiedName: dp.fullyQualifiedName,
        })),
      };
      const jsonPatch = compare(serviceDetails, updatedData);
      const res = await patchService(
        serviceCategory,
        serviceDetails.id,
        jsonPatch
      );
      setServiceDetails(res);
    },
    [serviceCategory, serviceDetails]
  );

  const connectionDetails = useMemo(
    () =>
      (serviceDetails as unknown as { connection?: { config?: ConfigData } })
        ?.connection?.config,
    [serviceDetails]
  );

  const allowTestConn = useMemo(
    () => shouldTestConnection(serviceCategory ?? ''),
    [serviceCategory]
  );

  const isTestingDisabled = useMemo(
    () => !servicePermission.EditAll || !connectionDetails,
    [servicePermission.EditAll, connectionDetails]
  );

  const goToEditConnection = useCallback(() => {
    navigate(
      connectionsRouterClassBase.getEditConnectionPath(
        serviceCategory ?? '',
        decodedFqn ?? ''
      )
    );
  }, [serviceCategory, decodedFqn, navigate]);

  const [isAnnouncementDrawerOpen, setIsAnnouncementDrawerOpen] =
    useState(false);
  const [isDisplayNameEditing, setIsDisplayNameEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const serviceEntityType: EntityType = useMemo(
    () => getEntityTypeFromServiceCategory(serviceCategory as ServiceCategory),
    [serviceCategory]
  );

  const { showModal } = useEntityExportModalProvider();

  const supportsImportExport = useMemo(
    () => serviceEntityType === EntityType.DATABASE_SERVICE,
    [serviceEntityType]
  );

  const handleImportClick = useCallback(() => {
    navigate(getEntityImportPath(serviceEntityType, decodedFqn));
  }, [navigate, serviceEntityType, decodedFqn]);

  const handleExportClick = useCallback(() => {
    showModal({
      name: decodedFqn,
      onExport: exportDatabaseServiceDetailsInCSV,
      exportTypes: [ExportTypes.CSV],
    });
  }, [showModal, decodedFqn]);

  const handleOpenAnnouncementDrawer = useCallback(
    () => setIsAnnouncementDrawerOpen(true),
    []
  );

  const handleCloseAnnouncementDrawer = useCallback(
    () => setIsAnnouncementDrawerOpen(false),
    []
  );

  const handleDisplayNameUpdate = useCallback(
    async (data: EntityName) => {
      await saveUpdatedServiceData({
        ...serviceDetails,
        displayName: data.displayName,
      });
    },
    [saveUpdatedServiceData, serviceDetails]
  );

  const afterServiceDeleteAction = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    fetchServiceDetails();
    fetchServicePermission();
  }, []);

  useEffect(() => {
    if (activeTab === 'dataAssets' && serviceDetails.fullyQualifiedName) {
      getOtherDetails();
    }
  }, [activeTab, serviceDetails.fullyQualifiedName]);

  const extensionContext: PluginEntityDetailsContext = useMemo(
    () => ({
      serviceCategory: serviceCategory as ServiceCategory,
      serviceDetails,
      permissions: servicePermission,
      // Marks this as the AI app-mode connection details frame so a plugin can
      // gate its SERVICE_DETAILS_TABS/ACTIONS contributions to AI mode only and
      // not have them leak onto the classic ServiceDetailsPage (which reads the
      // same extension points with a context carrying serviceCategory +
      // serviceDetails but no isAiMode).
      isAiMode: true,
    }),
    [serviceCategory, serviceDetails, servicePermission]
  );

  const pluginTabs = useMemo(() => {
    const seen = new Set<string>();

    return extensionRegistry
      .getContributions<TabContribution>(EXTENSION_POINTS.SERVICE_DETAILS_TABS)
      .filter((pluginTab) =>
        pluginTab.condition
          ? pluginTab.condition(extensionContext)
          : !pluginTab.isHidden
      )
      .filter((pluginTab) => {
        if (seen.has(pluginTab.key)) {
          return false;
        }
        seen.add(pluginTab.key);

        return true;
      });
  }, [extensionRegistry, extensionContext]);

  const pluginActions = useMemo(() => {
    const seen = new Set<string>();

    return extensionRegistry
      .getContributions<ActionContribution>(
        EXTENSION_POINTS.SERVICE_DETAILS_ACTIONS
      )
      .filter((action) =>
        action.condition ? action.condition(extensionContext) : true
      )
      .filter((action) => {
        if (seen.has(action.key)) {
          return false;
        }
        seen.add(action.key);

        return true;
      });
  }, [extensionRegistry, extensionContext]);

  const footerContributions =
    extensionRegistry.getContributions<SlotContribution>(
      EXTENSION_POINTS.SERVICE_DETAILS_FOOTER
    );

  // Contributed tabs (e.g. Collate's summary/insights/agents, ordered 10/20/30) sort ahead of the
  // OSS built-ins by design — `order` is the only coupling between this page and what a plugin adds,
  // so either side can change independently. A contribution with no `order` sorts after every built
  // in tab but keeps its registration order relative to other order-less contributions.
  const tabs: DetailsTab[] = useMemo(() => {
    const builtIns: DetailsTab[] = [
      {
        key: 'dataAssets',
        label: serviceCategory
          ? getCountLabel(
              serviceCategory as unknown as Parameters<typeof getCountLabel>[0]
            )
          : t('label.data-asset-plural'),
        order: DATA_ASSETS_TAB_ORDER,
      },
      {
        key: 'connection',
        label: t('label.connection'),
        order: CONNECTION_TAB_ORDER,
      },
    ];
    const contributed: DetailsTab[] = pluginTabs.map((pluginTab) => ({
      key: pluginTab.key,
      label: pluginTab.label,
      order: pluginTab.order ?? Number.MAX_SAFE_INTEGER,
      badge: pluginTab.count,
    }));

    return [...builtIns, ...contributed].sort((a, b) => a.order - b.order);
  }, [t, serviceCategory, pluginTabs]);

  const allTabKeys = useMemo(
    () => tabs.map((detailsTab) => detailsTab.key),
    [tabs]
  );
  const defaultTabKey = tabs[0]?.key ?? 'dataAssets';
  // A plain-object extension registry (as returned by the real provider, and by a test double
  // that doesn't memoize its own return value) is a new reference on every render, which would
  // make `allTabKeys` — and this effect — re-run on every render and re-derive the active tab,
  // stomping a tab the user just clicked to before the URL (`tab`) catches up. Keying the effect
  // on the keys' content instead of the array's identity fixes that without losing the "URL tab
  // changed" trigger this effect exists for.
  const tabKeysSignature = allTabKeys.join('|');

  useEffect(() => {
    const tabParam = tab ?? '';
    if (allTabKeys.includes(tabParam)) {
      setActiveTab(tabParam);

      return;
    }
    // A deep-linked plugin tab (e.g. `sql-studio`) isn't in `allTabKeys` until
    // its contribution's condition can evaluate against the loaded
    // `serviceDetails`. Hold the URL tab optimistically while the page is still
    // loading, and only fall back to the default once everything has settled —
    // otherwise the tab flashes to the default before the plugin tab appears.
    if (!isLoading) {
      setActiveTab(defaultTabKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tabKeysSignature, isLoading, defaultTabKey]);

  if (isLoading) {
    return (
      <div className="tw:flex tw:h-full tw:items-center tw:justify-center">
        <Loader size="small" />
      </div>
    );
  }

  return (
    <div className="tw:relative tw:flex tw:h-full tw:flex-col tw:gap-0 tw:overflow-hidden">
      {/* Header */}
      <div className="tw:p-2 tw:pb-0">
        <HeaderShell
          actions={
            <>
              {pluginActions.map((action) => (
                <Button
                  color={getActionButtonColor(action)}
                  iconLeading={
                    action.icon as FC<{ className?: string }> | undefined
                  }
                  key={action.key}
                  size="sm"
                  onPress={() => action.onClick(extensionContext)}>
                  {action.label}
                </Button>
              ))}
              <Dropdown.Root>
                <Button color="secondary" iconLeading={Settings01} size="sm">
                  {t('label.setting-plural')}
                </Button>
                <Dropdown.Popover placement="bottom right">
                  <Dropdown.Menu aria-label={t('label.setting-plural')}>
                    {servicePermission.EditAll && (
                      <Dropdown.Item
                        id="announcement"
                        label={t('label.announcement-plural')}
                        onAction={handleOpenAnnouncementDrawer}
                      />
                    )}
                    {(servicePermission.EditAll ||
                      servicePermission.EditDisplayName) && (
                      <Dropdown.Item
                        id="rename"
                        label={t('label.rename')}
                        onAction={() => setIsDisplayNameEditing(true)}
                      />
                    )}
                    {supportsImportExport &&
                      servicePermission.EditAll &&
                      !isServiceDeleted && (
                        <Dropdown.Item
                          id="import"
                          label={t('label.import')}
                          onAction={handleImportClick}
                        />
                      )}
                    {supportsImportExport &&
                      servicePermission.ViewAll &&
                      !isServiceDeleted && (
                        <Dropdown.Item
                          id="export"
                          label={t('label.export')}
                          onAction={handleExportClick}
                        />
                      )}
                    {servicePermission.Delete && !isServiceDeleted && (
                      <Dropdown.Item
                        id="delete"
                        label={t('label.delete')}
                        onAction={() => setIsDeleting(true)}
                      />
                    )}
                    {/* A soft delete is meant to be reversible, but without this the page offers
                        no way back — matching classic, where restore replaces delete once the
                        service is deleted. */}
                    {servicePermission.EditAll && isServiceDeleted && (
                      <Dropdown.Item
                        id="restore"
                        label={t('label.restore')}
                        onAction={handleRestoreService}
                      />
                    )}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
            </>
          }
          breadcrumb={
            <HeaderBreadcrumb
              noMargin
              items={[
                getConnectionsRootBreadcrumb(t),
                ...(categoryBreadcrumb ? [categoryBreadcrumb] : []),
                {
                  label: serviceDetails.displayName || serviceDetails.name,
                  ariaLabel: serviceDetails.displayName || serviceDetails.name,
                },
              ]}
              showHome={false}
            />
          }
          className="tw:mb-0! tw:pb-0"
          footer={
            <Tabs
              className="tw:mt-2"
              selectedKey={activeTab}
              onSelectionChange={(key) => handleTabChange(String(key))}>
              <Tabs.List
                aria-label={t('label.tab')}
                className="tw:gap-7 tw:before:hidden"
                size="sm"
                type="underline">
                {tabs.map((detailsTab) => (
                  <Tabs.Item
                    badge={detailsTab.badge}
                    className={({ isSelected, isHovered }) =>
                      `tw:py-2 tw:px-0 tw:text-sm tw:font-medium tw:transition-colors ${
                        isSelected
                          ? 'tw:border-fg-brand-primary tw:text-fg-brand-primary'
                          : `tw:border-transparent tw:text-tertiary ${
                              isHovered
                                ? 'tw:border-gray-300 tw:text-secondary'
                                : ''
                            }`
                      }`
                    }
                    data-testid={`${detailsTab.key}-tab`}
                    id={detailsTab.key}
                    key={detailsTab.key}
                    label={detailsTab.label}
                  />
                ))}
              </Tabs.List>
            </Tabs>
          }
          leading={
            <FeaturedIcon
              className="tw:bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)]"
              color="gray"
              icon={getServiceLogo(
                serviceDetails.serviceType,
                'tw:h-6 tw:w-6 tw:object-contain'
              )}
              size="lg"
              theme="modern"
            />
          }
          meta={
            <DataAssetHeaderDetailsRow
              domains={
                (serviceDetails as unknown as { domains?: EntityReference[] })
                  .domains
              }
              hasEditPermission={servicePermission.EditAll}
              owners={serviceDetails.owners}
              tags={serviceDetails.tags}
              onUpdateDomain={onUpdateDomain}
              onUpdateOwners={onUpdateOwners}
              onUpdateTier={onUpdateTier}
            />
          }
          padding="comfortable"
          title={
            <span className="tw:flex tw:items-center tw:gap-2">
              <Typography
                className="tw:text-primary"
                data-testid="entity-header-display-name"
                size="text-xl"
                weight="semibold">
                {serviceDetails.displayName || serviceDetails.name}
              </Typography>
              {/* Without this the page looks like any other service, which matters most here:
                  the deleted switch is the only way in, so the state is easy to forget. Mirrors
                  the classic service header, testid included. */}
              {isServiceDeleted && (
                <Badge
                  color="error"
                  data-testid="deleted-badge"
                  size="sm"
                  type="pill-color">
                  {t('label.deleted')}
                </Badge>
              )}
            </span>
          }
          variant="gradient"
        />
      </div>
      {/* Tab Content */}
      <div
        className="tw:relative tw:flex-1 tw:overflow-y-auto tw:overflow-x-hidden tw:p-4"
        data-testid="service-details-scroll-container"
        ref={contentScrollRef}
        // Reserve the contributed footer's height so the last of a tab's content can be scrolled
        // clear of it. Falls back to the class's own padding when there is no footer contribution,
        // so an empty slot costs no dead space. Applies to every tab because they all render into
        // this container.
        style={{ paddingBottom: footerInset || undefined }}>
        {activeTab === 'dataAssets' && (
          <DataAssetsTab
            currentPage={currentPage}
            data={data}
            isServiceLoading={isServiceLoading}
            paging={paging}
            pagingInfo={pagingInfo}
            saveUpdatedServiceData={saveUpdatedServiceData}
            serviceCategory={serviceCategory as ServiceCategory}
            serviceDetails={serviceDetails}
            servicePermission={servicePermission}
            setFilters={setFilters}
            setIsServiceLoading={setIsServiceLoading}
            showDeleted={showDeleted}
            onDataProductUpdate={onDataProductUpdate}
            onDescriptionUpdate={onDescriptionUpdate}
            onShowDeletedChange={(val) =>
              setFilters({ showDeletedTables: val ? 'true' : undefined })
            }
          />
        )}

        {activeTab === 'connection' && (
          <div className="connection-tab-content">
            <div className="tw:flex tw:items-center tw:justify-end tw:mb-4 tw:gap-2 tw:min-h-9">
              {isServicePermissionLoading || isLoading ? (
                <Loader size="small" />
              ) : (
                <>
                  <Button
                    color="secondary-brand"
                    data-testid="edit-connection-button"
                    isDisabled={!servicePermission.EditAll}
                    size="sm"
                    onPress={goToEditConnection}>
                    {t('label.edit-entity', { entity: t('label.connection') })}
                  </Button>
                  {allowTestConn && (
                    <TestConnection
                      connectionType={serviceDetails?.serviceType ?? ''}
                      getData={() => connectionDetails}
                      isTestingDisabled={isTestingDisabled}
                      serviceCategory={serviceCategory as ServiceCategory}
                      serviceName={serviceDetails?.name}
                      shouldValidateForm={false}
                      showDetails={false}
                    />
                  )}
                </>
              )}
            </div>
            {connectionDetails ? (
              <ServiceConnectionDetails
                connectionDetails={connectionDetails}
                serviceCategory={
                  serviceCategory as unknown as Parameters<
                    typeof ServiceConnectionDetails
                  >[0]['serviceCategory']
                }
                serviceFQN={serviceDetails.serviceType ?? ''}
              />
            ) : (
              <div className="tw:flex tw:h-48 tw:items-center tw:justify-center">
                <p className="tw:text-sm tw:text-gray-400">
                  {t('label.no-connection-details')}
                </p>
              </div>
            )}
          </div>
        )}

        {pluginTabs.map(
          (pluginTab) =>
            activeTab === pluginTab.key && (
              <pluginTab.component key={pluginTab.key} {...extensionContext} />
            )
        )}
      </div>

      {footerContributions.length > 0 && (
        <div
          className="tw:absolute tw:bottom-0 tw:left-0 tw:right-0 tw:z-10 tw:overflow-hidden tw:rounded-b-card"
          ref={footerRef}>
          {footerContributions.map((contribution) => (
            <contribution.component
              key={contribution.key}
              {...extensionContext}
            />
          ))}
        </div>
      )}

      {isAnnouncementDrawerOpen && (
        <AnnouncementDrawer
          createPermission={servicePermission.EditAll}
          entityFQN={serviceDetails.fullyQualifiedName ?? ''}
          entityType={serviceEntityType}
          open={isAnnouncementDrawerOpen}
          onClose={handleCloseAnnouncementDrawer}
        />
      )}

      {isDisplayNameEditing && (
        <EntityNameModal
          entity={{
            displayName: serviceDetails.displayName,
            name: serviceDetails.name ?? '',
          }}
          title={t('label.edit-entity', {
            entity: t('label.display-name'),
          })}
          visible={isDisplayNameEditing}
          onCancel={() => setIsDisplayNameEditing(false)}
          onSave={async (data) => {
            await handleDisplayNameUpdate(data);
            setIsDisplayNameEditing(false);
          }}
        />
      )}

      {isDeleting && (
        <DeleteEntityModal
          isAsyncDelete
          isRecursiveDelete
          afterDeleteAction={afterServiceDeleteAction}
          allowSoftDelete={!serviceDetails.deleted}
          entityId={serviceDetails.id ?? ''}
          entityName={getEntityName(serviceDetails)}
          entityType={serviceEntityType}
          visible={isDeleting}
          onCancel={() => setIsDeleting(false)}
        />
      )}
    </div>
  );
};

export default ConnectionServiceDetailsPage;
