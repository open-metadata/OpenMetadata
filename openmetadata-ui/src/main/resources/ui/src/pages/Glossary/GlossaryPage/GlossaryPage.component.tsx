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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import EntitySummaryPanel from '../../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../../components/Explore/ExplorePage.interface';
import GlossaryV1 from '../../../components/Glossary/GlossaryV1.component';
import Loader from '../../../components/Loader/Loader';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../components/PermissionProvider/PermissionProvider.interface';
import { VotingDataProps } from '../../../components/Voting/voting.interface';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE_LARGE, ROUTES } from '../../../constants/constants';
import { GLOSSARIES_DOCS } from '../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Operation } from '../../../generated/entity/policies/policy';
import { Include } from '../../../generated/type/include';
import {
  getGlossariesList,
  getGlossaryTermByFQN,
  patchGlossaries,
  patchGlossaryTerm,
  restoreGlossary,
  restoreGlossaryTerm,
  updateGlossaryTermVotes,
  updateGlossaryVotes,
} from '../../../rest/glossaryAPI';
import Fqn from '../../../utils/Fqn';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import GlossaryLeftPanel from '../GlossaryLeftPanel/GlossaryLeftPanel.component';

const GlossaryPage = () => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { fqn: glossaryName } = useParams<{ fqn: string }>();
  const glossaryFqn = decodeURIComponent(glossaryName);
  const history = useHistory();
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeletedGlossaries, setShowDeletedGlossaries] =
    useState<boolean>(false);
  const [selectedData, setSelectedData] = useState<Glossary | GlossaryTerm>();
  const [isRightPanelLoading, setIsRightPanelLoading] = useState(true);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();

  const onShowDeletedGlossariesChange = () => {
    setShowDeletedGlossaries((prevValue) => !prevValue);
  };

  const isGlossaryActive = useMemo(() => {
    setIsRightPanelLoading(true);
    setSelectedData(undefined);

    if (glossaryFqn) {
      return Fqn.split(glossaryFqn).length === 1;
    }

    return true;
  }, [glossaryFqn]);

  const createGlossaryPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        isGlossaryActive
          ? ResourceEntity.GLOSSARY
          : ResourceEntity.GLOSSARY_TERM,
        permissions
      ),
    [permissions, isGlossaryActive]
  );

  const viewBasicGlossaryPermission = useMemo(
    () =>
      checkPermission(
        Operation.ViewBasic,
        isGlossaryActive
          ? ResourceEntity.GLOSSARY
          : ResourceEntity.GLOSSARY_TERM,
        permissions
      ),
    [permissions, isGlossaryActive]
  );

  const viewAllGlossaryPermission = useMemo(
    () =>
      checkPermission(
        Operation.ViewAll,
        isGlossaryActive
          ? ResourceEntity.GLOSSARY
          : ResourceEntity.GLOSSARY_TERM,
        permissions
      ),
    [permissions, isGlossaryActive]
  );

  const handleAddGlossaryClick = () => {
    history.push(ROUTES.ADD_GLOSSARY);
  };

  const fetchGlossaryList = async () => {
    setIsRightPanelLoading(true);
    setIsLoading(true);
    try {
      const { data } = await getGlossariesList({
        fields: 'owner,tags,reviewers,votes,domain',
        limit: PAGE_SIZE_LARGE,
        include: showDeletedGlossaries ? Include.Deleted : Include.NonDeleted,
      });
      setGlossaries(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setIsRightPanelLoading(false);
    }
  };
  useEffect(() => {
    fetchGlossaryList();
  }, [showDeletedGlossaries]);

  const fetchGlossaryTermDetails = async () => {
    setIsRightPanelLoading(true);
    try {
      const response = await getGlossaryTermByFQN(
        glossaryFqn,
        'relatedTerms,reviewers,tags,owner,children,votes,domain',
        Include.All
      );
      setSelectedData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsRightPanelLoading(false);
    }
  };

  useEffect(() => {
    setIsRightPanelLoading(true);
    if (glossaries.length) {
      if (!isGlossaryActive) {
        fetchGlossaryTermDetails();
      } else {
        setSelectedData(
          glossaries.find(
            (glossary) => glossary.fullyQualifiedName === glossaryFqn
          ) || glossaries[0]
        );
        !glossaryFqn &&
          glossaries[0].fullyQualifiedName &&
          history.replace(getGlossaryPath(glossaries[0].fullyQualifiedName));
        setIsRightPanelLoading(false);
      }
    }
  }, [isGlossaryActive, glossaryFqn, glossaries]);

  const updateGlossary = async (updatedData: Glossary) => {
    const jsonPatch = compare(selectedData as Glossary, updatedData);

    try {
      const response = await patchGlossaries(
        selectedData?.id as string,
        jsonPatch
      );

      setGlossaries((pre) => {
        return pre.map((item) => {
          if (item.name === response.name) {
            return response;
          } else {
            return item;
          }
        });
      });

      if (selectedData?.name !== updatedData.name) {
        history.push(getGlossaryPath(response.fullyQualifiedName));
        fetchGlossaryList();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateVote = async (data: VotingDataProps) => {
    try {
      const isGlossaryEntity =
        Fqn.split(selectedData?.fullyQualifiedName).length <= 1;

      if (isGlossaryEntity) {
        await updateGlossaryVotes(selectedData?.id ?? '', data);
        fetchGlossaryList();
      } else {
        await updateGlossaryTermVotes(selectedData?.id ?? '', data);
        fetchGlossaryTermDetails();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleGlossaryTermUpdate = useCallback(
    async (updatedData: GlossaryTerm) => {
      const jsonPatch = compare(selectedData as GlossaryTerm, updatedData);
      try {
        const response = await patchGlossaryTerm(
          selectedData?.id as string,
          jsonPatch
        );
        if (response) {
          setSelectedData(response);
          if (selectedData?.name !== updatedData.name) {
            history.push(getGlossaryPath(response.fullyQualifiedName));
            fetchGlossaryList();
          }
        } else {
          throw t('server.entity-updating-error', {
            entity: t('label.glossary-term'),
          });
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [selectedData, fetchGlossaryList]
  );

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
    },
    []
  );

  const onRestoreConfirm = useCallback(async () => {
    if (isGlossaryActive) {
      await restoreGlossary(selectedData?.id ?? '');
      setShowDeletedGlossaries(false);
    } else {
      await restoreGlossaryTerm(selectedData?.id ?? '');
    }
    setSelectedData((prevData) =>
      prevData ? { ...prevData, deleted: false } : undefined
    );
  }, [isGlossaryActive, selectedData]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) => {
      if (isSoftDelete) {
        setSelectedData((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            deleted: !prev?.deleted,
            ...(version ? { version } : {}),
          };
        });
        if (isGlossaryActive) {
          setShowDeletedGlossaries(true);
        } else {
          fetchGlossaryTermDetails();
        }
      } else {
        if (isGlossaryActive) {
          const updatedGlossaries = glossaries.filter(
            (item) => item.id !== selectedData?.id
          );
          const glossaryPath =
            updatedGlossaries.length > 0
              ? getGlossaryPath(updatedGlossaries[0].fullyQualifiedName)
              : getGlossaryPath();

          history.push(glossaryPath);
        } else {
          let fqn;
          if (glossaryFqn) {
            const fqnArr = Fqn.split(glossaryFqn);
            fqnArr.pop();
            fqn = fqnArr.join(FQN_SEPARATOR_CHAR);
          }
          history.push(getGlossaryPath(fqn));
        }
        fetchGlossaryList();
      }
    },
    [isGlossaryActive, glossaries, selectedData, fetchGlossaryList, glossaryFqn]
  );

  const glossaryDetailsMainContent = useMemo(() => {
    if (glossaries.length === 0 && !isLoading) {
      return (
        <ErrorPlaceHolder
          buttonId="add-glossary"
          className="mt-0-important"
          doc={GLOSSARIES_DOCS}
          heading={t('label.glossary')}
          permission={createGlossaryPermission}
          type={
            createGlossaryPermission
              ? ERROR_PLACEHOLDER_TYPE.CREATE
              : ERROR_PLACEHOLDER_TYPE.NO_DATA
          }
          onClick={handleAddGlossaryClick}
        />
      );
    }

    return isRightPanelLoading ? (
      <Loader />
    ) : (
      <GlossaryV1
        afterDeleteAction={afterDeleteAction}
        isGlossaryActive={isGlossaryActive}
        isSummaryPanelOpen={Boolean(previewAsset)}
        isVersionsView={false}
        refreshActiveGlossaryTerm={fetchGlossaryTermDetails}
        selectedData={selectedData as Glossary}
        updateGlossary={updateGlossary}
        updateVote={updateVote}
        onAssetClick={handleAssetClick}
        onGlossaryTermUpdate={handleGlossaryTermUpdate}
        onRestoreConfirm={onRestoreConfirm}
      />
    );
  }, [
    glossaries,
    isLoading,
    createGlossaryPermission,
    handleAddGlossaryClick,
    isRightPanelLoading,
    isGlossaryActive,
    previewAsset,
    fetchGlossaryTermDetails,
    selectedData,
    onRestoreConfirm,
    afterDeleteAction,
    updateGlossary,
    updateVote,
    handleAssetClick,
    handleGlossaryTermUpdate,
  ]);

  if (isLoading) {
    return <Loader />;
  }

  if (!(viewBasicGlossaryPermission || viewAllGlossaryPermission)) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1
      className="glossary-page-layout"
      leftPanel={
        isGlossaryActive && (
          <GlossaryLeftPanel
            glossaries={glossaries}
            isLoading={isLoading}
            showDeleted={showDeletedGlossaries}
            onShowDeletedChange={onShowDeletedGlossariesChange}
          />
        )
      }
      pageTitle={t('label.glossary')}
      rightPanel={
        previewAsset && (
          <EntitySummaryPanel
            entityDetails={previewAsset}
            handleClosePanel={() => setPreviewAsset(undefined)}
          />
        )
      }
      rightPanelWidth={400}>
      {glossaryDetailsMainContent}
    </PageLayoutV1>
  );
};

export default GlossaryPage;
