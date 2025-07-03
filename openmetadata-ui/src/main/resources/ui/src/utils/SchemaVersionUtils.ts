/*
 *  Copyright 2023 Collate.
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

import { cloneDeep, isEmpty, isEqual, isUndefined } from 'lodash';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityField } from '../constants/Feeds.constants';
import {
  ChangeDescription,
  DataTypeTopic,
  Field,
  MessageSchemaObject,
} from '../generated/entity/data/topic';
import { APISchema } from '../generated/type/apiSchema';
import { EntityDiffProps } from '../interface/EntityVersion.interface';
import {
  getAllChangedEntityNames,
  getAllDiffByFieldName,
  getChangeColumnNameFromDiffValue,
  getChangedEntityName,
  getDiffByFieldName,
  getEntityDescriptionDiff,
  getEntityDisplayNameDiff,
  getEntityTagDiff,
  getTextDiff,
  isEndsWithField,
} from './EntityVersionUtils';

export function getNewFieldFromSchemaFieldDiff(
  newCol: Array<Field>
): Array<Field> {
  return newCol.map((col) => {
    let children: Array<Field> | undefined;
    if (!isEmpty(col.children)) {
      children = getNewFieldFromSchemaFieldDiff(col.children as Array<Field>);
    }

    return {
      ...col,
      tags: col.tags?.map((tag) => ({ ...tag, removed: true })),
      description: getTextDiff(col.description ?? '', ''),
      dataTypeDisplay: getTextDiff(col.dataTypeDisplay ?? '', ''),
      dataType: getTextDiff(col.dataType ?? '', '') as DataTypeTopic,
      name: getTextDiff(col.name, ''),
      children,
    };
  });
}

export function getNewSchemaFromSchemaDiff(
  newField: Array<Field>
): Array<Field> {
  return newField.map((field) => {
    let children: Array<Field> | undefined;
    if (!isEmpty(field.children)) {
      children = getNewSchemaFromSchemaDiff(field.children as Array<Field>);
    }

    return {
      ...field,
      tags: field.tags?.map((tag) => ({ ...tag, removed: true })),
      description: getTextDiff(field.description ?? '', ''),
      dataType: getTextDiff(field.dataType ?? '', '') as DataTypeTopic,
      dataTypeDisplay: getTextDiff(field.dataTypeDisplay ?? '', ''),
      name: getTextDiff(field.name, ''),
      children,
    };
  });
}

export function createAddedSchemasDiff(
  schemaFieldsDiff: EntityDiffProps,
  schemaFields: Array<Field> = []
) {
  const newField: Array<Field> = JSON.parse(
    schemaFieldsDiff.added?.newValue ?? '[]'
  );

  newField.forEach((field) => {
    const formatSchemaFieldsData = (arr: Array<Field>, updateAll?: boolean) => {
      arr?.forEach((i) => {
        if (isEqual(i.name, field.name) || updateAll) {
          i.tags = i.tags?.map((tag) => ({ ...tag, added: true }));
          i.description = getTextDiff('', i.description ?? '');
          i.dataType = getTextDiff('', i.dataType ?? '') as DataTypeTopic;
          i.dataTypeDisplay = getTextDiff('', i.dataTypeDisplay ?? '');
          i.name = getTextDiff('', i.name);
          if (!isEmpty(i.children)) {
            formatSchemaFieldsData(i?.children as Array<Field>, true);
          }
        } else {
          formatSchemaFieldsData(i?.children as Array<Field>);
        }
      });
    };
    formatSchemaFieldsData(schemaFields ?? []);
  });
}

export function addDeletedSchemasDiff(
  columnsDiff: EntityDiffProps,
  colList: Array<Field> = [],
  changedEntity = ''
) {
  const newCol: Array<Field> = JSON.parse(
    columnsDiff.deleted?.oldValue ?? '[]'
  );
  const newColumns = getNewFieldFromSchemaFieldDiff(newCol);

  const insertNewSchemaField = (
    changedEntityField: string,
    colArray: Array<Field>
  ) => {
    const fieldsArray = changedEntityField.split(FQN_SEPARATOR_CHAR);
    if (isEmpty(changedEntityField)) {
      const nonExistingColumns = newColumns.filter((newColumn) =>
        isUndefined(colArray.find((col) => col.name === newColumn.name))
      );
      colArray.unshift(...nonExistingColumns);
    } else {
      const parentField = fieldsArray.shift();
      const arr = colArray.find((col) => col.name === parentField)?.children;

      insertNewSchemaField(fieldsArray.join(FQN_SEPARATOR_CHAR), arr ?? []);
    }
  };
  insertNewSchemaField(changedEntity, colList);
}

export function getSchemasDiff(
  schemaFieldsDiff: EntityDiffProps,
  changedEntity = '',
  schemaFields: Array<Field> = [],
  clonedMessageSchema?: MessageSchemaObject | APISchema
) {
  if (schemaFieldsDiff.added) {
    createAddedSchemasDiff(schemaFieldsDiff, schemaFields);
  }
  if (schemaFieldsDiff.deleted) {
    const newField: Array<Field> = JSON.parse(
      schemaFieldsDiff.deleted?.oldValue ?? '[]'
    );
    const newFields = getNewSchemaFromSchemaDiff(newField);
    const insertNewField = (
      changedEntityField: string,
      fieldArray: Array<Field>
    ) => {
      const changedFieldsArray = changedEntityField.split(FQN_SEPARATOR_CHAR);
      if (isEmpty(changedEntityField)) {
        const nonExistingFields = newFields.filter((newField) =>
          isUndefined(fieldArray.find((field) => field.name === newField.name))
        );
        fieldArray.unshift(...nonExistingFields);
      } else {
        const parentField = changedFieldsArray.shift();
        const arr = fieldArray.find(
          (field) => field.name === parentField
        )?.children;

        insertNewField(changedFieldsArray.join(FQN_SEPARATOR_CHAR), arr ?? []);
      }
    };

    insertNewField(changedEntity, schemaFields);
  }

  return {
    ...clonedMessageSchema,
    schemaFields,
  };
}

export const getVersionedSchema = (
  schema: MessageSchemaObject | APISchema,
  changeDescription: ChangeDescription
): MessageSchemaObject | APISchema => {
  let clonedMessageSchema = cloneDeep(schema);
  const schemaFields = clonedMessageSchema?.schemaFields;
  const schemaFieldsDiff = getAllDiffByFieldName(
    EntityField.SCHEMA_FIELDS,
    changeDescription
  );

  const changedSchemaFields = getAllChangedEntityNames(schemaFieldsDiff);

  changedSchemaFields?.forEach((changedSchemaField) => {
    const schemaFieldDiff = getDiffByFieldName(
      changedSchemaField,
      changeDescription
    );
    const changedEntityName = getChangedEntityName(schemaFieldDiff);
    const changedSchemaFieldName =
      getChangeColumnNameFromDiffValue(changedEntityName);

    if (isEndsWithField(EntityField.DESCRIPTION, changedEntityName)) {
      const formattedSchema = getEntityDescriptionDiff(
        schemaFieldDiff,
        changedSchemaFieldName,
        schemaFields
      );

      clonedMessageSchema = {
        ...clonedMessageSchema,
        schemaFields: formattedSchema,
      };
    } else if (isEndsWithField(EntityField.TAGS, changedEntityName)) {
      const formattedSchema = getEntityTagDiff(
        schemaFieldDiff,
        changedSchemaFieldName,
        schemaFields
      );

      clonedMessageSchema = {
        ...clonedMessageSchema,
        schemaFields: formattedSchema,
      };
    } else if (
      isEndsWithField(EntityField.DATA_TYPE_DISPLAY, changedEntityName)
    ) {
      const formattedSchema = getEntityDisplayNameDiff(
        schemaFieldDiff,
        EntityField.DATA_TYPE_DISPLAY,
        changedSchemaFieldName,
        schemaFields
      );

      clonedMessageSchema = {
        ...clonedMessageSchema,
        schemaFields: formattedSchema,
      };
    } else {
      const changedEntity = changedEntityName
        ?.split(FQN_SEPARATOR_CHAR)
        .slice(2)
        .join(FQN_SEPARATOR_CHAR);

      const schemaFieldsDiff = getDiffByFieldName(
        changedEntityName ?? '',
        changeDescription,
        true
      );

      clonedMessageSchema = getSchemasDiff(
        schemaFieldsDiff,
        changedEntity,
        schemaFields,
        clonedMessageSchema
      );
    }
  });

  return clonedMessageSchema;
};
