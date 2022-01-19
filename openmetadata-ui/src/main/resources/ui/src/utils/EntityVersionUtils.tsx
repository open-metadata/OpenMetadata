/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { diffArrays, diffWordsWithSpace } from 'diff';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
import React, { Fragment } from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown, { PluggableList } from 'react-markdown';
import { Link } from 'react-router-dom';
import rehypeRaw from 'rehype-raw';
import gfm from 'remark-gfm';
import { DESCRIPTIONLENGTH, getTeamDetailsPath } from '../constants/constants';
import { ChangeType } from '../enums/entity.enum';
import { Column } from '../generated/entity/data/table';
import {
  ChangeDescription,
  FieldChange,
} from '../generated/entity/services/databaseService';
import { TagLabel } from '../generated/type/tagLabel';
import { isValidJSONString } from './StringsUtils';
import { getEntityLink, getOwnerFromId } from './TableUtils';

/* eslint-disable */
const parseMarkdown = (
  content: string,
  className: string,
  isNewLine: boolean
) => {
  return (
    <ReactMarkdown
      children={content
        .replaceAll(/&lt;/g, '<')
        .replaceAll(/&gt;/g, '>')
        .replaceAll('\\', '')}
      components={{
        h1: 'p',
        h2: 'p',
        h3: 'p',
        h4: 'p',
        h5: 'p',
        h6: 'p',
        p: ({ node, children, ...props }) => {
          return (
            <>
              {isNewLine ? (
                <p className={className} {...props}>
                  {children}
                </p>
              ) : (
                <span className={className} {...props}>
                  {children}
                </span>
              )}
            </>
          );
        },
        ul: ({ node, children, ...props }) => {
          const { ordered: _ordered, ...rest } = props;

          return (
            <ul className={className} style={{ marginLeft: '16px' }} {...rest}>
              {children}
            </ul>
          );
        },
      }}
      rehypePlugins={[[rehypeRaw, { allowDangerousHtml: false }]]}
      remarkPlugins={[gfm] as unknown as PluggableList | undefined}
    />
  );
};

export const getDiffByFieldName = (
  name: string,
  changeDescription: ChangeDescription,
  exactMatch?: boolean
): {
  added: FieldChange | undefined;
  deleted: FieldChange | undefined;
  updated: FieldChange | undefined;
} => {
  const fieldsAdded = changeDescription?.fieldsAdded || [];
  const fieldsDeleted = changeDescription?.fieldsDeleted || [];
  const fieldsUpdated = changeDescription?.fieldsUpdated || [];
  if (exactMatch) {
    return {
      added: fieldsAdded.find((ch) => ch.name === name),
      deleted: fieldsDeleted.find((ch) => ch.name === name),
      updated: fieldsUpdated.find((ch) => ch.name === name),
    };
  } else {
    return {
      added: fieldsAdded.find((ch) => ch.name?.startsWith(name)),
      deleted: fieldsDeleted.find((ch) => ch.name?.startsWith(name)),
      updated: fieldsUpdated.find((ch) => ch.name?.startsWith(name)),
    };
  }
};

export const getDiffValue = (oldValue: string, newValue: string) => {
  const diff = diffWordsWithSpace(oldValue, newValue);

  return diff.map((part: any, index: any) => {
    return (
      <span
        className={classNames(
          { 'diff-added': part.added },
          { 'diff-removed': part.removed }
        )}
        key={index}>
        {part.value}
      </span>
    );
  });
};

export const getDescriptionDiff = (
  oldDescription: string | undefined,
  newDescription: string | undefined,
  latestDescription: string | undefined
) => {
  if (!isUndefined(newDescription) || !isUndefined(oldDescription)) {
    const diff = diffWordsWithSpace(oldDescription ?? '', newDescription ?? '');

    const result: Array<string> = diff.map((part: any, index: any) => {
      const classes = classNames(
        { 'diff-added': part.added },
        { 'diff-removed': part.removed }
      );

      return ReactDOMServer.renderToString(
        <span key={index}>
          {parseMarkdown(
            part.value,
            classes,
            part.value?.startsWith('\n\n') || part.value?.includes('\n\n')
          )}
        </span>
      );
    });

    return result.join('');
  } else {
    return latestDescription || '';
  }
};

