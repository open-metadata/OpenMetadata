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

import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DeleteType } from '../../../components/common/DeleteWidget/DeleteWidget.interface';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import ResizableLeftPanels from '../../../components/common/ResizablePanels/ResizableLeftPanels';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import { VotingDataProps } from '../../../components/Entity/Voting/voting.interface';
import EntitySummaryPanel from '../../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../../components/Explore/ExplorePage.interface';
import GlossaryV1 from '../../../components/Glossary/GlossaryV1.component';
import {
  ModifiedGlossary,
  useGlossaryStore,
} from '../../../components/Glossary/useGlossary.store';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE_LARGE, ROUTES } from '../../../constants/constants';
import { GLOSSARIES_DOCS } from '../../../constants/docs.constants';
import { observerOptions } from '../../../constants/Mydata.constants';
import { useAsyncDeleteProvider } from '../../../context/AsyncDeleteProvider/AsyncDeleteProvider';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import {
  EntityAction,
  EntityType,
  TabSpecificField,
} from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Operation } from '../../../generated/entity/policies/policy';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useElementInView } from '../../../hooks/useElementInView';
import { useFqn } from '../../../hooks/useFqn';
import {
  getGlossariesList,
  getGlossaryTermByFQN,
  patchGlossaries,
  patchGlossaryTerm,
  updateGlossaryTermVotes,
  updateGlossaryVotes,
} from '../../../rest/glossaryAPI';
import Fqn from '../../../utils/Fqn';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import GlossaryLeftPanel from '../GlossaryLeftPanel/GlossaryLeftPanel.component';

