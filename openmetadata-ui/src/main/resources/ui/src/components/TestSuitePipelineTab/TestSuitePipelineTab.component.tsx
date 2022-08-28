import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Col, Table } from 'antd';
import cronstrue from 'cronstrue';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { fetchAirflowConfig } from '../../axiosAPIs/miscAPI';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PopOver from '../common/popover/PopOver';
import Loader from '../Loader/Loader';
import TestCaseCommonTabContainer from '../TestCaseCommonTabContainer/TestCaseCommonTabContainer.component';

const TestSuitePipelineTab = ({
  getAllIngestionWorkflows,
  testSuitePipelines,
}: {
  getAllIngestionWorkflows: (paging?: string) => void;
  testSuitePipelines: any; // type to be change after api update
}) => {
  const [airFlowEndPoint, setAirFlowEndPoint] = useState('');

  const fetchAirFlowEndPoint = async () => {
    try {
      const response = await fetchAirflowConfig();
      setAirFlowEndPoint(response.apiEndpoint);
    } catch {
      setAirFlowEndPoint('');
    }
  };

  const separator = (
    <span className="tw-inline-block tw-text-gray-400 tw-self-center">|</span>
  );

  const getTriggerDeployButton = (ingestion: IngestionPipeline) => {
    if (ingestion.deployed) {
      return (
        <Button
          data-testid="run"
          type="link"
          onClick={() => console.log('clicked')}>
          {false ? (
            'success' === 'success' ? (
              <FontAwesomeIcon icon="check" />
            ) : (
              <Loader size="small" type="default" />
            )
          ) : (
            'Run'
          )}
        </Button>
      );
    } else {
      return (
        <Button
          data-testid="deploy"
          type="link"
          onClick={() => console.log('clicked on Deploy')}>
          {false ? (
            'success' === 'success' ? (
              <FontAwesomeIcon icon="check" />
            ) : (
              <Loader size="small" type="default" />
            )
          ) : (
            'Deploy'
          )}
        </Button>
      );
    }
  };

  const pipelineColumns = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        render: () => {
          return (
            <>
              <NonAdminAction
                position="bottom"
                title={TITLE_FOR_NON_ADMIN_ACTION}>
                <a
                  className="link-text tw-mr-2"
                  data-testid="airflow-tree-view"
                  href={`${airFlowEndPoint}`}
                  rel="noopener noreferrer"
                  target="_blank">
                  Hello
                  <SVGIcons
                    alt="external-link"
                    className="tw-align-middle tw-ml-1"
                    icon={Icons.EXTERNAL_LINK}
                    width="16px"
                  />
                </a>
              </NonAdminAction>
            </>
          );
        },
      },
      {
        title: 'Type',
        dataIndex: 'pipelineType',
        key: 'pipelineType',
      },
      {
        title: 'Schedule',
        dataIndex: 'airflowConfig',
        key: 'airflowEndpoint',
        render: (_: Array<unknown>, record: any) => {
          return (
            <>
              {record?.scheduleInterval ? (
                <PopOver
                  html={
                    <div>
                      {cronstrue.toString(record?.scheduleInterval || '', {
                        use24HourTimeFormat: true,
                        verbose: true,
                      })}
                    </div>
                  }
                  position="bottom"
                  theme="light"
                  trigger="mouseenter">
                  <span>{record?.scheduleInterval ?? '--'}</span>
                </PopOver>
              ) : (
                <span>--</span>
              )}
            </>
          );
        },
      },
      {
        title: 'Recent Runs',
        dataIndex: 'recentRuns',
        key: 'recentRuns',
        render: () => <>Status</>, // use getIngestionStatuses from commonUtils
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        key: 'actions',
        render: (_: Array<unknown>, record: any) => {
          return (
            <>
              <NonAdminAction
                position="bottom"
                title={TITLE_FOR_NON_ADMIN_ACTION}>
                <div className="tw-flex">
                  {true ? (
                    <Fragment>
                      {getTriggerDeployButton({
                        // need to pass proper props after api call
                        deployed: true,
                        name: 'ingestion-tets',
                        airflowConfig: undefined,
                        openMetadataServerConnection: undefined,
                        pipelineType:
                          '/Users/bharatdussa/Desktop/projects/OpenMetadata/openmetadata-ui/src/main/resources/ui/src/generated/entity/services/ingestionPipelines/ingestionPipeline'
                            .Lineage,
                        sourceConfig: undefined,
                      })}
                      {separator}
                      <Button data-testid="pause" disabled={!true} type="link">
                        Pause
                      </Button>
                    </Fragment>
                  ) : (
                    <Button data-testid="unpause" disabled={!true} type="link">
                      Unpause
                    </Button>
                  )}
                  {separator}
                  <Button
                    data-testid="edit"
                    disabled={!true}
                    type="link"
                    onClick={() => console.log('edit')}>
                    Edit
                  </Button>
                  {separator}
                  <Button data-testid="delete" type="link">
                    {false ? (
                      true ? ( // in place of false check of id and in place of true check for success state
                        <FontAwesomeIcon icon="check" />
                      ) : (
                        <Loader size="small" type="default" />
                      )
                    ) : (
                      'Delete'
                    )}
                  </Button>
                  {separator}
                  <Button data-testid="kill" disabled={!true} type="link">
                    Kill
                  </Button>
                  {separator}
                  <Button data-testid="logs" disabled={!true} type="link">
                    Logs
                  </Button>
                </div>
              </NonAdminAction>
            </>
          );
        },
      },
    ],
    [airFlowEndPoint]
  );

  useEffect(() => {
    getAllIngestionWorkflows();
    fetchAirFlowEndPoint();
  }, []);

  return (
    <TestCaseCommonTabContainer buttonName="Add Ingestion">
      <>
        <Col span={24}>
          <Table
            columns={pipelineColumns}
            dataSource={testSuitePipelines}
            pagination={false}
            size="small"
          />
        </Col>
      </>
    </TestCaseCommonTabContainer>
  );
};

export default TestSuitePipelineTab;
