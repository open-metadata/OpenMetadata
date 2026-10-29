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
  BadgeWithDot,
  Button,
  ButtonUtility,
  Input,
  Select,
  SelectItemType,
  SlideoutMenu,
  TextArea,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { addGlossaryTerm } from '../../rest/glossaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { ONTOLOGY_DRAWER_WIDTH } from './OntologyExplorer.constants';
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

function getRequiredHint(
  isMissing: boolean | undefined,
  message: string
): string | undefined {
  return isMissing ? message : undefined;
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
  const [iriError, setIriError] = useState<string>();
  const [isCreating, setIsCreating] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) =>
    setTouched((previous) => ({ ...previous, [field]: true }));
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
  const nameHint = getRequiredHint(
    touched.name && !name.trim(),
    t('label.field-required', { field: nameLabel })
  );
  const descriptionHint = getRequiredHint(
    touched.description && !description.trim(),
    t('label.field-required', { field: descriptionLabel })
  );
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
    <SlideoutMenu
      isDismissable
      isOpen
      aria-label={t('label.new-entity', { entity: t('label.concept') })}
      dialogClassName="tw:gap-0 tw:items-stretch"
      width={ONTOLOGY_DRAWER_WIDTH}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}>
      <form
        className="tw:flex tw:size-full tw:min-h-0 tw:flex-col"
        data-testid="ontology-concept-draft-inspector"
        onSubmit={handleFormSubmit}>
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-6 tw:pt-5 tw:pb-8">
          <div className="tw:flex tw:items-center tw:gap-1.5">
            <BadgeWithDot color="brand" size="sm" type="color">
              {t('label.concept')}
            </BadgeWithDot>
            <Badge color="gray" size="sm" type="color">
              {t('label.draft')}
            </Badge>
            <span className="tw:flex-1" />
            <ButtonUtility
              color="tertiary"
              data-testid="ontology-draft-close"
              icon={XClose}
              size="lg"
              tooltip={t('label.close')}
              onClick={onCancel}
            />
          </div>
          <h2 className="tw:m-0 tw:mt-3 tw:text-md tw:font-semibold tw:text-primary">
            {node.label}
          </h2>

          <section className="tw:mt-4 tw:flex tw:flex-col tw:gap-4">
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
              placeholder={t('message.concept-name-placeholder')}
              value={name}
              onChange={(value) => {
                markTouched('name');
                setName(value);
                const label = getDraftLabel(value, displayName, node.label);
                onChange({ label, originalLabel: label });
              }}
            />
            <Input
              data-testid="ontology-draft-display-name-field"
              label={t('label.display-name')}
              placeholder={t('message.concept-display-name-placeholder')}
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
              placeholder={t('message.concept-description-placeholder')}
              rows={4}
              value={description}
              onChange={(value) => {
                markTouched('description');
                setDescription(value);
                onChange({ description: value });
              }}
            />
            <Input
              data-testid="ontology-draft-iri-field"
              hint={iriError}
              isInvalid={Boolean(iriError)}
              label={t('label.concept-iri')}
              placeholder={t('message.concept-iri-placeholder')}
              value={iri}
              onChange={(value) => {
                setIri(value);
                setIriError(undefined);
              }}
            />
          </section>
        </div>

        <div className="tw:flex tw:shrink-0 tw:justify-end tw:gap-2 tw:border-t tw:border-secondary tw:p-4">
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
    </SlideoutMenu>
  );
};

export default OntologyConceptDraftInspector;