const GlossaryPage = () => {
  const { permissions } = usePermissionProvider();
  const { fqn: glossaryFqn } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { handleOnAsyncEntityDeleteConfirm } = useAsyncDeleteProvider();
  const { action } = useRequiredParams<{ action: EntityAction }>();
  const [initialised, setInitialised] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isMoreGlossaryLoading, setIsMoreGlossaryLoading] =
    useState<boolean>(false);
  const [elementRef, isInView] = useElementInView({
    ...observerOptions,
    root: document.querySelector('#panel-container'),
    rootMargin: '0px 0px 2px 0px',
  });
  const { paging, pageSize, handlePagingChange } = usePaging();

  const [isRightPanelLoading, setIsRightPanelLoading] = useState(true);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();

  const {
    glossaries,
    setGlossaries,
    activeGlossary,
    setActiveGlossary,
    updateActiveGlossary,
  } = useGlossaryStore();

  const isImportAction = useMemo(
    () => action === EntityAction.IMPORT,
    [action]
  );

  const isGlossaryActive = useMemo(() => {
    setIsRightPanelLoading(true);

    if (glossaryFqn) {
      return Fqn.split(glossaryFqn).length === 1;
    }

    return true;
  }, [glossaryFqn]);

  const {
    createGlossaryPermission,
    viewBasicGlossaryPermission,
    viewAllGlossaryPermission,
  } = useMemo(() => {
    const resourceType = isGlossaryActive
      ? ResourceEntity.GLOSSARY
      : ResourceEntity.GLOSSARY_TERM;

    return {
      createGlossaryPermission: checkPermission(
        Operation.Create,
        resourceType,
        permissions
      ),
      viewBasicGlossaryPermission: checkPermission(
        Operation.ViewBasic,
        resourceType,
        permissions
      ),
      viewAllGlossaryPermission: checkPermission(
        Operation.ViewAll,
        resourceType,
        permissions
      ),
    };
  }, [permissions, isGlossaryActive]);

  const handleAddGlossaryClick = useCallback(() => {
    navigate(ROUTES.ADD_GLOSSARY);
  }, [navigate]);

  const fetchGlossaryList = useCallback(async () => {
    try {
      let allGlossaries: Glossary[] = [];
      let nextPage = paging.after;
      let isGlossaryFound = false;
      setInitialised(false);
      setIsLoading(true);

      do {
        const { data, paging: glossaryPaging } = await getGlossariesList({
          fields: [
            TabSpecificField.OWNERS,
            TabSpecificField.TAGS,
            TabSpecificField.REVIEWERS,
            TabSpecificField.VOTES,
            TabSpecificField.DOMAINS,
            TabSpecificField.TERM_COUNT,
          ],
          limit: PAGE_SIZE_LARGE,
          ...(nextPage && { after: nextPage }),
        });

        allGlossaries = [...allGlossaries, ...data];

        if (glossaryFqn) {
          isGlossaryFound = allGlossaries.some(
            (item) => item.fullyQualifiedName === glossaryFqn
          );
        } else {
          isGlossaryFound = true; // limit to first 50 records only if no glossaryFqn
        }

        nextPage = glossaryPaging?.after;

        handlePagingChange(glossaryPaging);
      } while (nextPage && !isGlossaryFound);

      setGlossaries(allGlossaries);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setInitialised(true);
    }
  }, [paging.after, glossaryFqn]);

  const fetchNextGlossaryItems = async (after?: string) => {
    try {
      let allGlossaries: Glossary[] = glossaries;

      setIsMoreGlossaryLoading(true);

      const { data, paging: glossaryPaging } = await getGlossariesList({
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.REVIEWERS,
          TabSpecificField.VOTES,
          TabSpecificField.DOMAINS,
          TabSpecificField.TERM_COUNT,
        ],
        limit: PAGE_SIZE_LARGE,
        after: after,
      });

      allGlossaries = [...allGlossaries, ...data];
      handlePagingChange(glossaryPaging);

      setGlossaries(allGlossaries);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsMoreGlossaryLoading(false);
    }
  };

  useEffect(() => {
    if (!initialised) {
      fetchGlossaryList();
    }
  }, [initialised]);

  useEffect(() => {
    if (paging?.after && isInView && !isMoreGlossaryLoading) {
      fetchNextGlossaryItems(paging.after);
    }
  }, [paging, isInView, isMoreGlossaryLoading, pageSize]);

  const fetchGlossaryTermDetails = useCallback(async () => {
    setIsRightPanelLoading(true);
    try {
      const response = await getGlossaryTermByFQN(glossaryFqn, {
        fields: [
          TabSpecificField.RELATED_TERMS,
          TabSpecificField.REVIEWERS,
          TabSpecificField.TAGS,
          TabSpecificField.OWNERS,
          TabSpecificField.CHILDREN,
          TabSpecificField.VOTES,
          TabSpecificField.DOMAINS,
          TabSpecificField.EXTENSION,
          TabSpecificField.CHILDREN_COUNT,
        ],
      });
      setActiveGlossary(response as ModifiedGlossary);
    } catch (error) {
      if ((error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        navigate(ROUTES.FORBIDDEN, { replace: true });
      }
    } finally {
      setIsRightPanelLoading(false);
    }
  }, [glossaryFqn]);

  useEffect(() => {
    setIsRightPanelLoading(true);
    if (glossaries.length) {
      if (!isGlossaryActive) {
        fetchGlossaryTermDetails();
      } else {
        setActiveGlossary(
          glossaries.find(
            (glossary) => glossary.fullyQualifiedName === glossaryFqn
          ) || glossaries[0]
        );
        !glossaryFqn &&
          glossaries[0].fullyQualifiedName &&
          navigate(getGlossaryPath(glossaries[0].fullyQualifiedName), {
            replace: true,
          });
        setIsRightPanelLoading(false);
      }
    }
  }, [isGlossaryActive, glossaryFqn, glossaries]);

  const updateGlossary = useCallback(
    async (updatedData: Glossary) => {
      const jsonPatch = compare(activeGlossary as Glossary, updatedData);

      try {
        const response = await patchGlossaries(activeGlossary?.id, jsonPatch);

        updateActiveGlossary({ ...updatedData, ...response });

        if (activeGlossary?.name !== updatedData.name) {
          navigate(getGlossaryPath(response.fullyQualifiedName));
          fetchGlossaryList();
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [activeGlossary, updateActiveGlossary, navigate, fetchGlossaryList]
  );

  const updateVote = useCallback(
    async (data: VotingDataProps) => {
      try {
        const isGlossaryEntity =
          Fqn.split(activeGlossary?.fullyQualifiedName ?? '').length <= 1;

        if (isGlossaryEntity) {
          const {
            entity: { votes },
          } = await updateGlossaryVotes(activeGlossary?.id ?? '', data);
          updateActiveGlossary({ votes });
        } else {
          const {
            entity: { votes },
          } = await updateGlossaryTermVotes(activeGlossary?.id ?? '', data);
          updateActiveGlossary({ votes });
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [updateActiveGlossary, activeGlossary]
  );

  const handleGlossaryDelete = useCallback(
    async (id: string) => {
      try {
        await handleOnAsyncEntityDeleteConfirm({
          entityName: activeGlossary?.name,
          entityId: id,
          entityType: EntityType.GLOSSARY,
          deleteType: DeleteType.HARD_DELETE,
          prepareType: true,
          isRecursiveDelete: true,
        });
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.delete-entity-error', {
            entity: t('label.glossary'),
          })
        );
      }
    },
    [glossaries, activeGlossary]
  );

  const handleGlossaryTermUpdate = useCallback(
    async (updatedData: GlossaryTerm) => {
      const jsonPatch = compare(activeGlossary as GlossaryTerm, updatedData);
      if (isEmpty(jsonPatch)) {
        return;
      }

      const shouldRefreshTerms = jsonPatch.some((patch) =>
        patch.path.startsWith('/owners')
      );

      try {
        const response = await patchGlossaryTerm(activeGlossary?.id, jsonPatch);
        if (response) {
          setActiveGlossary(response as ModifiedGlossary);
          if (activeGlossary?.name !== updatedData.name) {
            navigate(getGlossaryPath(response.fullyQualifiedName));
            fetchGlossaryList();
          }
          shouldRefreshTerms && fetchGlossaryTermDetails();
        } else {
          throw t('server.entity-updating-error', {
            entity: t('label.glossary-term'),
          });
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [activeGlossary]
  );

  const handleGlossaryTermDelete = useCallback(
    async (id: string) => {
      try {
        await handleOnAsyncEntityDeleteConfirm({
          entityName: activeGlossary?.name,
          entityId: id,
          entityType: EntityType.GLOSSARY_TERM,
          deleteType: DeleteType.HARD_DELETE,
          prepareType: true,
          isRecursiveDelete: true,
        });

        let fqn;
        if (glossaryFqn) {
          const fqnArr = Fqn.split(glossaryFqn);
          fqnArr.pop();
          fqn = fqnArr.join(FQN_SEPARATOR_CHAR);
        }
        navigate(getGlossaryPath(fqn));
        // Refresh glossary list to update term count after deletion
        fetchGlossaryList();
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.delete-entity-error', {
            entity: t('label.glossary-term'),
          })
        );
      }
    },
    [glossaryFqn, activeGlossary]
  );

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
    },
    []
  );

  if (isLoading) {
    return <Loader />;
  }

  if (!(viewBasicGlossaryPermission || viewAllGlossaryPermission)) {
    return (
      <div className="d-flex justify-center items-center">
        <ErrorPlaceHolder
          className="mt-0-important border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.glossary'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      </div>
    );
  }

  if (glossaries.length === 0 && !isLoading) {
    return (
      <div className="full-height">
        <ErrorPlaceHolder
          buttonId="add-glossary"
          className="mt-0-important border-none"
          doc={GLOSSARIES_DOCS}
          heading={t('label.glossary')}
          permission={createGlossaryPermission}
          permissionValue={
            createGlossaryPermission
              ? t('label.create-entity', {
                  entity: t('label.glossary'),
                })
              : ''
          }
          size={SIZE.X_LARGE}
          type={
            createGlossaryPermission
              ? ERROR_PLACEHOLDER_TYPE.CREATE
              : ERROR_PLACEHOLDER_TYPE.NO_DATA
          }
          onClick={handleAddGlossaryClick}
        />
      </div>
    );
  }

  const glossaryElement = isRightPanelLoading ? (
    <Loader />
  ) : (
    <GlossaryV1
      isGlossaryActive={isGlossaryActive}
      isSummaryPanelOpen={Boolean(previewAsset)}
      isVersionsView={false}
      refreshActiveGlossaryTerm={fetchGlossaryTermDetails}
      refreshGlossaryList={fetchGlossaryList}
      selectedData={activeGlossary as Glossary}
      updateGlossary={updateGlossary}
      updateVote={updateVote}
      onAssetClick={handleAssetClick}
      onGlossaryDelete={handleGlossaryDelete}
      onGlossaryTermDelete={handleGlossaryTermDelete}
      onGlossaryTermUpdate={handleGlossaryTermUpdate}
    />
  );

  const resizableLayout = isGlossaryActive ? (
    <ResizableLeftPanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className:
          'content-resizable-panel-container' + (previewAsset ? ' m-r-lg' : ''),
        minWidth: 280,
        flex: 0.13,
        title: t('label.glossary'),
        children: (
          <>
            <GlossaryLeftPanel glossaries={glossaries} />
            <div
              className="w-full"
              data-testid="glossary-left-panel-scroller"
              id="observer-element"
              ref={elementRef as RefObject<HTMLDivElement>}
            />
            {isMoreGlossaryLoading && <Loader />}
          </>
        ),
      }}
      hideFirstPanel={isImportAction}
      pageTitle={t('label.glossary')}
      secondPanel={{
        children: glossaryElement,
        className: 'content-resizable-panel-container',
        minWidth: 800,
        flex: 0.87,
      }}
    />
  ) : (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        children: glossaryElement,
        minWidth: 700,
        flex: 0.7,
        wrapInCard: false,
      }}
      hideSecondPanel={!previewAsset}
      pageTitle={t('label.glossary')}
      secondPanel={{
        wrapInCard: false,
        children: previewAsset && (
          <EntitySummaryPanel
            entityDetails={previewAsset}
            handleClosePanel={() => setPreviewAsset(undefined)}
            highlights={{ 'tag.name': [glossaryFqn] }}
          />
        ),
        className:
          'content-resizable-panel-container entity-summary-resizable-right-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );

  return <div>{resizableLayout}</div>;
};

export default withPageLayout(GlossaryPage);
