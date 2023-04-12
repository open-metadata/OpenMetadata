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
import Loader from 'components/Loader/Loader';
import { API_RES_MAX_SIZE } from 'constants/constants';
import { isEmpty } from 'lodash';
import { VERSION_VIEW_GLOSSARY_PERMISSION } from 'mocks/Glossary.mock';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getGlossaryTerms, ListGlossaryTermsParams } from 'rest/glossaryAPI';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { getEntityDeleteMessage } from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import '../common/entityPageInfo/ManageButton/ManageButton.less';
import GlossaryDetails from '../GlossaryDetails/GlossaryDetails.component';
import GlossaryTermsV1 from '../GlossaryTerms/GlossaryTermsV1.component';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import ExportGlossaryModal from './ExportGlossaryModal/ExportGlossaryModal';
import { GlossaryAction, GlossaryV1Props } from './GlossaryV1.interfaces';
import './GlossaryV1.style.less';
import ImportGlossary from './ImportGlossary/ImportGlossary';

const GlossaryV1 = ({
  isGlossaryActive,
  deleteStatus = 'initial',
  selectedData,
  onGlossaryTermUpdate,
  updateGlossary,
  onGlossaryDelete,
  onGlossaryTermDelete,
  isVersionsView,
  onAssetClick,
  isSummaryPanelOpen,
}: GlossaryV1Props) => {
  const { action } =
    useParams<{ action: GlossaryAction; glossaryName: string }>();
  const history = useHistory();

  const { getEntityPermission } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState(true);

  const [isDelete, setIsDelete] = useState<boolean>(false);

  const [glossaryPermission, setGlossaryPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [glossaryTermPermission, setGlossaryTermPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const { id } = selectedData ?? {};

  const handleCancelGlossaryExport = () =>
    history.push(getGlossaryPath(selectedData.name));

  const isImportAction = useMemo(
    () => action === GlossaryAction.IMPORT,
    [action]
  );
  const isExportAction = useMemo(
    () => action === GlossaryAction.EXPORT,
    [action]
  );

  const fetchGlossaryTerm = async (params?: ListGlossaryTermsParams) => {
    setIsLoading(true);
    try {
      const { data } = await getGlossaryTerms({
        ...params,
        limit: API_RES_MAX_SIZE,
        fields: 'tags,children',
      });
      setGlossaryTerms(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGlossaryPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY,
        selectedData?.id as string
      );
      setGlossaryPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchGlossaryTermPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY_TERM,
        selectedData?.id as string
      );
      setGlossaryTermPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleDelete = () => {
    const { id } = selectedData;
    if (isGlossaryActive) {
      onGlossaryDelete(id);
    } else {
      onGlossaryTermDelete(id);
    }
    setIsDelete(false);
  };

  const loadGlossaryTerms = useCallback(() => {
    fetchGlossaryTerm(isGlossaryActive ? { glossary: id } : { parent: id });
  }, [id, isGlossaryActive]);

  useEffect(() => {
    if (id) {
      loadGlossaryTerms();
      if (isGlossaryActive) {
        isVersionsView
          ? setGlossaryPermission(VERSION_VIEW_GLOSSARY_PERMISSION)
          : fetchGlossaryPermission();
      } else {
        isVersionsView
          ? setGlossaryTermPermission(VERSION_VIEW_GLOSSARY_PERMISSION)
          : fetchGlossaryTermPermission();
      }
    }
  }, [id, isGlossaryActive, isVersionsView]);

  return isImportAction ? (
    <ImportGlossary glossaryName={selectedData.name} />
  ) : (
    <>
      {isLoading && <Loader />}
      {!isLoading &&
        !isEmpty(selectedData) &&
        (isGlossaryActive ? (
          <GlossaryDetails
            glossary={selectedData as Glossary}
            glossaryTerms={glossaryTerms}
            handleGlossaryDelete={onGlossaryDelete}
            permissions={glossaryPermission}
            refreshGlossaryTerms={loadGlossaryTerms}
            updateGlossary={updateGlossary}
          />
        ) : (
          <GlossaryTermsV1
            childGlossaryTerms={glossaryTerms}
            glossaryTerm={selectedData as GlossaryTerm}
            handleGlossaryTermDelete={onGlossaryTermDelete}
            handleGlossaryTermUpdate={onGlossaryTermUpdate}
            isSummaryPanelOpen={isSummaryPanelOpen}
            permissions={glossaryTermPermission}
            refreshGlossaryTerms={loadGlossaryTerms}
            onAssetClick={onAssetClick}
          />
        ))}

      {selectedData && (
        <EntityDeleteModal
          bodyText={getEntityDeleteMessage(selectedData.name, '')}
          entityName={selectedData.name}
          entityType="Glossary"
          loadingState={deleteStatus}
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
          onConfirm={handleDelete}
        />
      )}
      {isExportAction && (
        <ExportGlossaryModal
          glossaryName={selectedData.name}
          isModalOpen={isExportAction}
          onCancel={handleCancelGlossaryExport}
          onOk={handleCancelGlossaryExport}
        />
      )}
    </>
  );
};

export default GlossaryV1;
