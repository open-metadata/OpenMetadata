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

import { Bold01, Code01, Italic01, List, Type01 } from '@untitledui/icons';
import Select, { DefaultOptionType } from 'antd/lib/select';
import { isEmpty, startCase, toString } from 'lodash';
import {
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { RenderEditCellProps } from 'react-data-grid';
import Certification from '../../components/Certification/Certification.component';
import TreeAsyncSelectList from '../../components/common/AsyncSelectList/TreeAsyncSelectList';
import { lazyTextEditor } from '../../components/common/DataGrid/LazyDataGrid';
import DomainSelectableList from '../../components/common/DomainSelectableList/DomainSelectableList.component';
import ExpressionCodeCell from '../../components/common/EntityImport/ExpressionCodeCell/ExpressionCodeCell.component';
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
import {
  EntityStatus,
  Language,
  MetricGranularity,
  MetricSourceType,
  MetricType,
  UnitOfMeasurement,
} from '../../generated/entity/data/metric';
import { EntityReference } from '../../generated/entity/type';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import TagSuggestion from '../../pages/TasksPage/shared/TagSuggestion';
import Fqn from '../Fqn';
import { t } from '../i18next/LocalUtil';
import { removeOuterEscapes } from '../StringUtils';
import { getCustomPropertyEntityType } from './CSV.utils';

export interface CSVEditorOptions {
  usePlainTextEditor?: boolean;
}

interface InlineDescriptionEditorProps {
  value: string;
  onCancel: () => void;
  onComplete: (value: string) => void;
}

const InlineDescriptionEditor = ({
  value,
  onCancel,
  onComplete,
}: InlineDescriptionEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(value.length, value.length);
  }, [value]);

  const restoreSelection = (
    nextValue: string,
    selectionStart: number,
    selectionEnd = selectionStart
  ) => {
    setDraft(nextValue);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const handleToolbarMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const applyInlineFormat = (prefix: string, suffix = prefix) => {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? draft.length;
    const selectionEnd = textarea?.selectionEnd ?? draft.length;
    const selectedText = draft.slice(selectionStart, selectionEnd);
    const nextValue = `${draft.slice(
      0,
      selectionStart
    )}${prefix}${selectedText}${suffix}${draft.slice(selectionEnd)}`;
    const cursorStart = selectionStart + prefix.length;
    const cursorEnd = cursorStart + selectedText.length;

    restoreSelection(nextValue, cursorStart, cursorEnd);
  };

  const applyLineFormat = (formatter: (index: number) => string) => {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? draft.length;
    const selectionEnd = textarea?.selectionEnd ?? draft.length;
    const lineStart = draft.lastIndexOf('\n', selectionStart - 1) + 1;
    const nextBreakIndex = draft.indexOf('\n', selectionEnd);
    const lineEnd = nextBreakIndex === -1 ? draft.length : nextBreakIndex;
    const selectedBlock = draft.slice(lineStart, lineEnd);
    const nextBlock = selectedBlock
      .split('\n')
      .map(
        (line, index) =>
          `${formatter(index)}${line.replace(/^(\s*([-*]|\d+\.)\s+)/, '')}`
      )
      .join('\n');
    const nextValue = `${draft.slice(0, lineStart)}${nextBlock}${draft.slice(
      lineEnd
    )}`;

    restoreSelection(
      nextValue,
      selectionStart,
      selectionStart + nextBlock.length
    );
  };

  const clearFormatting = () => {
    const nextValue = draft
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '');

    restoreSelection(nextValue, nextValue.length);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget;

    if (
      relatedTarget instanceof Node &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }

    onComplete(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();

      return;
    }

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onComplete(draft);
    }
  };

  return (
    <KeyDownStopPropagationWrapper keys={['Enter', 'Escape', 'Tab']}>
      <div
        className="bulk-edit-description-editor"
        data-testid="bulk-edit-description-editor"
        onBlur={handleBlur}>
        <div className="bulk-edit-description-editor-toolbar">
          <button
            aria-label={t('label.bold')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyInlineFormat('**')}
            onMouseDown={handleToolbarMouseDown}>
            <Bold01 size={16} />
          </button>
          <button
            aria-label={t('label.italic')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyInlineFormat('_')}
            onMouseDown={handleToolbarMouseDown}>
            <Italic01 size={16} />
          </button>
          <button
            aria-label={t('label.bulleted-list')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyLineFormat(() => '- ')}
            onMouseDown={handleToolbarMouseDown}>
            <List size={16} />
          </button>
          <button
            aria-label={t('label.numbered-list')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyLineFormat((index) => `${index + 1}. `)}
            onMouseDown={handleToolbarMouseDown}>
            <span className="bulk-edit-description-editor-numbered-icon">
              1.
            </span>
          </button>
          <button
            aria-label={t('label.code')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={() => applyInlineFormat('`')}
            onMouseDown={handleToolbarMouseDown}>
            <Code01 size={16} />
          </button>
          <span className="bulk-edit-description-editor-separator" />
          <button
            aria-label={t('label.clear-formatting')}
            className="bulk-edit-description-editor-button"
            type="button"
            onClick={clearFormatting}
            onMouseDown={handleToolbarMouseDown}>
            <Type01 size={16} />
          </button>
        </div>
        <textarea
          className="bulk-edit-description-editor-textarea"
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </KeyDownStopPropagationWrapper>
  );
};

