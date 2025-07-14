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

import Select, { DefaultOptionType } from 'antd/lib/select';
import { toString } from 'lodash';
import { ReactNode, useRef } from 'react';
import { RenderEditCellProps, textEditor } from 'react-data-grid';
import Certification from '../../components/Certification/Certification.component';
import TreeAsyncSelectList from '../../components/common/AsyncSelectList/TreeAsyncSelectList';
import DomainSelectableList from '../../components/common/DomainSelectableList/DomainSelectableList.component';
import { useMultiContainerFocusTrap } from '../../components/common/FocusTrap/FocusTrapWithContainer';
import InlineEdit from '../../components/common/InlineEdit/InlineEdit.component';
import { KeyDownStopPropagationWrapper } from '../../components/common/KeyDownStopPropagationWrapper/KeyDownStopPropagationWrapper';
import TierCard from '../../components/common/TierCard/TierCard';
import { UserTeamSelectableList } from '../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { ValueRendererOnEditCell } from '../../components/common/ValueRendererOnEditCell/ValueRendererOnEditCell';
import { ModalWithCustomPropertyEditor } from '../../components/Modals/ModalWithCustomProperty/ModalWithCustomPropertyEditor.component';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import SchemaModal from '../../components/Modals/SchemaModal/SchemaModal';
import { ENTITY_TYPE_OPTIONS } from '../../constants/BulkImport.constant';
import { CSMode } from '../../enums/codemirror.enum';
import { EntityType } from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { EntityReference } from '../../generated/entity/type';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import TagSuggestion from '../../pages/TasksPage/shared/TagSuggestion';
import Fqn from '../Fqn';
import { t } from '../i18next/LocalUtil';

class CSVUtilsClassBase {
  public hideImportsColumnList() {
    return ['glossaryStatus'];
  }

  public columnsWithMultipleValuesEscapeNeeded() {
    return [
      'parent',
      'extension',
      'synonyms',
      'description',
      'tags',
      'glossaryTerms',
      'relatedTerms',
      'column.description',
      'column.tags',
      'column.glossaryTerms',
      'storedProcedure.code',
    ];
  }

  public getEditor(
    column: string,
    entityType: EntityType
  ): ((props: RenderEditCellProps<any, any>) => ReactNode) | undefined {
    switch (column) {
      case 'owner':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row?.[column.key];
          const owners = value?.split(';') ?? [];
          const ownerEntityRef = owners.map((owner: string) => {
            const [type, user] = owner.split(':');

            return {
              type,
              name: user,
              id: user,
            } as EntityReference;
          });

          const handleChange = (owners?: EntityReference[]) => {
            if (!owners || owners.length === 0) {
              onRowChange({ ...row, [column.key]: '' }, true);

              return;
            }
            const ownerText = owners
              .map((owner) => `${owner.type}:${owner.name}`)
              .join(';');
            onRowChange({ ...row, [column.key]: ownerText }, true);
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <UserTeamSelectableList
                hasPermission
                multiple={{ user: true, team: false }}
                owner={ownerEntityRef}
                popoverProps={{
                  open: true,
                }}
                onClose={onClose}
                onUpdate={handleChange}>
                {' '}
              </UserTeamSelectableList>
            </>
          );
        };
      case 'description':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const handleSave = async (description: string) => {
            onRowChange({ ...row, [column.key]: description }, true);
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <ModalWithMarkdownEditor
                visible
                header="Edit Description"
                placeholder="Description"
                value={value}
                onCancel={() => onClose(false)}
                onSave={handleSave}
              />
            </>
          );
        };
      case 'tags':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const containerRef = useRef<HTMLDivElement | null>(null);
          const dropdownContainerRef = useRef<HTMLDivElement | null>(null);
          useMultiContainerFocusTrap({
            containers: [containerRef.current, dropdownContainerRef.current],
            active: true,
          });

          const tags = row[column.key]
            ? row[column.key]?.split(';').map(
                (tag: string) =>
                  ({
                    tagFQN: tag,
                    source: TagSource.Classification,
                    name: Fqn.split(tag).pop(),
                  } as TagLabel)
              )
            : undefined;

          const handleChange = (tags: TagLabel[]) => {
            onRowChange({
              ...row,
              [column.key]: tags.map((tag) => tag.tagFQN).join(';'),
            });
          };

