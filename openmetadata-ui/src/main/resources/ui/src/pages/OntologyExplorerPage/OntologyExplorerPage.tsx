/*
 *  Copyright 2024 Collate.
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

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyExplorer } from '../../components/OntologyExplorer';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import ontologyExplorerClassBase from '../../utils/OntologyExplorerClassBase';

const OntologyExplorerPage: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<string[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  const OntologyHeader = ontologyExplorerClassBase.getHeader();

  const handleStatsChange = useCallback((newStats: string[]) => {
    setStats(newStats);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsStatsLoading(loading);
  }, []);

  return (
    <PageLayoutV1 pageTitle={t('label.ontology-explorer')}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <OntologyHeader isStatsLoading={isStatsLoading} stats={stats} />

        <OntologyExplorer
          height="calc(100vh - 230px)"
          scope="global"
          onLoadingChange={handleLoadingChange}
          onStatsChange={handleStatsChange}
        />
      </div>
    </PageLayoutV1>
  );
};

export default OntologyExplorerPage;