const toSelectOptions = (values: string[]) =>
  values.map((value) => ({ label: value, value }));

const METRIC_ENUM_COLUMN_OPTIONS: Record<string, DefaultOptionType[]> = {
  metricType: toSelectOptions(Object.values(MetricType)),
  unitOfMeasurement: toSelectOptions(Object.values(UnitOfMeasurement)),
  granularity: toSelectOptions(Object.values(MetricGranularity)),
  sourceType: toSelectOptions(Object.values(MetricSourceType)),
  entityStatus: toSelectOptions(Object.values(EntityStatus)),
  syncEnabled: toSelectOptions(['true', 'false']),
};

class CSVUtilsClassBase {
  public hideImportsColumnList() {
    return ['glossaryStatus', 'inspectionQuery'];
  }

  public metricEnumColumns() {
    return Object.keys(METRIC_ENUM_COLUMN_OPTIONS);
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
      'column.name*',
      'name*',
      'parameterValues',
    ];
  }

  public getEditor(
    column: string,
    entityType: EntityType,
    multipleOwner: {
      user: boolean;
      team: boolean;
    },
    options: CSVEditorOptions = {}
  ): ((props: RenderEditCellProps<any, any>) => ReactNode) | undefined {
    switch (column) {
      case 'owner':
      case 'owners':
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
            <UserTeamSelectableList
              hasPermission
              multiple={multipleOwner}
              owner={ownerEntityRef}
              popoverProps={{
                open: true,
              }}
              onClose={onClose}
              onUpdate={handleChange}>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </UserTeamSelectableList>
          );
        };
      case 'description':
        if (options.usePlainTextEditor) {
          return ({
            row,
            onRowChange,
            onClose,
            column,
          }: RenderEditCellProps<any, any>) => {
            const value = String(row[column.key] ?? '');
            const handleComplete = (description: string) => {
              if (description === value) {
                onClose(false);

                return;
              }

              onRowChange({ ...row, [column.key]: description }, true);
              onClose(true);
            };

            return (
              <InlineDescriptionEditor
                value={value}
                onCancel={() => onClose(false)}
                onComplete={handleComplete}
              />
            );
          };
        }

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
                      getPopupContainer: () => document.body,
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
            <TierCard
              currentTier={value}
              popoverProps={{ open: true }}
              updateTier={handleChange}
              onClose={() => onClose(false)}>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </TierCard>
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
            <Certification
              permission
              currentCertificate={value}
              popoverProps={{ open: true }}
              onCertificationUpdate={handleChange}
              onClose={() => onClose(false)}>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </Certification>
          );
        };
      case 'domains':
        return ({
          row,
          onRowChange,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const domains = value
            ? (value?.split(';') ?? []).map((domain: string) => {
                const fqn = removeOuterEscapes(domain.trim());

                return {
                  type: EntityType.DOMAIN,
                  name: fqn,
                  id: '',
                  fullyQualifiedName: fqn,
                };
              })
            : [];

          const handleChange = async (domain?: EntityReference[]) => {
            if (!domain || isEmpty(domain)) {
              onRowChange(
                {
                  ...row,
                  [column.key]: [],
                },
                true
              );

              return;
            }
            onRowChange(
              {
                ...row,
                [column.key]:
                  domain
                    .map((d) => {
                      const fqn = removeOuterEscapes(
                        d.fullyQualifiedName ?? ''
                      );

                      // Wrap in quotes to match CSV import format; escape any internal " for CSV safety
                      return `"${fqn.replace(/"/g, '""')}"`;
                    })
                    .join(';') ?? '',
              },
              true
            );
          };

          return (
            <DomainSelectableList
              hasPermission
              multiple
              getPopupContainer={() => document.body}
              popoverProps={{ open: true }}
              selectedDomain={domains}
              wrapInButton={false}
              onUpdate={(domain) => handleChange(domain as EntityReference[])}>
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </DomainSelectableList>
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
              <ValueRendererOnEditCell>{value}</ValueRendererOnEditCell>
            </UserTeamSelectableList>
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
                entityType={getCustomPropertyEntityType(entityType)}
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
          const translatedEntityTypeOptions = () =>
            ENTITY_TYPE_OPTIONS.map((opt) => ({
              ...opt,
              label: t(opt.label),
            }));

          return (
            <KeyDownStopPropagationWrapper>
              <InlineEdit
                onCancel={() => onClose(false)}
                onSave={() => onClose(true)}>
                <Select
                  autoFocus
                  open
                  data-testid="entity-type-select"
                  options={translatedEntityTypeOptions()}
                  size="small"
                  style={{ width: '155px' }}
                  value={value}
                  onChange={handleChange}
                />
              </InlineEdit>
            </KeyDownStopPropagationWrapper>
          );
        };

      case 'relatedMetrics':
      case 'dataProducts':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const selected = value
            ? String(value).split(';').filter(Boolean)
            : [];
          const handleChange = (values: string[]) => {
            onRowChange({ ...row, [column.key]: values.join(';') }, true);
          };

          return (
            <KeyDownStopPropagationWrapper>
              <InlineEdit
                onCancel={() => onClose(false)}
                onSave={() => onClose(true)}>
                <Select
                  autoFocus
                  open
                  className="react-grid-select-dropdown"
                  getPopupContainer={() => document.body}
                  mode="tags"
                  placeholder={t('label.add-entity', {
                    entity: startCase(column.key),
                  })}
                  size="small"
                  value={selected}
                  onChange={handleChange}
                />
              </InlineEdit>
            </KeyDownStopPropagationWrapper>
          );
        };

      case 'expressionCode':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const language = (row.expressionLanguage as Language) || Language.SQL;
          const handleCommit = (code: string, selectedLanguage: Language) => {
            onRowChange(
              {
                ...row,
                [column.key]: code,
                expressionLanguage: selectedLanguage,
              },
              true
            );
            onClose(true);
          };

          return (
            <>
              <ValueRendererOnEditCell>
                {row[column.key]}
              </ValueRendererOnEditCell>
              <ExpressionCodeCell
                language={language}
                value={String(row[column.key] ?? '')}
                onCancel={() => onClose(false)}
                onCommit={handleCommit}
              />
            </>
          );
        };

      case 'metricType':
      case 'unitOfMeasurement':
      case 'granularity':
      case 'sourceType':
      case 'entityStatus':
      case 'syncEnabled':
        return ({
          row,
          onRowChange,
          onClose,
          column,
        }: RenderEditCellProps<any, any>) => {
          const value = row[column.key];
          const handleChange = (selectedValue: string) => {
            onRowChange({ ...row, [column.key]: selectedValue }, true);
          };

          return (
            <KeyDownStopPropagationWrapper>
              <InlineEdit
                onCancel={() => onClose(false)}
                onSave={() => onClose(true)}>
                <Select
                  autoFocus
                  open
                  showSearch
                  className="react-grid-select-dropdown"
                  data-testid={`${column.key}-select`}
                  getPopupContainer={() => document.body}
                  optionFilterProp="label"
                  options={METRIC_ENUM_COLUMN_OPTIONS[column.key]}
                  size="small"
                  value={value || undefined}
                  onChange={handleChange}
                />
              </InlineEdit>
            </KeyDownStopPropagationWrapper>
          );
        };

      case 'code':
        if (options.usePlainTextEditor) {
          return lazyTextEditor;
        }

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
        return lazyTextEditor;
    }
  }
}

const csvUtilsClassBase = new CSVUtilsClassBase();

export default csvUtilsClassBase;
export { CSVUtilsClassBase };
