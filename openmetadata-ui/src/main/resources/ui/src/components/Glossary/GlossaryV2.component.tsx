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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { GlossaryTermForm } from 'components/AddGlossaryTermForm/AddGlossaryTermForm.interface';
import GlossaryDetails from 'components/GlossaryDetails/GlossaryDetails.component';
import GlossaryTermsV1 from 'components/GlossaryTerms/GlossaryTermsV1.component';
import Loader from 'components/Loader/Loader';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import {
  API_RES_MAX_SIZE,
  getGlossaryTermDetailsPath,
} from 'constants/constants';
import { compare } from 'fast-json-patch';
import { cloneDeep, noop } from 'lodash';
import { VERSION_VIEW_GLOSSARY_PERMISSION } from 'mocks/Glossary.mock';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  addGlossaryTerm,
  deleteGlossary,
  deleteGlossaryTerm,
  getGlossariesByName,
  getGlossaryTermByFQN,
  getGlossaryTerms,
  ListGlossaryTermsParams,
  patchGlossaries,
  patchGlossaryTerm,
} from 'rest/glossaryAPI';
import { getGlossaryPath } from 'utils/RouterUtils';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import Fqn from '../../utils/Fqn';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import '../common/entityPageInfo/ManageButton/ManageButton.less';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import ExportGlossaryModal from './ExportGlossaryModal/ExportGlossaryModal';
import GlossaryHeader from './GlossaryHeader/GlossaryHeader.component';
import GlossaryTermModal from './GlossaryTermModal/GlossaryTermModal.component';
import { GlossaryAction } from './GlossaryV1.interfaces';
import './GlossaryV1.style.less';

