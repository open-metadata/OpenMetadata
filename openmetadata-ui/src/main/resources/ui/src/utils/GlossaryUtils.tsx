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

import Icon from '@ant-design/icons';
import { Tag, Tooltip, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { lazy } from 'react';
import { ReactComponent as ExternalLinkIcon } from '../assets/svg/external-links.svg';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import { ModifiedGlossaryTerm } from '../components/Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import {
  ICON_DIMENSION,
  SUCCESS_COLOR,
  TEXT_BODY_COLOR,
  TEXT_GREY_MUTED,
} from '../constants/constants';
import { GlossaryTermDetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityType } from '../enums/entity.enum';
import { TermReference } from '../generated/entity/data/glossaryTerm';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getEntityName } from './EntityNameUtils';
import { VersionStatus } from './EntityVersionUtils.interface';

const CommonWidgets = withSuspenseFallback(
  lazy(() =>
    import('../components/DataAssets/CommonWidgets/CommonWidgets').then(
      (module) => ({ default: module.CommonWidgets })
    )
  )
);

const GlossaryTermTab = withSuspenseFallback(
  lazy(
    () =>
      import('../components/Glossary/GlossaryTermTab/GlossaryTermTab.component')
  )
);

export const convertGlossaryTermsToTreeOptions = (
  options: ModifiedGlossaryTerm[] = [],
  level = 0,
  allowParentSelection = false,
  parentMutuallyExclusive = false
): Omit<DefaultOptionType, 'label'>[] => {
  const treeData = options.map((option) => {
    const hasChildren = 'children' in option && !isEmpty(option?.children);

    // for 0th level we don't want check option to available
    const isGlossaryTerm = level !== 0;

    // Only include keys with no children or keys that are not expanded
    return {
      id: option.id,
      value: option.fullyQualifiedName,
      name: option.name,
      title: (
        <Typography.Text ellipsis style={{ color: option?.style?.color }}>
          {getEntityName(option)}
        </Typography.Text>
      ),
      'data-testid': `tag-${option.fullyQualifiedName}`,
      checkable: allowParentSelection || isGlossaryTerm,
      isLeaf: isGlossaryTerm ? !hasChildren : false,
      selectable: allowParentSelection || isGlossaryTerm,
      isParentMutuallyExclusive: parentMutuallyExclusive,
      children:
        hasChildren &&
        convertGlossaryTermsToTreeOptions(
          option.children as ModifiedGlossaryTerm[],
          level + 1,
          allowParentSelection,
          option.mutuallyExclusive === true
        ),
    };
  });

  return treeData;
};

export const renderReferenceElement = (
  ref: TermReference,
  versionStatus?: VersionStatus
) => {
  let iconColor: string;
  let textClassName: string;
  if (versionStatus?.added) {
    iconColor = SUCCESS_COLOR;
    textClassName = 'text-success';
  } else if (versionStatus?.removed) {
    iconColor = TEXT_GREY_MUTED;
    textClassName = 'text-grey-muted';
  } else {
    iconColor = TEXT_BODY_COLOR;
    textClassName = 'text-body';
  }

  return (
    <Tag
      className={classNames(
        'm-r-xs m-t-xs d-flex items-center term-reference-tag bg-white',
        { 'diff-added': versionStatus?.added },
        { 'diff-removed ': versionStatus?.removed }
      )}
      key={ref.name}>
      <Tooltip placement="bottomLeft" title={ref.name}>
        <a
          data-testid={`reference-link-${ref.name}`}
          href={ref?.endpoint}
          rel="noopener noreferrer"
          target="_blank">
          <div className="d-flex items-center">
            <Icon
              className="m-r-xss"
              component={ExternalLinkIcon}
              data-testid="external-link-icon"
              style={{ ...ICON_DIMENSION, color: iconColor }}
            />
            <span className={textClassName}>{ref.name}</span>
          </div>
        </a>
      </Tooltip>
    </Tag>
  );
};

export const getGlossaryWidgetFromKey = (widget: WidgetConfig) => {
  if (widget.i.startsWith(GlossaryTermDetailPageWidgetKeys.TERMS_TABLE)) {
    return <GlossaryTermTab isGlossary />;
  }

  return (
    <CommonWidgets
      showTaskHandler
      entityType={EntityType.GLOSSARY}
      widgetConfig={widget}
    />
  );
};
