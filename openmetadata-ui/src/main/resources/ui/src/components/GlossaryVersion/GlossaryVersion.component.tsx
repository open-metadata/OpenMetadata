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
import classNames from 'classnames';
import PageContainer from 'components/containers/PageContainer';
import EntityVersionTimeLine from 'components/EntityVersionTimeLine/EntityVersionTimeLine';
import { EntityHistory } from 'generated/type/entityHistory';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGlossaryVersions } from 'rest/glossaryAPI';
import { showErrorToast } from 'utils/ToastUtils';

const GlossaryVersion: React.FC = () => {
  const { glossaryName, version } =
    useParams<{ glossaryName: string; version: string }>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );

  const fetchVersionsInfo = async () => {
    try {
      const res = await getGlossaryVersions(glossaryName);
      setVersionList(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onBackClick = () => {
    console.debug('On back');
  };
  const onVersionHandler = () => {
    console.debug('onVersionHandler');
  };

  useEffect(() => {
    fetchVersionsInfo();
  }, [glossaryName]);

  return (
    <PageContainer>
      <div
        className={classNames(
          'tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col tw-relative'
        )}>
        <EntityVersionTimeLine
          show
          currentVersion={version}
          versionHandler={onVersionHandler}
          versionList={versionList}
          onBack={onBackClick}
        />
      </div>
    </PageContainer>
  );
};

export default GlossaryVersion;
