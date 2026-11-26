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
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import { EntityTabs } from '../../enums/entity.enum';
import { useFqn } from '../../hooks/useFqn';
import { getTestSuiteByName } from '../../rest/testAPI';
import observabilityRouterClassBase from '../../utils/ObservabilityRouterClassBase';
import { getTestSuiteDetailsPath } from '../../utils/TestSuiteUtils';

/**
 * The add/edit test suite pipeline page became a drawer on the Pipelines tab.
 * Old links land on the table's Pipelines tab for a table's suite, or on the
 * bundle suite's page, instead of a 404.
 */
const TestSuiteIngestionRedirect = () => {
  const { fqn } = useFqn();
  const [target, setTarget] = useState<string>();

  useEffect(() => {
    getTestSuiteByName(fqn)
      .then((testSuite) => {
        const path = getTestSuiteDetailsPath({
          isExecutableTestSuite: testSuite.basic,
          fullyQualifiedName:
            (testSuite.basic
              ? testSuite.basicEntityReference?.fullyQualifiedName
              : testSuite.fullyQualifiedName) ?? '',
        });
        setTarget(
          testSuite.basic ? `${path}?qualityTab=${EntityTabs.PIPELINE}` : path
        );
      })
      .catch(() =>
        setTarget(observabilityRouterClassBase.getDataQualityPagePath())
      );
  }, [fqn]);

  return target ? <Navigate replace to={target} /> : <Loader />;
};

export default TestSuiteIngestionRedirect;
