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
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import rehypeRaw from 'rehype-raw';
import gfm from 'remark-gfm';
import { DESCRIPTIONLENGTH, getTeamDetailsPath } from '../constants/constants';
import { ChangeType } from '../enums/entity.enum';
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
      remarkPlugins={[gfm]}
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
  return name.slice(1, name.length - 1).join('.');
};

const getLinkWithColumn = (column: string, eFqn: string, eType: string) => {
  const name = column.split('.');
  return (
    <Link
      className="tw-pl-1"
      to={`${getEntityLink(eType, eFqn)}.${name
        .slice(1, name.length - 1)
        .join('.')}`}>
      {getColumnName(column)}
    </Link>
  );
};

const getDescriptionText = (v: string) => {
  const length = v.length;
  return `${v.slice(0, DESCRIPTIONLENGTH)}${
    length > DESCRIPTIONLENGTH ? '...' : ''
  }`;
};

const getDescriptionElement = (v: FieldChange) => {
  return v?.newValue && v?.oldValue ? (
    <Fragment>
      &nbsp;
      <span className="tw-italic feed-change-description">{`${getDescriptionText(
        v?.newValue
      )}`}</span>
    </Fragment>
  ) : v?.newValue ? (
    <Fragment>
      &nbsp;
      <span className="tw-italic feed-change-description">
        {`${getDescriptionText(v?.newValue)}`}
      </span>
    </Fragment>
  ) : (
    <Fragment>
      &nbsp;
      <span className="tw-italic feed-change-description">
        {`${getDescriptionText(v?.oldValue)}`}
      </span>
    </Fragment>
  );
};

const getOwnerName = (id: string) => {
  return getOwnerFromId(id)?.displayName || getOwnerFromId(id)?.name || '';
};

export const feedSummaryFromatter = (
  v: FieldChange,
  type: ChangeType,
  _entityName: string,
  entityType: string,
  entityFQN: string
) => {
  const value = JSON.parse(
    isValidJSONString(v?.newValue)
      ? v?.newValue
      : isValidJSONString(v?.oldValue)
      ? v?.oldValue
      : '{}'
  );
  const oldValue = JSON.parse(
    isValidJSONString(v?.oldValue) ? v?.oldValue : '{}'
  );
  const newValue = JSON.parse(
    isValidJSONString(v?.newValue) ? v?.newValue : '{}'
  );
  switch (true) {
    case v?.name?.startsWith('column'): {
      if (v?.name?.endsWith('tags')) {
        return (
          <p key={uniqueId()}>
            {`${type} tags ${value
              ?.map((val: any) => val?.tagFQN)
              ?.join(', ')} ${getPreposition(type)}`}
            {getLinkWithColumn(v?.name as string, entityFQN, entityType)}
          </p>
        );
      } else if (v?.name?.endsWith('description')) {
        return (
          <p key={uniqueId()}>
            {`${
              v?.newValue && v?.oldValue
                ? type
                : v?.newValue
                ? 'Added'
                : 'Removed'
            } column description for`}
            {getLinkWithColumn(v?.name as string, entityFQN, entityType)}
            {isEmpty(value) ? getDescriptionElement(v) : ''}
          </p>
        );
      } else {
        return (
          <p key={uniqueId()}>
            {`${type}`}
            {getLinkWithColumn(v?.name as string, entityFQN, entityType)}
          </p>
        );
      }
    }

    case v?.name === 'tags':
      const tier = value?.find((t: any) => t?.tagFQN?.startsWith('Tier'));
      const tags = value?.filter((t: any) => !t?.tagFQN?.startsWith('Tier'));
      return (
        <div>
          {tags?.length > 0 ? (
            <p key={uniqueId()}>{`${type} tags ${tags
              ?.map((val: any) => val?.tagFQN)
              ?.join(', ')}`}</p>
          ) : null}
          {tier ? (
            <p key={uniqueId()}>{`${type} tier ${tier?.tagFQN}`}</p>
          ) : null}
        </div>
      );

    case v?.name === 'owner':
      const ownerText =
        !isEmpty(oldValue) && !isEmpty(newValue) ? (
          <Fragment>
            <span className="tw-pl-1">to</span>
            {newValue?.type === 'team' ? (
              <Link
                className="tw-pl-1"
                to={getTeamDetailsPath(newValue?.name || '')}>
                {getOwnerName(newValue?.id as string)}
              </Link>
            ) : (
              <span className="tw-pl-1">
                {getOwnerName(newValue?.id as string)}
              </span>
            )}
          </Fragment>
        ) : (
          <Fragment>
            {value?.type === 'team' ? (
              <Link
                className="tw-pl-1"
                to={getTeamDetailsPath(value?.name || '')}>
                {getOwnerName(value?.id as string)}
              </Link>
            ) : (
              <span className="tw-pl-1">
                {getOwnerName(value?.id as string)}
              </span>
            )}
          </Fragment>
        );
      return (
        <p key={uniqueId()}>
          {`${type} ${v?.name}`}
          {ownerText}
        </p>
      );
    case v?.name === 'description':
      return (
        <p key={uniqueId()}>
          {`${
            v?.newValue && v?.oldValue
              ? type
              : v?.newValue
              ? 'Added'
              : 'Removed'
          } description`}
          {getDescriptionElement(v)}
        </p>
      );

    default:
      return <p key={uniqueId()}>{`${type} ${v?.name}`}</p>;
  }
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
    </Fragment>
  );
};

export const summaryFormatter = (v: FieldChange) => {
  const value = JSON.parse(
    isValidJSONString(v?.newValue)
      ? v?.newValue
      : isValidJSONString(v?.oldValue)
      ? v?.oldValue
      : '{}'
  );
  if (v.name === 'columns') {
    return `columns ${value?.map((val: any) => val?.name).join(', ')}`;
  } else if (v.name === 'tags' || v.name?.endsWith('tags')) {
    return `tags ${value?.map((val: any) => val?.tagFQN)?.join(', ')}`;
  } else if (v.name === 'owner') {
    return `${v.name} ${value.name}`;
  } else {
    return v.name;
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

export const isMajorVersion = (v1: string, v2: string) => {
  return v2.split('.')[0] > v1.split('.')[0];
};
