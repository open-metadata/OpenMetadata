/*
 *  Copyright 2024 Collate.
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
import { TypeColumn } from '@inovua/reactdatagrid-community/types';
import { compact, get, isEmpty, startCase } from 'lodash';
import { ReactComponent as FailBadgeIcon } from 'openmetadata-ui/src/assets/svg/fail-badge.svg';
import { ReactComponent as SuccessBadgeIcon } from 'openmetadata-ui/src/assets/svg/success-badge.svg';
import React, { ReactNode } from 'react';
import DomainSelectableList from '../../components/common/DomainSelectableList/DomainSelectableList.component';
import InlineEdit from '../../components/common/InlineEdit/InlineEdit.component';
import TierCard from '../../components/common/TierCard/TierCard';
import { UserTeamSelectableList } from '../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { EntityType } from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import {
  EntityReference,
  TagLabel,
  TagSource,
} from '../../generated/tests/testCase';
import { Status } from '../../generated/type/csvImportResult';
import TagSuggestion from '../../pages/TasksPage/shared/TagSuggestion';
import EntityLink from '../EntityLink';

interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
  onCancel: () => void;
  onComplete: (value?: string) => void;
}

export const COLUMNS_WIDTH: Record<string, number> = {
  description: 300,
  tags: 280,
  glossaryTerms: 280,
  tiers: 120,
  status: 70,
};

export const getEditor = (
  column: string
): ((props: EditorProps) => ReactNode) | undefined => {
  switch (column) {
    case 'owner':
      return ({ value, ...props }: EditorProps) => {
        const owners = value?.split(';') ?? [];
        const ownerEntityRef = owners.map((owner) => {
          const [type, user] = owner.split(':');

          return {
            type,
            name: user,
            id: user,
          } as EntityReference;
        });

        const handleChange = (owners?: EntityReference[]) => {
          if (!owners || owners.length === 0) {
            props.onChange();

            setTimeout(() => {
              props.onComplete();
            }, 1);

            return;
          }
          const ownerText = owners
            .map((owner) => `${owner.type}:${owner.name}`)
            .join(';');
          props.onChange(ownerText);

          setTimeout(() => {
            props.onComplete(ownerText);
          }, 1);
        };

        return (
          <UserTeamSelectableList
            hasPermission
            multiple={{ user: true, team: false }}
            owner={ownerEntityRef}
            popoverProps={{
              open: true,
            }}
            onUpdate={handleChange}>
            {' '}
          </UserTeamSelectableList>
        );
      };
    case 'description':
      return ({ value, ...props }: EditorProps) => {
        const handleSave = async (description: string) => {
          props.onChange(description);

          setTimeout(() => {
            props.onComplete(description);
          }, 1);
        };

        return (
          <ModalWithMarkdownEditor
            visible
            header="Edit Description"
            placeholder="Description"
            value={value}
            onCancel={props.onCancel}
            onSave={handleSave}
          />
        );
      };
    case 'tags':
      return ({ value, ...props }) => {
        const tags = value
          ? value?.split(';').map(
              (tag: string) =>
                ({
                  tagFQN: tag,
                  source: TagSource.Classification,
                  name: EntityLink.split(tag).pop(),
                } as TagLabel)
            )
          : undefined;

        const handleChange = (tags: TagLabel[]) => {
          props.onChange(
            tags.map((tag) => tag.tagFQN.replaceAll('"', '""')).join(';')
          );
        };

        return (
          <InlineEdit onCancel={props.onCancel} onSave={props.onComplete}>
            <TagSuggestion
              selectProps={{ className: 'w-48', size: 'small', style: {} }}
              value={tags}
              onChange={handleChange}
            />
          </InlineEdit>
        );
      };
    case 'glossaryTerms':
      return ({ value, ...props }) => {
        const tags = value
          ? value?.split(';').map(
              (tag: string) =>
                ({
                  tagFQN: tag,
                  source: TagSource.Glossary,
                  name: EntityLink.split(tag).pop(),
                } as TagLabel)
            )
          : undefined;

        const handleChange = (tags: TagLabel[]) => {
          props.onChange(
            tags
              .map((tag) => tag.tagFQN.replace(new RegExp('"', 'g'), '""'))
              .join(';')
          );
        };

        return (
          <InlineEdit onCancel={props.onCancel} onSave={props.onComplete}>
            <TagSuggestion
              selectProps={{ className: 'w-48', size: 'small', style: {} }}
              tagType={TagSource.Glossary}
              value={tags}
              onChange={handleChange}
            />
          </InlineEdit>
        );
      };
    case 'tiers':
      return ({ value, ...props }) => {
        const handleChange = async (tag?: Tag) => {
          props.onChange(tag?.fullyQualifiedName);

          setTimeout(() => {
            props.onComplete(tag?.fullyQualifiedName);
          }, 1);
        };

        return (
          <TierCard
            currentTier={value}
            popoverProps={{ open: true }}
            updateTier={handleChange}>
            {' '}
          </TierCard>
        );
      };
    case 'domain':
      return ({ value, ...props }) => {
        const handleChange = async (domain?: EntityReference) => {
          if (!domain) {
            props.onChange();

            setTimeout(() => {
              props.onComplete();
            }, 1);

            return;
          }
          props.onChange(
            domain.fullyQualifiedName?.replace(new RegExp('"', 'g'), '""') ?? ''
          );

          setTimeout(() => {
            props.onComplete(
              domain.fullyQualifiedName?.replace(new RegExp('"', 'g'), '""') ??
                ''
            );
          }, 1);
        };

        return (
          <DomainSelectableList
            hasPermission
            popoverProps={{ open: true }}
            selectedDomain={
              value
                ? { type: EntityType.DOMAIN, name: value, id: '' }
                : undefined
            }
            onUpdate={(domain) => handleChange(domain as EntityReference)}>
            {' '}
          </DomainSelectableList>
        );
      };
    default:
      return undefined;
  }
};

const statusRenderer = ({
  value,
}: {
  value: Status;
  data: { details: string };
}) => {
  return value === Status.Failure ? (
    <FailBadgeIcon
      className="m-t-xss"
      data-testid="failure-badge"
      height={16}
      width={16}
    />
  ) : (
    <SuccessBadgeIcon
      className="m-t-xss"
      data-testid="success-badge"
      height={16}
      width={16}
    />
  );
};

export const getColumnConfig = (column: string): TypeColumn => {
  const colType = column.split('.').pop() ?? '';

  return {
    header: startCase(column),
    name: column,
    defaultFlex: 1,
    sortable: false,
    renderEditor: getEditor(colType),
    minWidth: COLUMNS_WIDTH[colType] ?? 180,
    render: column === 'status' ? statusRenderer : undefined,
  } as TypeColumn;
};

export const getEntityColumnsAndDataSourceFromCSV = (csv: string[][]) => {
  const [cols, ...rows] = csv;

  const columns = cols?.map(getColumnConfig) ?? [];

  const dataSource =
    rows.map((row, idx) => {
      return row.reduce(
        (acc: Record<string, string>, value: string, index: number) => {
          acc[cols[index]] = value;
          acc['id'] = idx + '';

          return acc;
        },
        {} as Record<string, string>
      );
    }) ?? [];

  return {
    columns,
    dataSource,
  };
};

export const getCSVStringFromColumnsAndDataSource = (
  columns: TypeColumn[],
  dataSource: Record<string, string>[]
) => {
  const header = columns.map((col) => col.name).join(',');
  const rows = dataSource.map((row) => {
    const compactValues = compact(columns.map((col) => row[col.name ?? '']));

    if (compactValues.length === 0) {
      return '';
    }

    return columns
      .map((col) => {
        const value = get(row, col.name ?? '', '');
        const colName = col.name ?? '';
        if (
          value.includes(',') ||
          colName.includes('tags') ||
          colName.includes('glossaryTerms') ||
          colName.includes('domain')
        ) {
          return isEmpty(value) ? '' : `"${value}"`;
        }

        return get(row, col.name ?? '', '');
      })
      .join(',');
  });

  return [header, ...compact(rows)].join('\n');
};
