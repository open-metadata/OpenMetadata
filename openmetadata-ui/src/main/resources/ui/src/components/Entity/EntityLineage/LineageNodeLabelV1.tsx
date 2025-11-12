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

import { Button } from '@mui/material';
import { Col, Space, Typography } from 'antd';
import classNames from 'classnames';
import { capitalize, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactComponent as IconDBTModel } from '../../../assets/svg/dbt-model.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../../enums/entity.enum';
import { ModelType, Table } from '../../../generated/entity/data/table';
import { LineageLayer } from '../../../generated/settings/settings';
import {
  EntityReference,
  TestSummary,
} from '../../../generated/tests/testCase';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import { getEntityChildrenAndLabel } from '../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityTypeIcon, getServiceIcon } from '../../../utils/TableUtils';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import TestSuiteSummaryWidget from './TestSuiteSummaryWidget/TestSuiteSummaryWidget.component';

interface LineageNodeLabelProps {
  node: SourceType;
  isChildrenListExpanded?: boolean;
  toggleColumnsList?: () => void;
}

interface LineageNodeLabelPropsExtended
  extends Omit<LineageNodeLabelProps, 'node'> {
  node: LineageNodeLabelProps['node'] & {
    serviceType?: string;
    columnNames?: string[];
  };
}

const EntityLabel = ({ node }: LineageNodeLabelPropsExtended) => {
  const { showDeletedIcon, showDbtIcon } = useMemo(() => {
    return {
      showDbtIcon:
        node.entityType === EntityType.TABLE &&
        (node as Table)?.dataModel?.modelType === ModelType.Dbt &&
        (node as Table)?.dataModel?.resourceType?.toLowerCase() !== 'seed',
      showDeletedIcon: node.deleted ?? false,
    };
  }, [node]);

  return (
    <Col className="items-center entity-label-container">
      <Col className="d-flex items-center m-b-sm" flex="auto">
        <div className="d-flex entity-service-icon m-r-xs">
          {getServiceIcon(node)}
        </div>
        <Space align="start" direction="vertical" size={0}>
          <Space
            align="start"
            className="entity-header-name"
            direction="horizontal"
            size={6}>
            <Typography.Text className="m-b-0 d-flex text-left text-grey-muted node-service-type">
              {node.serviceType}
            </Typography.Text>
            {getEntityTypeIcon(node.entityType)}
            <Typography.Text className="m-b-0 d-flex text-left text-grey-muted node-entity-type">
              {capitalize(node.entityType)}
            </Typography.Text>
          </Space>
          <Typography.Text
            className="m-b-0 d-block text-left entity-header-display-name text-md font-medium w-54"
            data-testid="entity-header-display-name"
            ellipsis={{ tooltip: true }}>
            {getEntityName(node)}
          </Typography.Text>
        </Space>
        {!showDeletedIcon && showDbtIcon && (
          <div className="m-r-xs" data-testid="dbt-icon">
            <IconDBTModel />
          </div>
        )}
        {showDeletedIcon && (
          <div className="flex-center p-xss custom-node-deleted-icon">
            <div className="d-flex text-danger" data-testid="node-deleted-icon">
              <DeleteIcon height={16} width={16} />
            </div>
          </div>
        )}
      </Col>
    </Col>
  );
};

const TestSuiteSummaryContainer = ({ node }: LineageNodeLabelPropsExtended) => {
  const { entityType } = node;
  const [summary, setSummary] = useState<TestSummary>();
  const [isLoading, setIsLoading] = useState(true);

  const fetchTestSuiteSummary = async (testSuite: EntityReference) => {
    setIsLoading(true);
    try {
      const response = await getTestCaseExecutionSummary(testSuite.id);
      setSummary(response);
    } catch {
      setSummary(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  const { activeLayer } = useLineageProvider();

  const { showDataObservability } = useMemo(() => {
    return {
      showDataObservability: activeLayer.includes(
        LineageLayer.DataObservability
      ),
    };
  }, [activeLayer]);

  const showDataObservabilitySummary = useMemo(() => {
    return Boolean(
      showDataObservability &&
        entityType === EntityType.TABLE &&
        (node as Table).testSuite
    );
  }, [node, showDataObservability, entityType]);

  useEffect(() => {
    const testSuite = (node as Table)?.testSuite;
    if (showDataObservabilitySummary && testSuite && isUndefined(summary)) {
      fetchTestSuiteSummary(testSuite);
    } else {
      setIsLoading(false);
    }
  }, [node, showDataObservabilitySummary, summary]);

  return (
    showDataObservabilitySummary && (
      <TestSuiteSummaryWidget
        isLoading={isLoading}
        size="small"
        summary={summary}
      />
    )
  );
};

const EntityFooter = ({
  isChildrenListExpanded,
  node,
  toggleColumnsList,
}: LineageNodeLabelPropsExtended) => {
  const { children, childrenHeading } = useMemo(
    () => getEntityChildrenAndLabel(node),
    [node.id]
  );

  const childrenCount = children.length;

  const childrenInfoDropdownLabel = useMemo(
    () => `${childrenCount} ${childrenHeading}`,
    [childrenCount, childrenHeading]
  );

  const handleClickColumnInfoDropdown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleColumnsList?.();
    },
    [toggleColumnsList]
  );

  return (
    <div className="entity-footer">
      <Button
        className={classNames(
          'children-info-dropdown-label',
          isChildrenListExpanded ? 'expanded' : 'collapsed'
        )}
        variant="outlined"
        onClick={handleClickColumnInfoDropdown}>
        {childrenInfoDropdownLabel}
      </Button>
      <TestSuiteSummaryContainer node={node} />
    </div>
  );
};

const LineageNodeLabelV1 = ({
  node,
  isChildrenListExpanded,
  toggleColumnsList,
}: LineageNodeLabelProps) => {
  return (
    <div className="custom-node-label-container m-0">
      <EntityLabel node={node} />
      <EntityFooter
        isChildrenListExpanded={isChildrenListExpanded}
        node={node}
        toggleColumnsList={toggleColumnsList}
      />
    </div>
  );
};

export default LineageNodeLabelV1;
