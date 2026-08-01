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

import { Divider, Space, Typography } from 'antd';
import { get, isEmpty, isObject, startCase, toString } from 'lodash';
import type { ReactNode } from 'react';
import { Fragment, lazy } from 'react';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import { VersionButton } from '../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { TabSpecificField } from '../enums/entity.enum';
import { EntityChangeOperations } from '../enums/VersionPage.enum';
import type {
  ChangeDescription,
  FieldChange,
} from '../generated/entity/services/databaseService';
import type { EntityReference } from '../generated/entity/type';
import type { TestCaseParameterValue } from '../generated/tests/testCase';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
} from './EntityDiffPureUtils';
import {
  getAddedDiffElement,
  getDiffDisplayValue,
  getRemovedDiffElement,
  getTextDiffElements,
} from './EntityDiffUtils';
import { getEntityName } from './EntityNameUtils';
import * as Pure from './EntityVersionUtilsPure';
import { t } from './i18next/LocalUtil';
import { isValidJSONString } from './StringUtils';

const BulkImportVersionSummary = withSuspenseFallback(
  lazy(() =>
    import(
      '../components/Entity/EntityVersionTimeLine/BulkImportVersionSummary/BulkImportVersionSummary.component'
    ).then((m) => ({ default: m.BulkImportVersionSummary }))
  )
);

const OwnerLabel = withSuspenseFallback(
  lazy(() =>
    import('../components/common/OwnerLabel/OwnerLabel.component').then(
      (m) => ({ default: m.OwnerLabel })
    )
  )
);

const getOwnerLabelName = (
  reviewer: EntityReference,
  operation: EntityChangeOperations
) => {
  switch (operation) {
    case EntityChangeOperations.ADDED:
      return getAddedDiffElement(getEntityName(reviewer));
    case EntityChangeOperations.DELETED:
      return getRemovedDiffElement(getEntityName(reviewer));
    case EntityChangeOperations.UPDATED:
    case EntityChangeOperations.NORMAL:
    default:
      return getEntityName(reviewer);
  }
};

const getBulkImportSummary = (fieldsUpdated: FieldChange[]) => {
  const bulkImportField = fieldsUpdated.find(
    (field) => field.name === 'bulkImport'
  );

  if (!bulkImportField) {
    return null;
  }

  let newValue: unknown = null;
  if (isObject(bulkImportField.newValue)) {
    newValue = bulkImportField.newValue;
  } else if (isValidJSONString(bulkImportField.newValue)) {
    newValue = JSON.parse(bulkImportField.newValue);
  }

  if (!newValue) {
    return null;
  }

  return <BulkImportVersionSummary csvImportResult={newValue} />;
};

export const getSummary = ({
  changeDescription,
  isPrefix = false,
  isGlossaryTerm = false,
}: {
  changeDescription: ChangeDescription;
  isPrefix?: boolean;
  isGlossaryTerm?: boolean;
}) => {
  const fieldsAdded = [...(changeDescription?.fieldsAdded ?? [])];
  const fieldsDeleted = [...(changeDescription?.fieldsDeleted ?? [])];
  const fieldsUpdated = [
    ...(changeDescription?.fieldsUpdated?.filter(
      (field) => field.name !== 'deleted'
    ) ?? []),
  ];
  const isDeleteUpdated = [
    ...(changeDescription?.fieldsUpdated?.filter(
      (field) => field.name === 'deleted'
    ) ?? []),
  ];

  const bulkImportSummary = getBulkImportSummary(fieldsUpdated);

  return (
    <Fragment>
      {isDeleteUpdated?.length > 0 ? (
        <Typography.Paragraph>
          {isDeleteUpdated
            .map((field) => {
              return field.newValue
                ? t('message.data-asset-has-been-action-type', {
                    actionType: t('label.deleted-lowercase'),
                  })
                : t('message.data-asset-has-been-action-type', {
                    actionType: t('label.restored-lowercase'),
                  });
            })
            .join(', ')}
        </Typography.Paragraph>
      ) : null}
      {fieldsAdded?.length > 0 ? (
        <Typography.Paragraph>
          {Pure.getSummaryText({
            isPrefix,
            fieldsChanged: fieldsAdded,
            actionType: t('label.added'),
            actionText: t('label.added-lowercase'),
          })}
        </Typography.Paragraph>
      ) : null}
      {fieldsUpdated?.length ? (
        <Typography.Paragraph>
          {bulkImportSummary ? (
            <>
              {t('message.bulk-import-completed')}
              {bulkImportSummary}
            </>
          ) : (
            Pure.getSummaryText({
              isPrefix,
              fieldsChanged: fieldsUpdated,
              actionType: t('label.edited'),
              actionText: t('label.updated-lowercase'),
              isGlossaryTerm,
            })
          )}
        </Typography.Paragraph>
      ) : null}
      {fieldsDeleted?.length ? (
        <Typography.Paragraph>
          {Pure.getSummaryText({
            isPrefix,
            fieldsChanged: fieldsDeleted,
            actionType: t('label.removed'),
            actionText: t('label.deleted-lowercase'),
          })}
        </Typography.Paragraph>
      ) : null}
    </Fragment>
  );
};