          return (
            <KeyDownStopPropagationWrapper>
              <div ref={containerRef}>
                <InlineEdit
                  onCancel={() => onClose(false)}
                  onSave={() => onClose(true)}>
                  <TagSuggestion
                    autoFocus
                    dropdownContainerRef={dropdownContainerRef}
                    selectProps={{
                      className: 'react-grid-select-dropdown',
                      size: 'small',
                    }}
                    value={tags}
                    onChange={handleChange}
                  />
                </InlineEdit>
              </div>
            </KeyDownStopPropagationWrapper>
          );
        };
      case 'glossaryTerms':
      case 'relatedTerms':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const containerRef = useRef<HTMLDivElement | null>(null);
          const dropdownContainerRef = useRef<HTMLDivElement | null>(null);
          useMultiContainerFocusTrap({
            containers: [containerRef.current, dropdownContainerRef.current],
            active: true,
          });

          const value = row[column.key];
          const tags = value ? value?.split(';') : [];

          const handleChange = (
            option: DefaultOptionType | DefaultOptionType[]
          ) => {
            if (Array.isArray(option)) {
              onRowChange({
                ...row,
                [column.key]: option
                  .map((tag) => toString(tag.value))
                  .join(';'),
              });
            } else {
              onRowChange({
                ...row,
                [column.key]: toString(option.value),
              });
            }
          };

          return (
            <div ref={containerRef}>
              <TreeAsyncSelectList
                defaultValue={tags}
                dropdownContainerRef={dropdownContainerRef}
                optionClassName="tag-select-box"
                tagType={TagSource.Glossary}
                onCancel={() => {
                  onClose(false);
                }}
                onChange={handleChange}
                onSubmit={() => onClose(true)}
              />
            </div>
          );
        };
      case 'tiers':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const handleChange = async (tag?: Tag) => {
            onRowChange(
              {
                ...row,
                [column.key]: tag?.fullyQualifiedName,
              },
              true
            );
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <TierCard
                currentTier={value}
                popoverProps={{ open: true }}
                updateTier={handleChange}
                onClose={() => onClose(false)}>
                {' '}
              </TierCard>
            </>
          );
        };

      case 'certification':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const handleChange = async (tag?: Tag) => {
            onRowChange(
              {
                ...row,
                [column.key]: tag?.fullyQualifiedName,
              },
              true
            );
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <Certification
                permission
                currentCertificate={value}
                popoverProps={{ open: true }}
                onCertificationUpdate={handleChange}
                onClose={() => onClose(false)}
              />
            </>
          );
        };
      case 'domain':
        return ({
          row,
          onRowChange,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const handleChange = async (domain?: EntityReference) => {
            if (!domain) {
              onRowChange(
                {
                  ...row,
                  [column.key]: '',
                },
                true
              );

              return;
            }
            onRowChange(
              {
                ...row,
                [column.key]:
                  domain.fullyQualifiedName?.replace(
                    new RegExp('"', 'g'),
                    '""'
                  ) ?? '',
              },
              true
            );
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <DomainSelectableList
                hasPermission
                popoverProps={{ open: true }}
                selectedDomain={
                  value
                    ? {
                        type: EntityType.DOMAIN,
                        name: value,
                        id: '',
                        fullyQualifiedName: value,
                      }
                    : undefined
                }
                onUpdate={(domain) => handleChange(domain as EntityReference)}>
                {' '}
              </DomainSelectableList>
            </>
          );
        };
      case 'reviewers':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const reviewers = value?.split(';') ?? [];
          const reviewersEntityRef = reviewers.map((reviewer: string) => {
            const [type, user] = reviewer.split(':');

            return {
              type,
              name: user,
              id: user,
            } as EntityReference;
          });

          const handleChange = (reviewers?: EntityReference[]) => {
            if (!reviewers || reviewers.length === 0) {
              onRowChange(
                {
                  ...row,
                  [column.key]: '',
                },
                true
              );

              return;
            }
            const reviewerText = reviewers
              .map((reviewer) => `${reviewer.type}:${reviewer.name}`)
              .join(';');
            onRowChange(
              {
                ...row,
                [column.key]: reviewerText,
              },
              true
            );
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <UserTeamSelectableList
                hasPermission
                previewSelected
                label={t('label.reviewer-plural')}
                listHeight={200}
                multiple={{ user: true, team: false }}
                owner={reviewersEntityRef}
                popoverProps={{
                  open: true,
                }}
                onClose={onClose}
                onUpdate={handleChange}>
                {' '}
              </UserTeamSelectableList>
            </>
          );
        };
      case 'extension':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const handleSave = async (extension?: string) => {
            onRowChange({ ...row, [column.key]: extension }, true);
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <ModalWithCustomPropertyEditor
                visible
                entityType={entityType}
                header="Edit CustomProperty"
                value={value}
                onCancel={() => onClose(false)}
                onSave={handleSave}
              />
            </>
          );
        };
      case 'entityType*':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const handleChange = (typeValue: string) => {
            onRowChange({ ...row, [column.key]: typeValue });
          };

          return (
            <KeyDownStopPropagationWrapper>
              <InlineEdit
                onCancel={() => onClose(false)}
                onSave={() => onClose(true)}>
                <Select
                  autoFocus
                  open
                  data-testid="entity-type-select"
                  options={ENTITY_TYPE_OPTIONS}
                  size="small"
                  style={{ width: '155px' }}
                  value={value}
                  onChange={handleChange}
                />
              </InlineEdit>
            </KeyDownStopPropagationWrapper>
          );
        };

      case 'code':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const handleChange = (value: string) => {
            onRowChange({ ...row, [column.key]: value });
          };

          return (
            <>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
              <SchemaModal
                isFooterVisible
                visible
                data={value}
                editorClass="custom-code-mirror-theme full-screen-editor-height"
                mode={{ name: CSMode.SQL }}
                onChange={handleChange}
                onClose={() => onClose(false)}
                onSave={() => onClose(true)}
              />
            </>
          );
        };
      default:
        return textEditor;
    }
  }
}

const csvUtilsClassBase = new CSVUtilsClassBase();

export default csvUtilsClassBase;
export { CSVUtilsClassBase };
