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
import { Button, Space } from "antd";
import classNames from "classnames";
import { isEmpty } from "lodash";
import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReactComponent as FailIcon } from "../../../assets/svg/fail-badge.svg";
import { ReactComponent as WarningIcon } from "../../../assets/svg/ic-warning.svg";
import { ReactComponent as SuccessIcon } from "../../../assets/svg/success-badge.svg";
import { AIRFLOW_DOCS } from "../../../constants/docs.constants";
import {
  TEST_CONNECTION_INITIAL_MESSAGE,
  TEST_CONNECTION_PROGRESS_PERCENTAGE,
} from "../../../constants/Services.constant";
import {
  StatusType,
  TestConnectionStepResult,
  Workflow,
} from "../../../generated/entity/automations/workflow";
import { TestConnectionStep } from "../../../generated/entity/services/connections/testConnectionDefinition";
import { useAirflowStatus } from "../../../hooks/useAirflowStatus";

import { Transi18next } from "../../../utils/CommonUtils";
import { shouldTestConnection } from "../../../utils/ServiceUtils";
import Loader from "../Loader/Loader";
import "./test-connection.style.less";
import { TestConnectionProps, TestStatus } from "./TestConnection.interface";
import TestConnectionModal from "./TestConnectionModal/TestConnectionModal";
import axios from "axios";
import { getAxiosErrorMessage } from "../../../utils/AxiosUtils";

const TestConnection: FC<TestConnectionProps> = ({
  isTestingDisabled,
  connectionType,

  onValidateFormRequiredFields,
  shouldValidateForm = true,
  showDetails = true,
}) => {
  const { t } = useTranslation();
  const { isAirflowAvailable } = useAirflowStatus();

  // local state
  const [isTestingConnection] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const [message] = useState<string>(TEST_CONNECTION_INITIAL_MESSAGE);

  const [testConnectionStep] = useState<TestConnectionStep[]>([]);

  const [testConnectionStepResult] = useState<TestConnectionStepResult[]>([]);

  const [currentWorkflow] = useState<Workflow>();
  const [testStatus] = useState<TestStatus>();

  const [progress] = useState<number>(TEST_CONNECTION_PROGRESS_PERCENTAGE.ZERO);

  const [isConnectionTimeout] = useState<boolean>(false);

  /**
   * Current workflow reference
   */
  const currentWorkflowRef = useRef(currentWorkflow);

  const allowTestConn = useMemo(() => {
    return shouldTestConnection(connectionType);
  }, [connectionType]);

  const isTestConnectionDisabled =
    isTestingConnection ||
    isTestingDisabled ||
    !allowTestConn;

  // handlers
  const testConnection = async () => {
    try {
      const response = await axios.post('/api/test', {
        "config": {
          "type": "Mysql",
          "scheme": "mysql+pymysql",
          "username": "openmetadata_user",
          "authType": {
            "password": "openmetadata_password"
          },
          "hostPort": "localhost:3306",
          "databaseName": "openmetadata",
          "supportsMetadataExtraction": true,
          "supportsDBTExtraction": true,
          "supportsProfiler": true,
          "supportsQueryComment": true
        }
      });

    } catch (error) {
      alert(getAxiosErrorMessage(error));
    }
  };

  const handleTestConnection = () => {
    if (shouldValidateForm) {
      const isFormValid =
        onValidateFormRequiredFields && onValidateFormRequiredFields();
      if (isFormValid) {
        testConnection();
      }
    } else {
      testConnection();
    }
  };

  useEffect(() => {
    currentWorkflowRef.current = currentWorkflow; // update ref with latest value of currentWorkflow state variable
  }, [currentWorkflow]);

  useEffect(() => {
    return () => {
      /**
       * if workflow is present then delete the workflow when component unmount
       */
      const workflowId = currentWorkflowRef.current?.id;
      if (workflowId) {
        // handleDeleteWorkflow(workflowId);
      }
    };
  }, []);

  // rendering

  return (
    <>
      {showDetails ? (
        <Space className="w-full justify-between bg-white border border-main rounded-4 p-sm mt-4">
          <Space
            align={testStatus ? "start" : "center"}
            data-testid="message-container"
            size={8}
          >
            {isTestingConnection && <Loader size="small" />}
            {testStatus === StatusType.Successful && (
              <SuccessIcon
                className="status-icon"
                data-testid="success-badge"
              />
            )}
            {testStatus === StatusType.Failed && (
              <FailIcon className="status-icon" data-testid="fail-badge" />
            )}
            {testStatus === "Warning" && (
              <WarningIcon
                className="status-icon"
                data-testid="warning-badge"
              />
            )}
            <div data-testid="messag-text">
              {(testStatus || isTestingConnection) && (
                <Transi18next
                  i18nKey="message.click-text-to-view-details"
                  renderElement={
                    <Button
                      className="p-0 test-connection-message-btn"
                      data-testid="test-connection-details-btn"
                      type="link"
                      onClick={() => setDialogOpen(true)}
                    />
                  }
                  values={{
                    text: t("label.here-lowercase"),
                  }}
                />
              )}
            </div>
          </Space>
          <Button
            className={classNames({
              "text-primary": !isTestConnectionDisabled,
            })}
            data-testid="test-connection-btn"
            disabled={isTestConnectionDisabled}
            loading={isTestingConnection}
            size="middle"
            type="default"
            onClick={handleTestConnection}
          >
            {t("label.test-entity", { entity: t("label.connection") })}
          </Button>
        </Space>
      ) : (
        <Button
          data-testid="test-connection-button"
          disabled={isTestConnectionDisabled}
          loading={isTestingConnection}
          type="primary"
          onClick={handleTestConnection}
        >
          {t("label.test-entity", {
            entity: t("label.connection"),
          })}
        </Button>
      )}
      <TestConnectionModal
        isConnectionTimeout={isConnectionTimeout}
        isOpen={dialogOpen}
        isTestingConnection={isTestingConnection}
        progress={progress}
        testConnectionStep={testConnectionStep}
        testConnectionStepResult={testConnectionStepResult}
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
        onTestConnection={handleTestConnection}
      />
    </>
  );
};

export default TestConnection;
