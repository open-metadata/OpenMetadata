import classNames from 'classnames';
import { diffArrays, diffWordsWithSpace } from 'diff';
import { isUndefined } from 'lodash';
import React, { Fragment } from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import gfm from 'remark-gfm';
import {
  ChangeDescription,
  FieldChange,
} from '../generated/entity/services/databaseService';
import { TagLabel } from '../generated/type/tagLabel';
import { isValidJSONString } from './StringsUtils';

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

export const summaryFormatter = (v: FieldChange) => {
  const value = JSON.parse(
    isValidJSONString(v?.newValue)
      ? v?.newValue
      : isValidJSONString(v?.oldValue)
      ? v?.oldValue
      : '{}'
  );
  if (v.name === 'columns') {
    return `columns ${value?.map((val: any) => val?.name).join(',')}`;
  } else if (v.name === 'tags' || v.name?.endsWith('tags')) {
    return `tags ${value?.map((val: any) => val?.tagFQN)?.join(',')}`;
  } else {
    return v.name;
  }
};

export const getSummary = (changeDescription: ChangeDescription) => {
  const fieldsAdded = [...(changeDescription?.fieldsAdded || [])];
  const fieldsDeleted = [...(changeDescription?.fieldsDeleted || [])];
  const fieldsUpdated = [...(changeDescription?.fieldsUpdated || [])];

  return (
    <Fragment>
      {fieldsAdded?.length > 0 ? (
        <p>{fieldsAdded?.map(summaryFormatter)} has been added</p>
      ) : null}
      {fieldsUpdated?.length ? (
        <p>{fieldsUpdated?.map(summaryFormatter)} has been updated</p>
      ) : null}
      {fieldsDeleted?.length ? (
        <p>{fieldsDeleted?.map(summaryFormatter)} has been deleted</p>
      ) : null}
    </Fragment>
  );
};
