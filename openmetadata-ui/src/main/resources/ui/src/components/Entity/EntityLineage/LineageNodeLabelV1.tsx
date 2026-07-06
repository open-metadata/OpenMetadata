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
import {
  BadgeWithIcon,
  Box,
  Breadcrumbs,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { capitalize, isUndefined } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDBTModel } from '../../../assets/svg/dbt-model.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as FilterIcon } from '../../../assets/svg/ic-filter.svg';
import { EntityType } from '../../../enums/entity.enum';
import { ModelType, Table } from '../../../generated/entity/data/table';
import {
  EntityReference,
  TestSummary,
} from '../../../generated/tests/testCase';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import { getEntityBreadcrumbs } from '../../../utils/EntityBreadcrumbPureUtils';
import { getEntityChildrenAndLabel } from '../../../utils/EntityLineageNodeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityIcon, getServiceIcon } from '../../../utils/TableUtils';
import { LineageNodeType } from '../../Lineage/Lineage.interface';
import TestSuiteSummaryWidget from './TestSuiteSummaryWidget/TestSuiteSummaryWidget.component';

interface LineageNodeLabelProps {
  node: LineageNodeType;
  isChildrenListExpanded?: boolean;
  toggleColumnsList?: () => void;
  toggleOnlyShowColumnsWithLineageFilterActive?: () => void;
  isOnlyShowColumnsWithLineageFilterActive?: boolean;
}

const EntityLabel = ({ node }: Pick<LineageNodeLabelProps, 'node'>) => {
  const { showDeletedIcon, showDbtIcon } = useMemo(() => {
    return {
      showDbtIcon:
        node.entityType === EntityType.TABLE &&
        (node as Table)?.dataModel?.modelType === ModelType.Dbt &&
        (node as Table)?.dataModel?.resourceType?.toLowerCase() !== 'seed',
      showDeletedIcon: node.deleted ?? false,
    };
  }, [node]);

  const { childrenCount } = useMemo(
    () => getEntityChildrenAndLabel(node),
    [node.id]
  );

  const breadcrumbItems = useMemo(
    () =>
      getEntityBreadcrumbs(
        node as unknown as Table,
        node.entityType as EntityType,
        false
      ).map((breadcrumb, index) => ({
        id: `${index}-${breadcrumb.name}`,
        label: (
          <span className="lineage-breadcrumb-item">{breadcrumb.name}</span>
        ),
      })),
    [node]
  );
  const serviceSubtitle = useMemo(
    () => (breadcrumbItems.length === 0 ? node.serviceType : undefined),
    [breadcrumbItems.length, node.serviceType]
  );
  const subtitle = node.lineageMapSubtitle ?? serviceSubtitle;

  const entityName = getEntityName(node);

  return (
    <div
      className={classNames(
        'items-center entity-label-container',
        childrenCount > 0 ? 'with-footer' : ''
      )}>
      <div className="d-flex items-center flex-auto">
        {!node.isTempTable && (
          <div className="d-flex entity-service-icon m-r-xs">
            {getServiceIcon(node)}
          </div>
        )}
        <Box className="flex-1 tw:min-w-0" direction="col">
          <Typography
            ellipsis
            as="span"
            className="m-b-0 d-block text-left entity-header-display-name w-54"
            data-testid="entity-header-display-name"
            size="text-md"
            title={entityName}
            weight="medium">
            {entityName}
          </Typography>

          {subtitle ? (
            <Typography.Text className="lineage-service-subtitle">
              {subtitle}
            </Typography.Text>
          ) : breadcrumbItems.length > 0 ? (
            <Breadcrumbs
              autoCollapse
              className="m-b-xs lineage-breadcrumbs"
              data-testid="lineage-breadcrumbs"
              items={breadcrumbItems}
              size="xs"
            />
          ) : null}
        </Box>
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
      </div>
    </div>
  );
};

const TestSuiteSummaryContainer = ({ node }: LineageNodeLabelProps) => {
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

  const { isDQEnabled } = useLineageStore();

  const showDataObservabilitySummary = useMemo(() => {
    return Boolean(
      isDQEnabled &&
        entityType === EntityType.TABLE &&
        (node as Table).testSuite
    );
  }, [node, isDQEnabled, entityType]);

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

const EntityTypeIcon = memo(
  ({ entityType, className }: { entityType?: string; className?: string }) => {
    return (
      <>{getEntityIcon(entityType ?? '', classNames('w-4 h-4', className))}</>
    );
  }
);

const EntityFooter = ({
  isChildrenListExpanded,
  node,
  toggleColumnsList,
  toggleOnlyShowColumnsWithLineageFilterActive,
  isOnlyShowColumnsWithLineageFilterActive,
}: LineageNodeLabelProps) => {
  const { t } = useTranslation();
  const { isEditMode } = useLineageStore();
  const { childrenHeading, childrenCount } = useMemo(
    () => getEntityChildrenAndLabel(node),
    [node.id]
  );

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

  const renderEntityTypeIcon = useCallback(
    (props: { className?: string }) => (
      <EntityTypeIcon
        className={props.className}
        entityType={node.entityType}
      />
    ),
    [node.entityType]
  );

  if (childrenCount === 0) {
    return null;
  }

  return (
    <div className="entity-footer">
      <div className="entity-footer__entity-type-and-dropdown">
        <BadgeWithIcon
          color="gray"
          iconLeading={renderEntityTypeIcon}
          size="md"
          type="color">
          {capitalize(node.entityType)}
        </BadgeWithIcon>
        <Button
          className={classNames(
            'children-info-dropdown-label',
            isChildrenListExpanded ? 'expanded' : 'collapsed'
          )}
          color="tertiary"
          data-testid="children-info-dropdown-btn"
          size="sm"
          onClick={handleClickColumnInfoDropdown}>
          {childrenInfoDropdownLabel}
        </Button>
      </div>
      <div className="entity-footer__test-summary-and-filter">
        <TestSuiteSummaryContainer node={node} />
        <ButtonUtility
          className={classNames(
            'only-show-columns-with-lineage-filter-button',
            isOnlyShowColumnsWithLineageFilterActive && 'active'
          )}
          color="tertiary"
          data-testid="lineage-filter-button"
          icon={FilterIcon}
          isDisabled={isEditMode}
          tooltip={t('message.only-show-columns-with-lineage')}
          tooltipPlacement="right"
          onClick={handleOnlyShowColumnsWithLineage}
        />
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
