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
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import EntitySummaryPanel from 'components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from 'components/Explore/explore.interface';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import GlossaryRouter from 'components/router/GlossaryRouter';
import { PAGE_SIZE_LARGE, ROUTES } from 'constants/constants';
import { GLOSSARIES_DOCS } from 'constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { Glossary } from 'generated/entity/data/glossary';
import { Operation } from 'generated/entity/policies/policy';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getGlossariesList } from 'rest/glossaryAPI';
import { checkPermission } from 'utils/PermissionsUtils';
import { getGlossaryTermsPath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';
import Fqn from '../../../utils/Fqn';
import GlossaryLeftPanel from '../GlossaryLeftPanel/GlossaryLeftPanel.component';

const GlossaryPage = () => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { glossaryName: glossaryFqn } = useParams<{ glossaryName: string }>();
  const history = useHistory();
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();

  const isGlossaryActive = useMemo(() => {
    if (glossaryFqn) {
      return Fqn.split(glossaryFqn).length === 1;
    }

    return true;
  }, [glossaryFqn]);

  const createGlossaryPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const handleAddGlossaryClick = () => {
    history.push(ROUTES.ADD_GLOSSARY);
  };

  const fetchGlossaryList = async () => {
    setIsLoading(true);
    try {
      const { data } = await getGlossariesList({
        fields: 'owner,tags,reviewers',
        limit: PAGE_SIZE_LARGE,
      });
      setGlossaries(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchGlossaryList();
  }, []);

  useEffect(() => {
    if (glossaries.length && isGlossaryActive && !glossaryFqn) {
      const firstGlossary = glossaries[0];
      if (firstGlossary.fullyQualifiedName) {
        history.replace(getGlossaryTermsPath(firstGlossary.fullyQualifiedName));
      }
    }
  }, [isGlossaryActive, glossaryFqn, glossaries]);

  const handleAssetClick = (asset?: EntityDetailsObjectInterface) => {
    setPreviewAsset(asset);
  };

  if (isLoading) {
    return <Loader />;
  }

  if (glossaries.length === 0 && !isLoading) {
    return (
      <PageContainerV1>
        <ErrorPlaceHolder
          className="mt-0-important"
          doc={GLOSSARIES_DOCS}
          heading={t('label.glossary')}
          permission={createGlossaryPermission}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
          onClick={handleAddGlossaryClick}
        />
      </PageContainerV1>
    );
  }

  return (
    <PageContainerV1>
      <PageLayoutV1
        leftPanel={<GlossaryLeftPanel glossaries={glossaries} />}
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
        <GlossaryRouter />
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default GlossaryPage;
