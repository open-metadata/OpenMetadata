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
import { Button, Chip, IconButton, Tooltip } from '@mui/material';
import { Col, Space, Typography } from 'antd';
import classNames from 'classnames';
import { capitalize, isUndefined } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDBTModel } from '../../../assets/svg/dbt-model.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as FilterIcon } from '../../../assets/svg/ic-filter.svg';
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
import {
  getBreadcrumbsFromFqn,
  getEntityName,
} from '../../../utils/EntityUtils';
import { getEntityTypeIcon, getServiceIcon } from '../../../utils/TableUtils';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import TestSuiteSummaryWidget from './TestSuiteSummaryWidget/TestSuiteSummaryWidget.component';

interface LineageNodeLabelProps {
  node: SourceType;
  isChildrenListExpanded?: boolean;
  toggleColumnsList?: () => void;
  toggleOnlyShowColumnsWithLineageFilterActive?: () => void;
  isOnlyShowColumnsWithLineageFilterActive?: boolean;
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

  const { children } = useMemo(
    () => getEntityChildrenAndLabel(node),
    [node.id]
  );
  const childrenCount = children.length;
  const breadcrumbs = getBreadcrumbsFromFqn(node.fullyQualifiedName ?? '');

  return (
    <Col
      className={classNames(
        'items-center entity-label-container',
        childrenCount > 0 ? 'with-footer' : ''
      )}>
      <Col className="d-flex items-center m-b-sm" flex="auto">
        <div className="d-flex entity-service-icon m-r-xs">
          {getServiceIcon(node)}
        </div>
        <Space align="start" direction="vertical" size={0}>
          <Typography.Text
            className="m-b-0 d-block text-left entity-header-display-name text-md font-medium w-54"
            data-testid="entity-header-display-name"
            ellipsis={{ tooltip: true }}>
            {getEntityName(node)}
          </Typography.Text>

          <Space
            align="start"
            className="entity-header-name"
            direction="horizontal"
            size={6}>
            {breadcrumbs.length > 0 && (
              <div className="d-flex items-center m-b-xs lineage-breadcrumb">
                {breadcrumbs.map((breadcrumb, index) => (
                  <Fragment key={breadcrumb.name}>
                    <Typography.Text
                      className="text-grey-muted lineage-breadcrumb-item w-16"
                      ellipsis={{ tooltip: true }}>
                      {breadcrumb.name}
                    </Typography.Text>
                    {index !== breadcrumbs.length - 1 && (
                      <span className="lineage-breadcrumb-item-separator" />
                    )}
                  </Fragment>
                ))}
              </div>
            )}
          </Space>
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

const EntityTypeIcon = ({ entityType }: { entityType?: string }) => {
  return (
    <span style={{ width: '16px', height: '16px' }}>
      {getEntityTypeIcon(entityType)}
    </span>
  );
};

const EntityFooter = ({
  isChildrenListExpanded,
  node,
  toggleColumnsList,
  toggleOnlyShowColumnsWithLineageFilterActive,
  isOnlyShowColumnsWithLineageFilterActive,
}: LineageNodeLabelPropsExtended) => {
  const { t } = useTranslation();
  const { children, childrenHeading } = useMemo(
    () => getEntityChildrenAndLabel(node),
    [node.id]
  );
  const { isEditMode } = useLineageProvider();

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

  const handleOnlyShowColumnsWithLineage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleOnlyShowColumnsWithLineageFilterActive?.();
    },
    [toggleOnlyShowColumnsWithLineageFilterActive]
  );

  if (childrenCount === 0) {
    return null;
  }

  return (
    <div className="entity-footer">
      <div className="entity-footer__entity-type-and-dropdown">
        <Chip
          icon={<EntityTypeIcon entityType={node.entityType} />}
          label={capitalize(node.entityType)}
          sx={{
            '& .MuiChip-label': {
              marginLeft: 1.5,
            },
          }}
          variant="outlined"
        />
        <Button
          className={classNames(
            'children-info-dropdown-label',
            isChildrenListExpanded ? 'expanded' : 'collapsed'
          )}
          data-testid="children-info-dropdown-btn"
          variant="outlined"
          onClick={handleClickColumnInfoDropdown}>
          {childrenInfoDropdownLabel}
        </Button>
      </div>
      <div className="entity-footer__test-summary-and-filter">
        <TestSuiteSummaryContainer node={node} />
        <Tooltip
          placement="right"
          title={t('message.only-show-columns-with-lineage')}>
          <IconButton
            className={classNames(
              'only-show-columns-with-lineage-filter-button',
              isOnlyShowColumnsWithLineageFilterActive && 'active'
            )}
            data-testid="lineage-filter-button"
            disabled={isEditMode}
            onClick={handleOnlyShowColumnsWithLineage}>
            <FilterIcon height={20} width={20} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};

const LineageNodeLabelV1 = ({
  node,
  isChildrenListExpanded,
  toggleColumnsList,
  toggleOnlyShowColumnsWithLineageFilterActive,
  isOnlyShowColumnsWithLineageFilterActive,
}: LineageNodeLabelProps) => {
  return (
    <div className="custom-node-label-container m-0">
      <EntityLabel node={node} />
      <EntityFooter
        isChildrenListExpanded={isChildrenListExpanded}
        isOnlyShowColumnsWithLineageFilterActive={
          isOnlyShowColumnsWithLineageFilterActive
        }
        node={node}
        toggleColumnsList={toggleColumnsList}
        toggleOnlyShowColumnsWithLineageFilterActive={
          toggleOnlyShowColumnsWithLineageFilterActive
        }
      />
    </div>
  );
};

export default LineageNodeLabelV1;
