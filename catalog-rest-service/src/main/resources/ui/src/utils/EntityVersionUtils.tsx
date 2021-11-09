import classNames from 'classnames';
import { diffWords } from 'diff';
import React from 'react';
import {
  ChangeDescription,
  FieldChange,
} from '../generated/entity/services/databaseService';

export const getDiffByFieldName = (
  name: string,
  changeDescription: ChangeDescription
): FieldChange | undefined => {
  const fieldsAdded = changeDescription?.fieldsAdded || [];
  const fieldsDeleted = changeDescription?.fieldsDeleted || [];
  const fieldsUpdated = changeDescription?.fieldsUpdated || [];

  const changesArr = [...fieldsAdded, ...fieldsDeleted, ...fieldsUpdated];
  const diff = changesArr.find((ch) => ch.name?.startsWith(name));

  return diff;
};

export const getDiffValue = (oldValue: string, newValue: string) => {
  const diff = diffWords(oldValue, newValue);

  // eslint-disable-next-line
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
