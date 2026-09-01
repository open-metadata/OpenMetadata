/*
 *  Copyright 2026 Collate.
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

import {
  Badge,
  Button,
  Input,
  Select,
  SelectItemType,
  TextArea,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { OntologyAttribute } from '../../generated/type/ontologyAttribute';
import { addGlossaryTerm } from '../../rest/glossaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { OntologyConceptAttributes } from './OntologyConceptAttributes.component';
import { OntologyNode } from './OntologyExplorer.interface';

type DraftNodeUpdate = Partial<
  Pick<
    OntologyNode,
    'description' | 'glossaryId' | 'group' | 'label' | 'originalLabel'
  >
>;

interface OntologyConceptDraftInspectorProps {
  readonly glossaries: Glossary[];
  readonly isLeaseOwned: boolean;
  readonly node: OntologyNode;
  readonly onCancel: () => void;
  readonly onChange: (update: DraftNodeUpdate) => void;
  readonly onCreated: (concept: GlossaryTerm) => void;
}

function getDraftLabel(
  name: string,
  displayName: string,
  fallback: string
): string {
  return displayName.trim() || name.trim() || fallback;
}

const OntologyConceptDraftInspector = ({
  glossaries,
  isLeaseOwned,
  node,
  onCancel,
  onChange,
  onCreated,
}: OntologyConceptDraftInspectorProps) => {
  const { t } = useTranslation();
  const [glossaryId, setGlossaryId] = useState(node.glossaryId ?? '');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [iri, setIri] = useState('');
  const [attributes, setAttributes] = useState<OntologyAttribute[]>([]);
  const [iriError, setIriError] = useState<string>();
  const [isCreating, setIsCreating] = useState(false);
  const glossaryItems = useMemo<SelectItemType[]>(
    () =>
      glossaries.map((glossary) => ({
        id: glossary.id,
        label: glossary.displayName ?? glossary.name,
      })),
    [glossaries]
  );
  const selectedGlossary = useMemo(
    () => glossaries.find((glossary) => glossary.id === glossaryId),
    [glossaries, glossaryId]
  );
  const glossaryLabel = t('label.glossary');
  const nameLabel = t('label.name');
  const descriptionLabel = t('label.description');
  let glossaryHint: string | undefined;
  if (!glossaryId) {
    glossaryHint = t('label.field-required', { field: glossaryLabel });
  } else if (!isLeaseOwned) {
    glossaryHint = t('label.loading');
  }
  const nameHint = name.trim()
    ? undefined
    : t('label.field-required', { field: nameLabel });
  const descriptionHint = description.trim()
    ? undefined
    : t('label.field-required', { field: descriptionLabel });
  const isComplete = Boolean(
    selectedGlossary && name.trim() && description.trim() && isLeaseOwned
  );

  const handleSubmit = async () => {
    if (!selectedGlossary || !isComplete) {
      return;
    }

    const normalizedIri = iri.trim();
    if (normalizedIri) {
      try {
        new URL(normalizedIri);
      } catch {
        setIriError(t('message.invalid-concept-iri'));

        return;
      }
    }

    setIsCreating(true);
    try {
      const concept = await addGlossaryTerm({
        ...(attributes.length ? { attributes } : {}),
        description: description.trim(),
        displayName: displayName.trim() || undefined,
        glossary: selectedGlossary.fullyQualifiedName ?? selectedGlossary.name,
        iri: normalizedIri || undefined,
        name: name.trim(),
      });
      showSuccessToast(
        `${concept.displayName ?? concept.name} ${t(
          'message.has-been-created-successfully'
        )}`
      );
      onCreated(concept);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsCreating(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSubmit();
  };

  return (
    <aside
      className="tw:z-4 tw:h-full tw:w-[360px] tw:max-w-[40vw] tw:shrink-0 tw:overflow-hidden tw:border-l tw:border-secondary tw:bg-primary"
      data-testid="ontology-concept-draft-inspector">
      <form
        className="tw:flex tw:h-full tw:min-h-0 tw:flex-col"
        onSubmit={handleFormSubmit}>
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-[18px]">
          <div className="tw:mb-2 tw:flex tw:items-center tw:justify-between tw:gap-2">
            <span className="tw:font-body tw:text-[10px] tw:leading-normal tw:font-semibold tw:tracking-[0.08em] tw:text-quaternary tw:uppercase">
              {t('label.concept')}
            </span>
            <Badge color="blue" size="sm" type="color">
              {t('label.draft')}
            </Badge>
          </div>
          <h2 className="tw:m-0 tw:font-body tw:text-[17px] tw:leading-[1.25] tw:font-bold tw:text-primary">
            {node.label}
          </h2>

          <section className="tw:mt-5 tw:flex tw:flex-col tw:gap-4">
            <h3 className="tw:m-0 tw:font-body tw:text-[13px] tw:leading-normal tw:font-semibold tw:text-primary">
              {t('label.details')}
            </h3>
            <Select
              isRequired
              aria-label={glossaryLabel}
              data-testid="ontology-draft-glossary-field"
              hint={glossaryHint}
              isInvalid={!glossaryId}
              items={glossaryItems}
              label={glossaryLabel}
              placeholder={t('label.select-entity', {
                entity: glossaryLabel,
              })}
              value={glossaryId || null}
              onChange={(key) => {
                const nextGlossaryId = String(key ?? '');
                const glossary = glossaries.find(
                  (item) => item.id === nextGlossaryId
                );
                setGlossaryId(nextGlossaryId);
                onChange({
                  glossaryId: nextGlossaryId || undefined,
                  group: glossary?.displayName ?? glossary?.name,
                });
              }}>
              {(item) => (
                <Select.Item id={item.id} key={item.id} label={item.label} />
              )}
            </Select>
            <Input
              isRequired
              data-testid="ontology-draft-name-field"
              hint={nameHint}
              isInvalid={Boolean(nameHint)}
              label={nameLabel}
              value={name}
              onChange={(value) => {
                setName(value);
                const label = getDraftLabel(value, displayName, node.label);
                onChange({ label, originalLabel: label });
              }}
            />
            <Input
              data-testid="ontology-draft-display-name-field"
              label={t('label.display-name')}
              value={displayName}
              onChange={(value) => {
                setDisplayName(value);
                const label = getDraftLabel(name, value, node.label);
                onChange({ label, originalLabel: label });
              }}
            />
            <TextArea
              isRequired
              data-testid="ontology-draft-description-field"
              hint={descriptionHint}
              isInvalid={Boolean(descriptionHint)}
              label={descriptionLabel}
              rows={4}
              value={description}
              onChange={(value) => {
                setDescription(value);
                onChange({ description: value });
              }}
            />
            <Input
              data-testid="ontology-draft-iri-field"
              hint={iriError}
              isInvalid={Boolean(iriError)}
              label={t('label.concept-iri')}
              value={iri}
              onChange={(value) => {
                setIri(value);
                setIriError(undefined);
              }}
            />
          </section>

          <div className="tw:my-[18px] tw:h-px tw:bg-secondary" />
          <OntologyConceptAttributes
            isEditMode
            attributes={attributes}
            variant="inspector"
            onAttributesChange={setAttributes}
          />
        </div>

        <div className="tw:flex tw:shrink-0 tw:justify-end tw:gap-2 tw:border-t tw:border-secondary tw:bg-primary tw:p-4">
          <Button
            color="secondary"
            isDisabled={isCreating}
            size="sm"
            onPress={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            data-testid="ontology-draft-save"
            isDisabled={!isComplete}
            isLoading={isCreating}
            size="sm"
            type="submit">
            {t('label.add-entity', { entity: t('label.concept') })}
          </Button>
        </div>
      </form>
    </aside>
  );
};

export default OntologyConceptDraftInspector;
