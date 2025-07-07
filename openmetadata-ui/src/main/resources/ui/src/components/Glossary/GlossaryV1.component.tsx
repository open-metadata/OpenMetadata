/*
 *  Copyright 2022 Collate.
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
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { EntityAction, EntityTabs, EntityType } from '../../enums/entity.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { PageType } from '../../generated/system/ui/page';
import { useCustomPages } from '../../hooks/useCustomPages';
import { VERSION_VIEW_GLOSSARY_PERMISSION } from '../../mocks/Glossary.mock';
import {
  addGlossaryTerm,
  getFirstLevelGlossaryTerms,
  ListGlossaryTermsParams,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import { getEntityDeleteMessage } from '../../utils/CommonUtils';
import { updateGlossaryTermByFqn } from '../../utils/GlossaryUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getGlossaryTermDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../common/Loader/Loader';
import { GenericProvider } from '../Customization/GenericProvider/GenericProvider';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import { GlossaryTermForm } from './AddGlossaryTermForm/AddGlossaryTermForm.interface';
import GlossaryDetails from './GlossaryDetails/GlossaryDetails.component';
import GlossaryTermModal from './GlossaryTermModal/GlossaryTermModal.component';
import GlossaryTermsV1 from './GlossaryTerms/GlossaryTermsV1.component';
import { GlossaryV1Props } from './GlossaryV1.interfaces';
import './glossaryV1.less';
import { ModifiedGlossary, useGlossaryStore } from './useGlossary.store';

const GlossaryV1 = ({
  isGlossaryActive,
  selectedData,
  onGlossaryTermUpdate,
  updateGlossary,
  updateVote,
  onGlossaryDelete,
  onGlossaryTermDelete,
  isVersionsView,
  onAssetClick,
  isSummaryPanelOpen,
  refreshActiveGlossaryTerm,
}: GlossaryV1Props) => {
  const { t } = useTranslation();
  const { action, tab } = useRequiredParams<{
    action: EntityAction;
    glossaryName: string;
    tab: string;
  }>();
  const { customizedPage } = useCustomPages(
    isGlossaryActive ? PageType.Glossary : PageType.GlossaryTerm
  );
  const navigate = useNavigate();
  const [activeGlossaryTerm, setActiveGlossaryTerm] =
    useState<GlossaryTerm | null>(null);
  const { getEntityPermission } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState(true);
  const [isPermissionLoading, setIsPermissionLoading] = useState(false);
  const { setGlossaryFunctionRef, setTermsLoading } = useGlossaryStore();
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const [isDelete, setIsDelete] = useState<boolean>(false);

  const [glossaryPermission, setGlossaryPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [glossaryTermPermission, setGlossaryTermPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [editMode, setEditMode] = useState(false);

  const {
    activeGlossary,
    glossaryChildTerms,
    setGlossaryChildTerms,
    insertNewGlossaryTermToChildTerms,
  } = useGlossaryStore();

  const { id, fullyQualifiedName } = activeGlossary ?? {};

  const fetchGlossaryTerm = async (
    params?: ListGlossaryTermsParams,
    refresh?: boolean
  ) => {
    refresh ? setTermsLoading(true) : setIsLoading(true);
    try {
      const { data } = await getFirstLevelGlossaryTerms(
        params?.glossary ?? params?.parent ?? ''
      );
      // We are considering childrenCount fot expand collapse state
      // Hence don't need any intervention to list response here
      setGlossaryChildTerms(data as ModifiedGlossary[]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      refresh ? setTermsLoading(false) : setIsLoading(false);
    }
  };

  const fetchGlossaryPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY,
        selectedData?.id as string
      );
      setGlossaryPermission(response);

      return response;
    } catch (error) {
      showErrorToast(error as AxiosError);

      throw error;
    }
  };

  const fetchGlossaryTermPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY_TERM,
        selectedData?.id as string
      );
      setGlossaryTermPermission(response);

      return response;
    } catch (error) {
      showErrorToast(error as AxiosError);

      throw error;
    }
  };

  const handleDelete = async () => {
    const { id } = selectedData;
    if (isGlossaryActive) {
      await onGlossaryDelete(id);
    } else {
      await onGlossaryTermDelete(id);
    }
    setIsDelete(false);
  };

  const loadGlossaryTerms = useCallback(
    (refresh = false) => {
      fetchGlossaryTerm(
        isGlossaryActive
          ? { glossary: fullyQualifiedName }
          : { parent: fullyQualifiedName },
        refresh
      );
    },
    [fullyQualifiedName, isGlossaryActive]
  );

  const handleGlossaryTermModalAction = useCallback(
    (editMode: boolean, glossaryTerm: GlossaryTerm | null) => {
      setEditMode(editMode);
      setActiveGlossaryTerm(glossaryTerm);
      setIsEditModalOpen(true);
    },
    []
  );

  const updateGlossaryTermInStore = (updatedTerm: GlossaryTerm) => {
    const clonedTerms = cloneDeep(glossaryChildTerms);
    const updatedGlossaryTerms = updateGlossaryTermByFqn(
      clonedTerms,
      updatedTerm.fullyQualifiedName ?? '',
      updatedTerm as ModifiedGlossary
    );

    setGlossaryChildTerms(updatedGlossaryTerms);
  };

  const updateGlossaryTerm = async (
    currentData: GlossaryTerm,
    updatedData: GlossaryTerm
  ) => {
    const jsonPatch = compare(currentData, updatedData);
    const response = await patchGlossaryTerm(currentData?.id, jsonPatch);
    if (!response) {
      throw new Error(
        t('server.entity-updating-error', {
          entity: t('label.glossary-term'),
        })
      );
    } else {
      updateGlossaryTermInStore({
        ...response,
        // Since patch didn't respond with childrenCount preserve it from currentData
        childrenCount: currentData.childrenCount,
      });
      setIsEditModalOpen(false);
    }
  };

  const onTermModalSuccess = useCallback(
    (term: GlossaryTerm) => {
      // Setting loading so that nested terms are rendered again on table with change
      setTermsLoading(true);
      // Update store with newly created term
      insertNewGlossaryTermToChildTerms(term);
      if (!isGlossaryActive && tab !== 'terms') {
        navigate(
          getGlossaryTermDetailsPath(
            selectedData.fullyQualifiedName || '',
            EntityTabs.TERMS
          )
        );
      }
      // Close modal and set loading to false
      setIsEditModalOpen(false);
      setTermsLoading(false);
    },
    [isGlossaryActive, tab, selectedData]
  );

  const handleGlossaryTermAdd = async (formData: GlossaryTermForm) => {
    const term = await addGlossaryTerm({
      ...formData,
      glossary:
        activeGlossaryTerm?.glossary?.name ||
        (selectedData.fullyQualifiedName ?? ''),
      parent: activeGlossaryTerm?.fullyQualifiedName,
    });

    onTermModalSuccess(term);
  };

  const handleGlossaryTermSave = async (formData: GlossaryTermForm) => {
    const newTermData = cloneDeep(activeGlossaryTerm);
    if (editMode) {
      if (newTermData && activeGlossaryTerm) {
        const {
          name,
          displayName,
          description,
          synonyms,
          tags,
          references,
          mutuallyExclusive,
          reviewers,
          owners,
          relatedTerms,
          style,
        } = formData || {};

        newTermData.name = name;
        newTermData.style = style;
        newTermData.displayName = displayName;
        newTermData.description = description;
        newTermData.synonyms = synonyms;
        newTermData.tags = tags;
        newTermData.mutuallyExclusive = mutuallyExclusive;
        newTermData.reviewers = reviewers;
        newTermData.owners = owners;
        newTermData.references = references;
        newTermData.relatedTerms = relatedTerms?.map((term) => ({
          id: term,
          type: 'glossaryTerm',
        }));
        await updateGlossaryTerm(activeGlossaryTerm, newTermData);
      }
    } else {
      await handleGlossaryTermAdd(formData);
    }
  };

  const handleGlossaryUpdate = async (newGlossary: Glossary) => {
    const jsonPatch = compare(selectedData, newGlossary);

    const shouldRefreshTerms = jsonPatch.some((patch) =>
      patch.path.startsWith('/owners')
    );

    await updateGlossary(newGlossary);
    shouldRefreshTerms && loadGlossaryTerms(true);
  };

  const initPermissions = async () => {
    setIsPermissionLoading(true);
    const permissionFetch = isGlossaryActive
      ? fetchGlossaryPermission
      : fetchGlossaryTermPermission;

    try {
      if (isVersionsView) {
        const permission = VERSION_VIEW_GLOSSARY_PERMISSION;
        setGlossaryPermission(permission);
        setGlossaryTermPermission(permission);

        return permission;
      } else {
        return await permissionFetch();
      }
    } finally {
      setIsPermissionLoading(false);
    }
  };

  const initializeGlossary = async () => {
    const permission = await initPermissions();
    if (permission?.ViewAll || permission?.ViewBasic) {
      loadGlossaryTerms();
    } else {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id && !action) {
      initializeGlossary();
    }
  }, [id, isGlossaryActive, isVersionsView, action]);

  useEffect(() => {
    setGlossaryFunctionRef({
      onAddGlossaryTerm: (term) =>
        handleGlossaryTermModalAction(false, term ?? null),
      onEditGlossaryTerm: (term) =>
        handleGlossaryTermModalAction(true, term ?? null),
      refreshGlossaryTerms: () => loadGlossaryTerms(true),
    });
  }, [loadGlossaryTerms, handleGlossaryTermModalAction]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const glossaryContent = useMemo(() => {
    if (!(glossaryPermission.ViewAll || glossaryPermission.ViewBasic)) {
      return (
        <div className="full-height">
          <ErrorPlaceHolder
            className="mt-0-important border-none"
            permissionValue={t('label.view-entity', {
              entity: t('label.glossary'),
            })}
            size={SIZE.X_LARGE}
            type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
          />
        </div>
      );
    }

    return (
      <GlossaryDetails
        handleGlossaryDelete={onGlossaryDelete}
        isTabExpanded={isTabExpanded}
        isVersionView={isVersionsView}
        permissions={glossaryPermission}
        toggleTabExpanded={toggleTabExpanded}
        updateGlossary={handleGlossaryUpdate}
        updateVote={updateVote}
      />
    );
  }, [
    glossaryPermission.ViewAll,
    glossaryPermission.ViewBasic,
    isTabExpanded,
    isVersionsView,
    onGlossaryDelete,
    handleGlossaryUpdate,
    updateVote,
  ]);

  return (
    <>
      {(isLoading || isPermissionLoading) && <Loader />}

      <GenericProvider<Glossary | GlossaryTerm>
        currentVersionData={selectedData}
        customizedPage={customizedPage}
        data={selectedData}
        isTabExpanded={isTabExpanded}
        isVersionView={isVersionsView}
        permissions={
          isGlossaryActive ? glossaryPermission : glossaryTermPermission
        }
        type={isGlossaryActive ? EntityType.GLOSSARY : EntityType.GLOSSARY_TERM}
        onUpdate={handleGlossaryUpdate}>
        {!isLoading &&
          !isPermissionLoading &&
          !isEmpty(selectedData) &&
          (isGlossaryActive ? (
            glossaryContent
          ) : (
            <GlossaryTermsV1
              glossaryTerm={selectedData as GlossaryTerm}
              handleGlossaryTermDelete={onGlossaryTermDelete}
              handleGlossaryTermUpdate={onGlossaryTermUpdate}
              isSummaryPanelOpen={isSummaryPanelOpen}
              isTabExpanded={isTabExpanded}
              isVersionView={isVersionsView}
              refreshActiveGlossaryTerm={refreshActiveGlossaryTerm}
              toggleTabExpanded={toggleTabExpanded}
              updateVote={updateVote}
              onAssetClick={onAssetClick}
            />
          ))}
      </GenericProvider>

      {selectedData && (
        <EntityDeleteModal
          bodyText={getEntityDeleteMessage(selectedData.name, '')}
          entityName={selectedData.name}
          entityType="Glossary"
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
          onConfirm={handleDelete}
        />
      )}

      {isEditModalOpen && (
        <GlossaryTermModal
          editMode={editMode}
          glossaryTermFQN={activeGlossaryTerm?.fullyQualifiedName}
          visible={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          onSave={handleGlossaryTermSave}
        />
      )}
    </>
  );
};

export default withActivityFeed(GlossaryV1);