export const getTagsDiff = (
  oldTagList: Array<TagLabel>,
  newTagList: Array<TagLabel>
) => {
  const tagDiff = diffArrays(oldTagList, newTagList);
  const result = tagDiff

    .map((part: any) =>
      (part.value as Array<TagLabel>).map((tag) => ({
        ...tag,
        added: part.added,
        removed: part.removed,
      }))
    )
    ?.flat(Infinity);

  return result;
};

export const getPreposition = (type: ChangeType) => {
  switch (type) {
    case 'Added':
      return 'to';

    case 'Removed':
      return 'from';

    case 'Updated':
      return 'of';

    default:
      return '';
  }
};

const getColumnName = (column: string) => {
  const name = column.split('.');
  const length = name.length;
  return name
    .slice(length > 1 ? 1 : 0, length > 1 ? length - 1 : length)
    .join('.');
};

const getLinkWithColumn = (column: string, eFqn: string, eType: string) => {
  return (
    <Link
      className="tw-pl-1"
      to={`${getEntityLink(eType, eFqn)}.${getColumnName(column)}`}>
      {getColumnName(column)}
    </Link>
  );
};

const getDescriptionText = (value: string) => {
  const length = value.length;
  return `${value.slice(0, DESCRIPTIONLENGTH)}${
    length > DESCRIPTIONLENGTH ? '...' : ''
  }`;
};

const getDescriptionElement = (fieldChange: FieldChange) => {
  return fieldChange?.newValue && fieldChange?.oldValue ? (
    <Fragment>
      &nbsp;
      <span className="tw-italic feed-change-description">{`${getDescriptionText(
        fieldChange?.newValue
      )}`}</span>
    </Fragment>
  ) : fieldChange?.newValue ? (
    <Fragment>
      &nbsp;
      <span className="tw-italic feed-change-description">
        {`${getDescriptionText(fieldChange?.newValue)}`}
      </span>
    </Fragment>
  ) : (
    <Fragment>
      &nbsp;
      <span className="tw-italic feed-change-description">
        {`${getDescriptionText(fieldChange?.oldValue)}`}
      </span>
    </Fragment>
  );
};

const getOwnerName = (id: string) => {
  return getOwnerFromId(id)?.displayName || getOwnerFromId(id)?.name || '';
};

