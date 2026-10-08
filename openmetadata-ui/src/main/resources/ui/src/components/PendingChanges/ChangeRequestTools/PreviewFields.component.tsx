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
  Button,
  Input,
  NativeSelect,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { pick } from 'lodash';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { getEntityAPIfromSource } from '../../../utils/Assets/AssetsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ClassificationTagPicker from '../../common/ClassificationTagPicker/ClassificationTagPicker';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { MapPatchAPIResponse } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';

/** The fields of an asset the form edits; everything else is left as it is. */
interface Draft {
  name?: string;
  displayName?: string;
  description?: string;
  tags?: TagLabel[];
  owners?: EntityReference[];
  reviewers?: EntityReference[];
  domains?: EntityReference[];
}

const FORM_FIELDS: (keyof Draft)[] = [
  'name',
  'displayName',
  'description',
  'tags',
  'owners',
  'reviewers',
  'domains',
];
const REVIEWED_TYPES = new Set<string>([
  EntityType.GLOSSARY,
  EntityType.GLOSSARY_TERM,
]);
const TIER_PREFIX = 'Tier.';
const TIERS = ['Tier1', 'Tier2', 'Tier3', 'Tier4', 'Tier5'].map(
  (tier) => `${TIER_PREFIX}${tier}`
);
const NO_TIER = '';

const isTier = (tag: TagLabel) => tag.tagFQN.startsWith(TIER_PREFIX);
const isClassification = (tag: TagLabel) =>
  tag.source === TagSource.Classification;

const tierLabel = (tagFQN: string): TagLabel => ({
  tagFQN,
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
});

// The relation fields an asset of this type has, so the read asks only for those.
const fieldsOf = (entityType: string) =>
  [
    'tags',
    'owners',
    REVIEWED_TYPES.has(entityType) ? 'reviewers' : null,
    entityType === EntityType.DOMAIN ? null : 'domains',
  ]
    .filter(Boolean)
    .join(',');

const names = (refs?: EntityReference[]) =>
  (refs ?? []).map((ref) => ref.displayName || ref.name || ref.id).join(', ');

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="tw:flex tw:flex-col tw:gap-1.5">
    <Typography as="span" size="text-sm" weight="medium">
      {label}
    </Typography>
    {children}
  </div>
);

const PickerTrigger = ({ text, testId }: { text: string; testId: string }) => (
  <Button
    className="tw:w-full tw:justify-start"
    color="secondary"
    data-testid={testId}
    size="sm">
    {text}
  </Button>
);

// Owners, reviewers where the asset has them, and domains.
const PeoplePickers = ({
  draft,
  entityType,
  update,
}: {
  draft: Draft;
  entityType: string;
  update: (changes: Draft) => void;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Field label={t('label.owner-plural')}>
        <UserTeamSelectableList
          hasPermission
          multiple={{ user: true, team: true }}
          owner={draft.owners ?? []}
          onUpdate={(owners) => update({ owners: owners ?? [] })}>
          <PickerTrigger testId="preview-owners" text={names(draft.owners)} />
        </UserTeamSelectableList>
      </Field>
      {REVIEWED_TYPES.has(entityType) && (
        <Field label={t('label.reviewer-plural')}>
          <UserTeamSelectableList
            hasPermission
            multiple={{ user: true, team: true }}
            owner={draft.reviewers ?? []}
            onUpdate={(reviewers) => update({ reviewers: reviewers ?? [] })}>
            <PickerTrigger
              testId="preview-reviewers"
              text={names(draft.reviewers)}
            />
          </UserTeamSelectableList>
        </Field>
      )}
      {entityType !== EntityType.DOMAIN && (
        <Field label={t('label.domain-plural')}>
          <DomainSelectableList
            fullWidthTrigger
            hasPermission
            isClearable
            multiple
            className="tw:w-full"
            selectedDomain={draft.domains ?? []}
            onUpdate={async (domains) =>
              update({ domains: [domains ?? []].flat() })
            }>
            <PickerTrigger
              testId="preview-domains"
              text={names(draft.domains)}
            />
          </DomainSelectableList>
        </Field>
      )}
    </>
  );
};

interface PreviewFieldsProps {
  entityType: string;
  entityFqn: string;
  /** Called with the JSON patch the edited fields make to the asset as published. */
  onPatch: (operations: Operation[]) => void;
}

/**
 * The common fields of an asset as published, to edit without saving: name, display name,
 * description, tags, tier, owners, reviewers where the asset has them, and domains. The edits are
 * reported as the JSON patch saving them would send.
 */
const PreviewFields = ({
  entityType,
  entityFqn,
  onPatch,
}: PreviewFieldsProps) => {
  const { t } = useTranslation();
  const [published, setPublished] = useState<Draft>();
  const [draft, setDraft] = useState<Draft>({});

  useEffect(() => {
    getEntityAPIfromSource(entityType as keyof MapPatchAPIResponse)(entityFqn, {
      fields: fieldsOf(entityType),
    })
      .then((entity) => {
        const fields = pick(entity, FORM_FIELDS) as Draft;
        setPublished(fields);
        setDraft(fields);
      })
      .catch((error) => showErrorToast(error as AxiosError));
  }, [entityType, entityFqn]);

  useEffect(() => {
    if (published) {
      onPatch(compare(published, draft));
    }
  }, [published, draft]);

  if (!published) {
    return null;
  }

  const tags = draft.tags ?? [];
  const tier = tags.find(isTier)?.tagFQN ?? NO_TIER;
  const update = (changes: Draft) =>
    setDraft((current) => ({ ...current, ...changes }));
  const setTags = (classification: TagLabel[], tierFQN: string) =>
    update({
      tags: [
        ...tags.filter((tag) => !isClassification(tag)),
        ...classification.filter((tag) => !isTier(tag)),
        ...(tierFQN ? [tierLabel(tierFQN)] : []),
      ],
    });

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="change-request-preview-fields">
      <Field label={t('label.name')}>
        <Input
          inputDataTestId="preview-name"
          size="sm"
          value={draft.name ?? ''}
          onChange={(name) => update({ name })}
        />
      </Field>
      <Field label={t('label.display-name')}>
        <Input
          inputDataTestId="preview-display-name"
          size="sm"
          value={draft.displayName ?? ''}
          onChange={(displayName) => update({ displayName })}
        />
      </Field>
      <Field label={t('label.description')}>
        <TextArea
          aria-label={t('label.description')}
          rows={4}
          value={draft.description ?? ''}
          onChange={(description) => update({ description })}
        />
      </Field>
      <ClassificationTagPicker
        data-testid="preview-tags"
        label={t('label.tag-plural')}
        value={tags.filter((tag) => isClassification(tag) && !isTier(tag))}
        onChange={(picked) => setTags(picked, tier)}
      />
      <Field label={t('label.tier')}>
        <NativeSelect
          data-testid="preview-tier"
          options={[
            { label: t('label.none'), value: NO_TIER },
            ...TIERS.map((tierFQN) => ({
              label: tierFQN.slice(TIER_PREFIX.length),
              value: tierFQN,
            })),
          ]}
          value={tier}
          onChange={(event) =>
            setTags(
              tags.filter((tag) => isClassification(tag)),
              event.target.value
            )
          }
        />
      </Field>
      <PeoplePickers draft={draft} entityType={entityType} update={update} />
    </div>
  );
};

export default PreviewFields;