const GlossaryV1 = () => {
  const { t } = useTranslation();
  const { glossaryName: glossaryFqn, tab } = useParams<{
    action: GlossaryAction;
    glossaryName: string;
    tab: string;
  }>();
  const isVersionsView = false;
  const history = useHistory();
  const [selectedData, setSelectedData] = useState<
    Glossary | GlossaryTerm | undefined
  >();

  const isGlossaryActive = useMemo(() => {
    setSelectedData(undefined);
    if (glossaryFqn) {
      return Fqn.split(glossaryFqn).length === 1;
    }

    return true;
  }, [glossaryFqn]);

  const { getEntityPermission } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState(true);
  const [isTermsLoading, setIsTermsLoading] = useState(false);
  const [glossaryPermission, setGlossaryPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [glossaryTermPermission, setGlossaryTermPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExportAction, setIsExportAction] = useState(false);
  const [activeGlossaryTerm, setActiveGlossaryTerm] = useState<
    GlossaryTerm | undefined
  >();
  const [editMode, setEditMode] = useState(false);

  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);

  const fetchGlossaryTerm = async (params?: ListGlossaryTermsParams) => {
    setIsTermsLoading(true);
    try {
      const { data } = await getGlossaryTerms({
        ...params,
        limit: API_RES_MAX_SIZE,
        fields: 'tags,children,reviewers,relatedTerms,owner,parent',
      });
      setGlossaryTerms(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTermsLoading(false);
    }
  };

  const fetchGlossaryPermission = async (glossaryId: string) => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY,
        glossaryId
      );
      setGlossaryPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchGlossaryTermPermission = async (glossaryTermId: string) => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY_TERM,
        glossaryTermId
      );
      setGlossaryTermPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const loadGlossaryTerms = useCallback(
    (id) => {
      fetchGlossaryTerm(isGlossaryActive ? { glossary: id } : { parent: id });
    },
    [isGlossaryActive]
  );

  const handleGlossaryTermModalAction = (
    editMode: boolean,
    glossaryTerm: GlossaryTerm | undefined
  ) => {
    setEditMode(editMode);
    setActiveGlossaryTerm(glossaryTerm);
    setIsEditModalOpen(true);
  };

  const updateGlossary = async (updatedData: Glossary) => {
    const jsonPatch = compare(selectedData as Glossary, updatedData);
    try {
      await patchGlossaries(selectedData?.id as string, jsonPatch);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleGlossaryDelete = (id: string) => {
    deleteGlossary(id)
      .then(() => {
        showSuccessToast(
          t('server.entity-deleted-successfully', {
            entity: t('label.glossary'),
          })
        );
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.delete-entity-error', {
            entity: t('label.glossary'),
          })
        );
      });
  };

  const handleGlossaryTermDelete = (id: string) => {
    deleteGlossaryTerm(id)
      .then(() => {
        showSuccessToast(
          t('server.entity-deleted-successfully', {
            entity: t('label.glossary-term'),
          })
        );
        let fqn;
        if (glossaryFqn) {
          const fqnArr = glossaryFqn.split(FQN_SEPARATOR_CHAR);
          fqnArr.pop();
          fqn = fqnArr.join(FQN_SEPARATOR_CHAR);
        }
        history.push(getGlossaryPath(fqn));
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.delete-entity-error', {
            entity: t('label.glossary-term'),
          })
        );
      });
  };

  const handleGlossaryTermUpdate = async (updatedData: GlossaryTerm) => {
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
        }
      } else {
        throw t('server.entity-updating-error', {
          entity: t('label.glossary-term'),
        });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const loadGlossaryData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getGlossariesByName(
        glossaryFqn,
        'reviewers,tags,owner'
      );
      await fetchGlossaryTerm({ glossary: result.id });
      isVersionsView
        ? setGlossaryPermission(VERSION_VIEW_GLOSSARY_PERMISSION)
        : fetchGlossaryPermission(result.id);
      setSelectedData(result);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [glossaryFqn]);

  const loadGlossaryTermData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getGlossaryTermByFQN(
        glossaryFqn,
        'relatedTerms,reviewers,tags,owner,parent,children'
      );
      await fetchGlossaryTerm({ parent: result.id });
      isVersionsView
        ? setGlossaryTermPermission(VERSION_VIEW_GLOSSARY_PERMISSION)
        : fetchGlossaryTermPermission(result.id);
      setSelectedData(result);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [glossaryFqn]);

  const onTermModalSuccess = useCallback(() => {
    loadGlossaryTerms(selectedData?.id);
    if (!isGlossaryActive && tab !== 'terms' && selectedData) {
      history.push(
        getGlossaryTermDetailsPath(
          selectedData.fullyQualifiedName || '',
          'terms'
        )
      );
    }
    setIsEditModalOpen(false);
  }, [isGlossaryActive, tab, selectedData]);

  const updateGlossaryTerm = async (
    currentData: GlossaryTerm,
    updatedData: GlossaryTerm
  ) => {
    try {
      const jsonPatch = compare(currentData, updatedData);
      const response = await patchGlossaryTerm(currentData?.id, jsonPatch);
      if (!response) {
        throw t('server.entity-updating-error', {
          entity: t('label.glossary-term'),
        });
      }
      onTermModalSuccess();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleGlossaryTermAdd = async (formData: GlossaryTermForm) => {
    try {
      await addGlossaryTerm({
        ...formData,
        reviewers: formData.reviewers.map(
          (item) => item.fullyQualifiedName || ''
        ),
        glossary:
          activeGlossaryTerm?.glossary?.name || selectedData?.name || '',
        parent: activeGlossaryTerm?.fullyQualifiedName,
      });
      onTermModalSuccess();
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
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
          owner,
          relatedTerms,
        } = formData || {};

        newTermData.name = name;
        newTermData.displayName = displayName;
        newTermData.description = description;
        newTermData.synonyms = synonyms;
        newTermData.tags = tags;
        newTermData.mutuallyExclusive = mutuallyExclusive;
        newTermData.reviewers = reviewers;
        newTermData.owner = owner;
        newTermData.references = references;
        newTermData.relatedTerms = relatedTerms?.map((term) => ({
          id: term,
          type: 'glossaryTerm',
        }));
        await updateGlossaryTerm(activeGlossaryTerm, newTermData);
      }
    } else {
      handleGlossaryTermAdd(formData);
    }
  };

  useEffect(() => {
    isGlossaryActive ? loadGlossaryData() : loadGlossaryTermData();
  }, [glossaryFqn]);

  if (isLoading || !selectedData) {
    return <Loader />;
  }

  return (
    <Row
      className="glossary-details"
      data-testid="glossary-details"
      gutter={[0, 16]}>
      <Col span={24}>
        <GlossaryHeader
          isGlossary={isGlossaryActive}
          permissions={
            isGlossaryActive ? glossaryPermission : glossaryTermPermission
          }
          selectedData={selectedData}
          onAddGlossaryTerm={(term) =>
            handleGlossaryTermModalAction(false, term)
          }
          onDelete={
            isGlossaryActive ? handleGlossaryDelete : handleGlossaryTermDelete
          }
          onExport={() => setIsExportAction(true)}
          onUpdate={updateGlossary}
        />
      </Col>
      <Col span={24}>
        {isGlossaryActive ? (
          <GlossaryDetails
            glossary={selectedData as Glossary}
            glossaryTerms={glossaryTerms}
            permissions={glossaryPermission}
            refreshGlossaryTerms={() => loadGlossaryTerms(selectedData.id)}
            termsLoading={isTermsLoading}
            updateGlossary={updateGlossary}
            onAddGlossaryTerm={(term) =>
              handleGlossaryTermModalAction(false, term)
            }
            onEditGlossaryTerm={(term) =>
              handleGlossaryTermModalAction(true, term)
            }
          />
        ) : (
          <GlossaryTermsV1
            childGlossaryTerms={glossaryTerms}
            glossaryTerm={selectedData as GlossaryTerm}
            handleGlossaryTermUpdate={handleGlossaryTermUpdate}
            isSummaryPanelOpen={false}
            permissions={glossaryTermPermission}
            refreshGlossaryTerms={() => loadGlossaryTerms(selectedData.id)}
            termsLoading={isTermsLoading}
            onAddGlossaryTerm={(term) =>
              handleGlossaryTermModalAction(false, term)
            }
            onAssetClick={noop}
            onEditGlossaryTerm={(term) =>
              handleGlossaryTermModalAction(true, term)
            }
          />
        )}

        {isExportAction && (
          <ExportGlossaryModal
            glossaryName={selectedData.name}
            isModalOpen={isExportAction}
            onCancel={() => setIsExportAction(false)}
            onOk={() => setIsExportAction(false)}
          />
        )}

        {isEditModalOpen && (
          <GlossaryTermModal
            editMode={editMode}
            glossaryName={selectedData.name}
            glossaryReviewers={isGlossaryActive ? selectedData.reviewers : []}
            glossaryTerm={activeGlossaryTerm}
            visible={isEditModalOpen}
            onCancel={() => setIsEditModalOpen(false)}
            onSave={handleGlossaryTermSave}
          />
        )}
      </Col>
    </Row>
  );
};

export default GlossaryV1;
