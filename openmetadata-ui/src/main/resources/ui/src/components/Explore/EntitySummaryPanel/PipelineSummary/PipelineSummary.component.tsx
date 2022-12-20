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

import { Col, Divider, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SearchIndex } from '../../../../enums/search.enum';
import { Pipeline, Task } from '../../../../generated/entity/data/pipeline';
import SVGIcons from '../../../../utils/SvgUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import TableDataCardTitle from '../../../common/table-data-card-v2/TableDataCardTitle.component';
import SummaryList from '../SummaryList/SummaryList.component';

interface PipelineSummaryProps {
  entityDetails: Pipeline;
}

function PipelineSummary({ entityDetails }: PipelineSummaryProps) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>();

  const fetchTaskDetails = async () => {
    try {
      const updatedTasks = (entityDetails.tasks || []).map((task) => ({
        ...task,
        taskUrl: task.taskUrl,
      }));
      setTasks(updatedTasks);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.pipeline-detail-plural-lowercase'),
        })
      );
    }
  };

  useEffect(() => {
    fetchTaskDetails();
  }, [entityDetails]);

  return (
    <>
      <Row className="m-md" gutter={[0, 4]}>
        <Col span={24}>
          <TableDataCardTitle
            dataTestId="summary-panel-title"
            searchIndex={SearchIndex.PIPELINE}
            source={entityDetails}
          />
        </Col>
        <Col span={24}>
          <Row gutter={16}>
            <Col className="text-gray" span={10}>
              {`${t('label.pipeline')} ${t('label.url-uppercase')}`}
            </Col>
            <Col span={12}>
              <Link
                target="_blank"
                to={{ pathname: entityDetails.pipelineUrl }}>
                <Space align="start">
                  <Typography.Text className="link">
                    {entityDetails.name}
                  </Typography.Text>
                  <SVGIcons
                    alt="external-link"
                    icon="external-link"
                    width="12px"
                  />
                </Space>
              </Link>
            </Col>
          </Row>
        </Col>
      </Row>
      <Divider className="m-0" />
      <Row className="m-md" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text className="section-header">
            {t('label.tasks')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <SummaryList tasks={tasks || []} />
        </Col>
      </Row>
    </>
  );
}

export default PipelineSummary;
