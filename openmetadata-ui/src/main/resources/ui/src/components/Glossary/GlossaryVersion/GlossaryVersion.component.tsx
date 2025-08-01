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
import { toString } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityHistory } from '../../../generated/type/entityHistory';
import {
  getGlossaryTermsVersion,
  getGlossaryTermsVersionsList,
  getGlossaryVersion,
  getGlossaryVersionsList,
} from '../../../rest/glossaryAPI';
import {
  getGlossaryPath,
  getGlossaryTermsVersionsPath,
  getGlossaryVersionsPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Loader from '../../common/Loader/Loader';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import GlossaryV1Component from '../GlossaryV1.component';
import { ModifiedGlossary, useGlossaryStore } from '../useGlossary.store';

interface GlossaryVersionProps {
  isGlossary?: boolean;
}

const GlossaryVersion = ({ isGlossary = false }: GlossaryVersionProps) => {
  const navigate = useNavigate();
  const {
    version,
    tab = 'overview',
    id,
  } = useRequiredParams<{ version: string; tab: string; id: string }>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedData, setSelectedData] = useState<Glossary | GlossaryTerm>();
  const [isVersionLoading, setIsVersionLoading] = useState<boolean>(true);
  const { setActiveGlossary } = useGlossaryStore();
  const { t } = useTranslation();

  const fetchVersionsInfo = async () => {
    try {
      const res = isGlossary
        ? await getGlossaryVersionsList(id)
        : await getGlossaryTermsVersionsList(id);

      setVersionList(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchActiveVersion = async () => {
    setIsVersionLoading(true);
    try {
      const res = isGlossary
        ? await getGlossaryVersion(id, version)
        : await getGlossaryTermsVersion(id, version);

      setSelectedData(res);
      setActiveGlossary(res as ModifiedGlossary);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsVersionLoading(false);
    }
  };

  const onVersionChange = (selectedVersion: string) => {
    const path = isGlossary
      ? getGlossaryVersionsPath(id, selectedVersion)
      : getGlossaryTermsVersionsPath(id, selectedVersion, tab);
    navigate(path);
  };

  const onBackHandler = () => {
    const path = getGlossaryPath(selectedData?.fullyQualifiedName);
    navigate(path);
  };

  useEffect(() => {
    fetchVersionsInfo();
  }, [id]);

  useEffect(() => {
    fetchActiveVersion();
  }, [id, version]);

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-version', { entity: t('label.glossary') })}>
      <div className="version-data">
        {/* TODO: Need to implement version component for Glossary */}
        {isVersionLoading ? (
          <Loader />
        ) : (
          <GlossaryV1Component
            isVersionsView
            isGlossaryActive={isGlossary}
            isSummaryPanelOpen={false}
            selectedData={selectedData as Glossary}
            updateGlossary={() => Promise.resolve()}
            onGlossaryDelete={() => Promise.resolve()}
            onGlossaryTermDelete={() => Promise.resolve()}
            onGlossaryTermUpdate={() => Promise.resolve()}
          />
        )}
      </div>
      <EntityVersionTimeLine
        currentVersion={toString(version)}
        entityType={EntityType.GLOSSARY}
        versionHandler={onVersionChange}
        versionList={versionList}
        onBack={onBackHandler}
      />
    </PageLayoutV1>
  );
};

export default GlossaryVersion;