export const renderVersionButton = (
  version: string,
  current: string,
  versionHandler: (version: string) => void,
  className?: string
) => {
  const currV = JSON.parse(version);

  const majorVersionChecks = () => {
    return Pure.isMajorVersion(
      Number.parseFloat(currV?.changeDescription?.previousVersion)
        .toFixed(1)
        .toString(),
      Number.parseFloat(currV?.version).toFixed(1).toString()
    );
  };

  return (
    <Fragment key={currV.version}>
      <VersionButton
        className={className}
        isMajorVersion={majorVersionChecks()}
        selected={toString(currV.version) === current}
        version={currV}
        onVersionSelect={versionHandler}
      />
    </Fragment>
  );
};

export const getParameterValueDiffDisplay = (
  changeDescription: ChangeDescription,
  defaultValues?: TestCaseParameterValue[]
): React.ReactNode => {
  const diffs = Pure.getParameterValuesDiff(changeDescription, defaultValues);

  // Separate sqlExpression from other params
  const sqlParamDiff = diffs.find((diff) => diff.name === 'sqlExpression');
  const otherParamDiffs = diffs.filter((diff) => diff.name !== 'sqlExpression');

  return (
    <>
      {/* Render non-sqlExpression parameters as before */}
      <Space
        wrap
        className="parameter-value-container parameter-value"
        size={6}>
        {otherParamDiffs.length === 0 ? (
          <Typography.Text type="secondary">
            {t('label.no-parameter-available')}
          </Typography.Text>
        ) : (
          otherParamDiffs.map((diff, index) => (
            <Space data-testid={diff.name} key={diff.name} size={4}>
              <Typography.Text className="parameter-label">
                {`${diff.name}:`}
              </Typography.Text>
              <Typography.Text className="parameter-value-text">
                {getDiffDisplayValue(diff)}
              </Typography.Text>
              {otherParamDiffs.length - 1 !== index && (
                <Divider type="vertical" />
              )}
            </Space>
          ))
        )}
      </Space>
      {/* Render sqlExpression parameter separately, using inline diff in a code-style block */}
      {sqlParamDiff && (
        <div className="m-t-md">
          <Typography.Text className="right-panel-label">
            {startCase(sqlParamDiff.name)}
          </Typography.Text>

          <div className="m-t-sm version-sql-expression-container">
            {getDiffDisplayValue(sqlParamDiff)}
          </div>
        </div>
      )}
    </>
  );
};

export const getComputeRowCountDiffDisplay = (
  changeDescription: ChangeDescription,
  fallbackValue?: boolean
): React.ReactNode => {
  const fieldDiff = getDiffByFieldName(
    'computePassedFailedRowCount',
    changeDescription,
    true
  );
  const oldValue = getChangedEntityOldValue(fieldDiff);
  const newValue = getChangedEntityNewValue(fieldDiff);

  const isOldValueUndefined = oldValue === undefined;
  const isNewValueUndefined = newValue === undefined;

  // If there's no diff, return the fallback value as normal text
  if (isOldValueUndefined && isNewValueUndefined) {
    return toString(fallbackValue);
  }

  // If there's a diff, show the diff styling
  if (!isOldValueUndefined && !isNewValueUndefined) {
    // Field was updated
    return getTextDiffElements(toString(oldValue), toString(newValue));
  } else if (isOldValueUndefined && !isNewValueUndefined) {
    // Field was added
    return getAddedDiffElement(toString(newValue));
  } else if (!isOldValueUndefined && isNewValueUndefined) {
    // Field was deleted
    return getRemovedDiffElement(toString(oldValue));
  }

  // Fallback
  return toString(fallbackValue);
};

export const getOwnerVersionLabel = (
  entity: {
    [TabSpecificField.OWNERS]?: EntityReference[];
    changeDescription?: ChangeDescription;
  },
  isVersionView: boolean,
  ownerField = TabSpecificField.OWNERS, // Can be owners, experts, reviewers all are OwnerLabels
  hasPermission = true
) => {
  const defaultItems: EntityReference[] = get(entity, ownerField, []);

  if (isVersionView) {
    const { owners, ownerDisplayName } = Pure.getOwnerDiff(
      defaultItems,
      entity.changeDescription,
      ownerField
    );

    if (!isEmpty(owners)) {
      return <OwnerLabel ownerDisplayName={ownerDisplayName} owners={owners} />;
    }
  }

  if (defaultItems.length > 0) {
    const ownerDisplayName = new Map<string, ReactNode>();

    defaultItems.forEach((item: EntityReference) => {
      const displayName = getOwnerLabelName(
        item,
        EntityChangeOperations.NORMAL
      );
      if (item.name) {
        ownerDisplayName.set(item.name, displayName);
      }
    });

    return (
      <OwnerLabel
        ownerDisplayName={ownerDisplayName}
        owners={defaultItems}
        {...(ownerField === TabSpecificField.OWNERS
          ? {
              isCompactView: false,
              showLabel: false,
            }
          : {})}
      />
    );
  }

  return hasPermission ? null : <div>{NO_DATA_PLACEHOLDER}</div>;
};