export const feedSummaryFromatter = (
  fieldChange: FieldChange,
  type: ChangeType,
  _entityName: string,
  entityType: string,
  entityFQN: string
) => {
  const value = JSON.parse(
    isValidJSONString(fieldChange?.newValue)
      ? fieldChange?.newValue
      : isValidJSONString(fieldChange?.oldValue)
      ? fieldChange?.oldValue
      : '{}'
  );
  const oldValue = JSON.parse(
    isValidJSONString(fieldChange?.oldValue) ? fieldChange?.oldValue : '{}'
  );
  const newValue = JSON.parse(
    isValidJSONString(fieldChange?.newValue) ? fieldChange?.newValue : '{}'
  );
  let summary: JSX.Element;
  switch (true) {
    case fieldChange?.name?.startsWith('column'): {
      if (fieldChange?.name?.endsWith('tags')) {
        summary = (
          <p key={uniqueId()}>
            {`${type} tags ${value
              ?.map((val: any) => val?.tagFQN)
              ?.join(', ')} ${getPreposition(type)} column`}
            {getLinkWithColumn(
              fieldChange?.name as string,
              entityFQN,
              entityType
            )}
          </p>
        );

        break;
      } else if (fieldChange?.name?.endsWith('description')) {
        summary = (
          <p key={uniqueId()}>
            {`${
              fieldChange?.newValue && fieldChange?.oldValue
                ? type
                : fieldChange?.newValue
                ? 'Added'
                : 'Removed'
            } column description for`}
            {getLinkWithColumn(
              fieldChange?.name as string,
              entityFQN,
              entityType
            )}
            {isEmpty(value) ? getDescriptionElement(fieldChange) : ''}
          </p>
        );

        break;
      } else if (fieldChange?.name === 'columns') {
        const length = value?.length ?? 0;
        summary = (
          <p key={uniqueId()}>
            {`${type} ${fieldChange?.name}`}{' '}
            {value?.map((column: Column, i: number) => (
              <span key={uniqueId()}>
                {getLinkWithColumn(column.name, entityFQN, entityType)}{' '}
                {i !== length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        );

        break;
      } else {
        summary = (
          <p key={uniqueId()}>
            {`${type}`}
            {getLinkWithColumn(
              fieldChange?.name as string,
              entityFQN,
              entityType
            )}
          </p>
        );

        break;
      }
    }

    case fieldChange?.name === 'tags': {
      const tier = value?.find((t: any) => t?.tagFQN?.startsWith('Tier'));
      const tags = value?.filter((t: any) => !t?.tagFQN?.startsWith('Tier'));
      summary = (
        <div>
          {tags?.length > 0 ? (
            <p key={uniqueId()}>{`${type} tags ${tags
              ?.map((val: any) => val?.tagFQN)
              ?.join(', ')}`}</p>
          ) : null}
          {tier ? (
            <p key={uniqueId()}>{`${type} tier ${
              tier?.tagFQN?.split('.')[1]
            }`}</p>
          ) : null}
        </div>
      );

      break;
    }

    case fieldChange?.name === 'owner': {
      const ownerName =
        getOwnerName(newValue?.id as string) ||
        getOwnerName(value?.id as string);
      const ownerText =
        !isEmpty(oldValue) && !isEmpty(newValue) ? (
          <Fragment>
            {newValue?.type === 'team' ? (
              <Link
                className="tw-pl-1"
                to={getTeamDetailsPath(newValue?.name || '')}>
                <span title={ownerName}>{ownerName}</span>
              </Link>
            ) : (
              <span className="tw-pl-1" title={ownerName}>
                {ownerName}
              </span>
            )}
          </Fragment>
        ) : (
          <Fragment>
            {value?.type === 'team' ? (
              <Link
                className="tw-pl-1"
                to={getTeamDetailsPath(value?.name || '')}>
                <span title={ownerName}>{ownerName}</span>
              </Link>
            ) : (
              <span className="tw-pl-1" title={ownerName}>
                {ownerName}
              </span>
            )}
          </Fragment>
        );
      summary = (
        <p
          className={classNames('tw-truncate', {
            'tw-w-52': ownerName.length > 32,
          })}
          key={uniqueId()}>
          {`Assigned ownership to`}
          {ownerText}
        </p>
      );

      break;
    }

    case fieldChange?.name === 'description': {
      summary = (
        <p key={uniqueId()}>
          {`${
            fieldChange?.newValue && fieldChange?.oldValue
              ? type
              : fieldChange?.newValue
              ? 'Added'
              : 'Removed'
          } description`}
          {getDescriptionElement(fieldChange)}
        </p>
      );

      break;
    }

    case fieldChange?.name === 'followers': {
      summary = (
        <p key={uniqueId()}>{`${
          fieldChange?.newValue ? 'Started following' : 'Unfollowed'
        } ${_entityName}`}</p>
      );

      break;
    }

    default:
      summary = <p key={uniqueId()}>{`${type} ${fieldChange?.name}`}</p>;

      break;
  }
  return summary;
};

export const getFeedSummary = (
  changeDescription: ChangeDescription,
  entityName: string,
  entityType: string,
  entityFQN: string
) => {
  const fieldsAdded = [...(changeDescription?.fieldsAdded || [])];
  const fieldsDeleted = [...(changeDescription?.fieldsDeleted || [])];
  const fieldsUpdated = [...(changeDescription?.fieldsUpdated || [])];

  return (
    <Fragment>
      {fieldsDeleted?.length ? (
        <div className="tw-mb-2">
          {fieldsDeleted?.map((d) => (
            <Fragment key={uniqueId()}>
              {feedSummaryFromatter(
                d,
                ChangeType.REMOVED,
                entityName,
                entityType,
                entityFQN
              )}
            </Fragment>
          ))}
        </div>
      ) : null}
      {fieldsAdded?.length > 0 ? (
        <div className="tw-mb-2">
          {fieldsAdded?.map((a) => (
            <Fragment key={uniqueId()}>
              {feedSummaryFromatter(
                a,
                ChangeType.ADDED,
                entityName,
                entityType,
                entityFQN
              )}
            </Fragment>
          ))}
        </div>
      ) : null}
      {fieldsUpdated?.length ? (
        <div className="tw-mb-2">
          {fieldsUpdated?.map((u) => (
            <Fragment key={uniqueId()}>
              {feedSummaryFromatter(
                u,
                ChangeType.UPDATED,
                entityName,
                entityType,
                entityFQN
              )}
            </Fragment>
          ))}
        </div>
      ) : null}
    </Fragment>
  );
};

export const summaryFormatter = (fieldChange: FieldChange) => {
  const value = JSON.parse(
    isValidJSONString(fieldChange?.newValue)
      ? fieldChange?.newValue
      : isValidJSONString(fieldChange?.oldValue)
      ? fieldChange?.oldValue
      : '{}'
  );
  if (fieldChange.name === 'columns') {
    return `columns ${value?.map((val: any) => val?.name).join(', ')}`;
  } else if (
    fieldChange.name === 'tags' ||
    fieldChange.name?.endsWith('tags')
  ) {
    return `tags ${value?.map((val: any) => val?.tagFQN)?.join(', ')}`;
  } else if (fieldChange.name === 'owner') {
    return `${fieldChange.name} ${value.name}`;
  } else {
    return fieldChange.name;
  }
};

export const getSummary = (
  changeDescription: ChangeDescription,
  isPrefix = false
) => {
  const fieldsAdded = [...(changeDescription?.fieldsAdded || [])];
  const fieldsDeleted = [...(changeDescription?.fieldsDeleted || [])];
  const fieldsUpdated = [...(changeDescription?.fieldsUpdated || [])];

  return (
    <Fragment>
      {fieldsAdded?.length > 0 ? (
        <p className="tw-mb-2">
          {`${isPrefix ? '+ Added' : ''} ${fieldsAdded
            ?.map(summaryFormatter)
            .join(', ')} ${!isPrefix ? `has been added` : ''}`}{' '}
        </p>
      ) : null}
      {fieldsUpdated?.length ? (
        <p className="tw-mb-2">
          {`${isPrefix ? 'Edited' : ''} ${fieldsUpdated
            ?.map(summaryFormatter)
            .join(', ')} ${!isPrefix ? `has been updated` : ''}`}{' '}
        </p>
      ) : null}
      {fieldsDeleted?.length ? (
        <p className="tw-mb-2">
          {`${isPrefix ? '- Removed' : ''} ${fieldsDeleted
            ?.map(summaryFormatter)
            .join(', ')} ${!isPrefix ? `has been Deleted` : ''}`}{' '}
        </p>
      ) : null}
    </Fragment>
  );
};

export const isMajorVersion = (version1: string, version2: string) => {
  const v1 = parseFloat(version1);
  const v2 = parseFloat(version2);
  const flag = !isNaN(v1) && !isNaN(v2);
  if (flag) {
    return v1 + 1 === v2;
  }

  return flag;
};
