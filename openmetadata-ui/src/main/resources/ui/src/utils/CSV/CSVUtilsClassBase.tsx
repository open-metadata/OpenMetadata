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

import { Form } from 'antd';
import Select, { DefaultOptionType } from 'antd/lib/select';
import { toString } from 'lodash';
import { ReactNode } from 'react';
import Certification from '../../components/Certification/Certification.component';
import TreeAsyncSelectList from '../../components/common/AsyncSelectList/TreeAsyncSelectList';
import DomainSelectableList from '../../components/common/DomainSelectableList/DomainSelectableList.component';
import InlineEdit from '../../components/common/InlineEdit/InlineEdit.component';
import TierCard from '../../components/common/TierCard/TierCard';
import { UserTeamSelectableList } from '../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
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
import { EditorProps } from './CSV.utils';

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
  ): ((props: EditorProps) => ReactNode) | undefined {
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
              onClose={props.onCancel}
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
                    name: Fqn.split(tag).pop(),
                  } as TagLabel)
              )
            : undefined;

          const handleChange = (tags: TagLabel[]) => {
            props.onChange(tags.map((tag) => tag.tagFQN).join(';'));
          };

          return (
            <InlineEdit onCancel={props.onCancel} onSave={props.onComplete}>
              <TagSuggestion
                autoFocus
                selectProps={{
                  className: 'react-grid-select-dropdown',
                  size: 'small',
                }}
                value={tags}
                onChange={handleChange}
              />
            </InlineEdit>
          );
        };
      case 'glossaryTerms':
      case 'relatedTerms':
        return ({ value, ...props }) => {
          const tags = value ? value?.split(';') : [];

          const handleChange = (
            option: DefaultOptionType | DefaultOptionType[]
          ) => {
            if (Array.isArray(option)) {
              props.onChange(
                option.map((tag) => toString(tag.value)).join(';')
              );
            } else {
              props.onChange(toString(option.value));
            }
          };

          return (
            <Form className="w-full" onFinish={props.onComplete}>
              <TreeAsyncSelectList
                defaultValue={tags}
                optionClassName="tag-select-box"
                tagType={TagSource.Glossary}
                onCancel={props.onCancel}
                onChange={handleChange}
              />
            </Form>
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

          const onClose = () => {
            props.onCancel();
          };

          return (
            <TierCard
              currentTier={value}
              popoverProps={{ open: true }}
              updateTier={handleChange}
              onClose={onClose}>
              {' '}
            </TierCard>
          );
        };

      case 'certification':
        return ({ value, ...props }) => {
          const handleChange = async (tag?: Tag) => {
            props.onChange(tag?.fullyQualifiedName);

            setTimeout(() => {
              props.onComplete(tag?.fullyQualifiedName);
            }, 1);
          };

          const onClose = () => {
            props.onCancel();
          };

          return (
            <Certification
              permission
              currentCertificate={value}
              popoverProps={{ open: true }}
              onCertificationUpdate={handleChange}
              onClose={onClose}
            />
          );
        };
      case 'domains':
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
              domain.fullyQualifiedName?.replace(new RegExp('"', 'g'), '""') ??
                ''
            );

            setTimeout(() => {
              props.onComplete(
                domain.fullyQualifiedName?.replace(
                  new RegExp('"', 'g'),
                  '""'
                ) ?? ''
              );
            }, 1);
          };

          return (
            <DomainSelectableList
              hasPermission
              multiple
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
          );
        };
      case 'reviewers':
        return ({ value, ...props }: EditorProps) => {
          const reviewers = value?.split(';') ?? [];
          const reviewersEntityRef = reviewers.map((reviewer) => {
            const [type, user] = reviewer.split(':');

            return {
              type,
              name: user,
              id: user,
            } as EntityReference;
          });

          const handleChange = (reviewers?: EntityReference[]) => {
            if (!reviewers || reviewers.length === 0) {
              props.onChange();

              setTimeout(() => {
                props.onComplete();
              }, 1);

              return;
            }
            const reviewerText = reviewers
              .map((reviewer) => `${reviewer.type}:${reviewer.name}`)
              .join(';');
            props.onChange(reviewerText);

            setTimeout(() => {
              props.onComplete(reviewerText);
            }, 1);
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
              onUpdate={handleChange}>
              {' '}
            </UserTeamSelectableList>
          );
        };
      case 'extension':
        return ({ value, ...props }: EditorProps) => {
          const handleSave = async (extension?: string) => {
            props.onChange(extension);

            setTimeout(() => {
              props.onComplete(extension);
            }, 1);
          };

          return (
            <ModalWithCustomPropertyEditor
              visible
              entityType={entityType}
              header="Edit CustomProperty"
              value={value}
              onCancel={props.onCancel}
              onSave={handleSave}
            />
          );
        };
      case 'entityType*':
        return ({ value, ...props }) => {
          const handleChange = (typeValue: string) => {
            props.onChange(typeValue);
          };

          return (
            <InlineEdit onCancel={props.onCancel} onSave={props.onComplete}>
              <Select
                data-testid="entity-type-select"
                options={ENTITY_TYPE_OPTIONS}
                size="small"
                style={{ width: '155px' }}
                value={value}
                onChange={handleChange}
              />
            </InlineEdit>
          );
        };

      case 'code':
        return ({ value, ...props }) => {
          const handleChange = (value: string) => {
            props.onChange(value);
          };

          return (
            <SchemaModal
              isFooterVisible
              visible
              data={value}
              editorClass="custom-code-mirror-theme full-screen-editor-height"
              mode={{ name: CSMode.SQL }}
              onChange={handleChange}
              onClose={props.onCancel}
              onSave={props.onComplete}
            />
          );
        };
      default:
        return undefined;
    }
  }
}

const csvUtilsClassBase = new CSVUtilsClassBase();

export default csvUtilsClassBase;
export { CSVUtilsClassBase };
