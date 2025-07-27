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
import { isUndefined } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import RightPanel from '../../components/DataQuality/AddDataQualityTest/components/RightPanel';
import { TEST_SUITE_INGESTION_PAGE_DATA } from '../../components/DataQuality/AddDataQualityTest/rightPanelData';
import TestSuiteIngestion from '../../components/DataQuality/AddDataQualityTest/TestSuiteIngestion';
import { TabSpecificField } from '../../enums/entity.enum';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestSuite } from '../../generated/tests/testSuite';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useFqn } from '../../hooks/useFqn';
import { getIngestionPipelineByFqn } from '../../rest/ingestionPipelineAPI';
import { getTestSuiteByName } from '../../rest/testAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getDataQualityPagePath } from '../../utils/RouterUtils';
import { getTestSuiteDetailsPath } from '../../utils/TestSuiteUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const TestSuiteIngestionPage = () => {
  const { fqn: testSuiteFQN, ingestionFQN } = useFqn();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [testSuite, setTestSuite] = useState<TestSuite>();
  const [ingestionPipeline, setIngestionPipeline] =
    useState<IngestionPipeline>();
  const [slashedBreadCrumb, setSlashedBreadCrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const fetchIngestionByName = async () => {
    setIsLoading(true);
    try {
      const response = await getIngestionPipelineByFqn(ingestionFQN);
      setIngestionPipeline(response);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.ingestion-workflow-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTestSuiteByName = async () => {
    setIsLoading(true);
    try {
      const response = await getTestSuiteByName(testSuiteFQN, {
        fields: TabSpecificField.OWNERS,
      });
      setSlashedBreadCrumb([
        {
          name: t('label.test-suite-plural'),
          url: getDataQualityPagePath(),
        },
        {
          name: getEntityName(
            response.basic ? response.basicEntityReference : response
          ),
          url: getTestSuiteDetailsPath({
            isExecutableTestSuite: response.basic,
            fullyQualifiedName: response.basic
              ? response.basicEntityReference?.fullyQualifiedName ?? ''
              : response.fullyQualifiedName ?? '',
          }),
        },
        {
          name: `${ingestionFQN ? t('label.edit') : t('label.add')} ${t(
            'label.ingestion'
          )}`,
          url: '',
        },
      ]);
      setTestSuite(response);

      if (ingestionFQN) {
        await fetchIngestionByName();
      }
    } catch (error) {
      setTestSuite(undefined);
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.test-suite'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestSuiteByName();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (isUndefined(testSuite)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel no-right-panel-splitter"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div>
            <TitleBreadcrumb titleLinks={slashedBreadCrumb} />
            <div className="m-t-md">
              <TestSuiteIngestion
                ingestionPipeline={ingestionPipeline}
                testSuite={testSuite}
              />
            </div>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.test-suite'),
      })}
      secondPanel={{
        children: <RightPanel data={TEST_SUITE_INGESTION_PAGE_DATA} />,
        className: 'content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(TestSuiteIngestionPage);
