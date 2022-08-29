/*
 *  Copyright 2022 Collate
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
import { camelCase } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
} from '../../axiosAPIs/ingestionPipelineAPI';
import {
  DEPLOYED_PROGRESS_VAL,
  INGESTION_PROGRESS_END_VAL,
} from '../../constants/constants';
import { FormSubmitType } from '../../enums/form.enum';
import { IngestionActionMessage } from '../../enums/ingestion.enum';
import {
  ConfigType,
  CreateIngestionPipeline,
  PipelineType,
} from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import jsonData from '../../jsons/en';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import DeployIngestionLoaderModal from '../Modals/DeployIngestionLoaderModal/DeployIngestionLoaderModal';
import { TestSuiteIngestionProps } from './AddDataQualityTest.interface';
import TestSuiteScheduler from './components/TestSuiteScheduler';

const TestSuiteIngestion: React.FC<TestSuiteIngestionProps> = ({
  testSuite,
  onCancel,
}) => {
  const history = useHistory();
  const [ingestionData, setIngestionData] = useState<IngestionPipeline>();
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showDeployButton, setShowDeployButton] = useState(false);
  const [ingestionAction, setIngestionAction] = useState(
    IngestionActionMessage.CREATING
  );
  const [isIngestionDeployed, setIsIngestionDeployed] = useState(false);
  const [isIngestionCreated, setIsIngestionCreated] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const getSuccessMessage = useMemo(() => {
    const createMessage = showDeployButton
      ? 'has been created, but failed to deploy'
      : 'has been created and deployed successfully';

    return (
      <span>
        <span className="tw-mr-1 tw-font-semibold">
          &quot;{ingestionData?.name ?? 'Test Suite'}&quot;
        </span>
        <span>{createMessage}</span>
      </span>
    );
  }, [ingestionData, showDeployButton]);

  const handleIngestionDeploy = (id?: string) => {
    setShowDeployModal(true);

    return new Promise<void>((resolve) => {
      setIsIngestionCreated(true);
      setIngestionProgress(INGESTION_PROGRESS_END_VAL);
      setIngestionAction(IngestionActionMessage.DEPLOYING);

      deployIngestionPipelineById(`${id || ingestionData?.id}`)
        .then(() => {
          setIsIngestionDeployed(true);
          setShowDeployButton(false);
          setIngestionProgress(DEPLOYED_PROGRESS_VAL);
          setIngestionAction(IngestionActionMessage.DEPLOYED);
        })
        .catch((err: AxiosError) => {
          setShowDeployButton(true);
          setIngestionAction(IngestionActionMessage.DEPLOYING_ERROR);
          showErrorToast(
            err || jsonData['api-error-messages']['deploy-ingestion-error']
          );
        })
        .finally(() => resolve());
    });
  };

  const createIngestionPipeline = async (repeatFrequency: string) => {
    const ingestionPayload: CreateIngestionPipeline = {
      airflowConfig: {
        scheduleInterval: repeatFrequency,
      },
      name: `${testSuite.name}_${PipelineType.TestSuite}`,
      pipelineType: PipelineType.TestSuite,
      service: {
        id: testSuite.id || '',
        type: camelCase(PipelineType.TestSuite),
      },
      sourceConfig: {
        config: {
          type: ConfigType.TestSuite,
        },
      },
    };

    const ingestion = await addIngestionPipeline(ingestionPayload);

    setIngestionData(ingestion);
    handleIngestionDeploy(ingestion.id).finally(() =>
      setShowDeployModal(false)
    );
  };

  const handleViewTestSuiteClick = () => {
    history.push(getSettingPath());
  };

  const handleDeployClick = () => {
    setShowDeployModal(true);
    handleIngestionDeploy?.().finally(() => {
      setTimeout(() => setShowDeployModal(false), 500);
    });
  };

  return (
    <Row className="tw-form-container" gutter={[16, 16]}>
      <Col span={24}>
        <h6 className="tw-heading tw-text-base" data-testid="header">
          Schedule Ingestion
        </h6>
      </Col>

      <Col span={24}>
        {isIngestionCreated ? (
          <SuccessScreen
            isAirflowSetup
            handleDeployClick={handleDeployClick}
            handleViewServiceClick={handleViewTestSuiteClick}
            name={`${testSuite?.name}_${PipelineType.TestSuite}`}
            showDeployButton={showDeployButton}
            showIngestionButton={false}
            state={FormSubmitType.ADD}
            successMessage={getSuccessMessage}
            viewServiceText="View Test Suite"
          />
        ) : (
          <TestSuiteScheduler
            onCancel={onCancel}
            onSubmit={createIngestionPipeline}
          />
        )}
      </Col>

      {showDeployModal && (
        <DeployIngestionLoaderModal
          action={ingestionAction}
          ingestionName={ingestionData?.name || ''}
          isDeployed={isIngestionDeployed}
          isIngestionCreated={isIngestionCreated}
          progress={ingestionProgress}
        />
      )}
    </Row>
  );
};

export default TestSuiteIngestion;
