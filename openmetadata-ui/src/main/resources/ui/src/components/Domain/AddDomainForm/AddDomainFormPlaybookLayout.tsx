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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Alert,
  Avatar,
  Box,
  Button,
  FieldProp,
  getField,
  Typography,
} from '@openmetadata/ui-core-components';
import { ReactNode, useMemo, useState } from 'react';
import { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  CheckType,
  OnboardingPlaybook,
  Requirement,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import {
  IntakeFormField,
  TargetEntityType,
} from '../../../generated/governance/intakeForm';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { ONBOARDING_STAGE } from '../../../utils/governance/onboarding/Onboarding.constants';
import {
  conditionalTriggers,
  CREATION_FIELDS,
  stepsAtStage,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import {
  dtypeOf,
  DTYPE_LABEL_KEY,
} from '../../../utils/governance/onboarding/OnboardingField.utils';
import { assigneeInitials } from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import { CreationCheckBlock } from '../../governance/onboarding/CreationCheckBlock';
import { DomainFormType } from '../DomainPage.interface';
import { DomainFormValues } from './AddDomainForm.interface';
import AddDomainFormExtensionFields from './AddDomainFormExtensionFields';

export interface PlaybookLayoutProps {
  playbook: OnboardingPlaybook | null | undefined;
  customProperties: CustomProperty[];
  customPropertiesLoaded: boolean;
  /** Every field of the form, keyed by the path a check names it with. */
  fields: Record<string, FieldProp | null>;
  descriptionNode: ReactNode;
  glossaryTermsNode: ReactNode;
  extensionFields: IntakeFormField[];
  control: Control<DomainFormValues>;
  formType: DomainFormType;
  entityType: TargetEntityType | null;
  hasParentDomain: boolean;
  /** The create payload as it currently stands, for evaluating conditions. */
  values: unknown;
}

/** What to call a field the API insists on that no check in the playbook claims. */
const INTRINSIC_LABEL_KEYS: Record<string, string> = {
  description: 'label.description',
  domainType: 'label.domain-type',
  domains: 'label.domain',
  glossary: 'label.glossary',
  name: 'label.name',
};

/** Fields that never belong to a check: the asset's looks, not its governance. */
const PRESENTATION_PATHS = ['coverImage', 'icon', 'color'];

/**
 * The owners block reads as a row rather than a picker: the producer is the owner by default, and
 * the picker only opens when they want to hand it to someone else.
 */
const OwnersCheckRow = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const name = currentUser ? getEntityName(currentUser) : '';

  return (
    <Box className="tw:gap-2" direction="col">
      {currentUser && (
        <Box
          align="center"
          className="tw:gap-2.5 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:px-3 tw:py-2.5"
          data-testid="creation-owner-row">
          <Avatar alt={name} initials={assigneeInitials(name)} size="xs" />
          <Typography className="tw:flex-1" size="text-sm">
            {t('label.entity-you', { entity: name })}
          </Typography>
          {!isPickerOpen && (
            <Button
              color="link-color"
              data-testid="creation-owner-add"
              size="sm"
              onPress={() => setPickerOpen(true)}>
              {t('label.add')}
            </Button>
          )}
        </Box>
      )}
      {(isPickerOpen || !currentUser) && children}
    </Box>
  );
};

/** Which of the form's fields this asset type actually asks for. */
const visiblePaths = (
  formType: DomainFormType,
  hasParentDomain: boolean
): string[] => {
  const isDataProduct = formType === DomainFormType.DATA_PRODUCT;
  const isDomain =
    formType === DomainFormType.DOMAIN || formType === DomainFormType.SUBDOMAIN;
  const paths = [
    'name',
    'displayName',
    'description',
    'tags',
    'glossaryTerms',
    'owners',
    'experts',
    ...PRESENTATION_PATHS,
  ];
  if (isDomain) {
    paths.push('domainType');
  }
  if (isDataProduct) {
    paths.push(
      'dataProductType',
      'visibility',
      'portfolioPriority',
      'reviewers'
    );
    if (!hasParentDomain) {
      paths.push('domains');
    }
  }

  return paths;
};

/**
 * The Creation gate as a form: one block per check, in the order the playbook asks for them, with
 * everything else folded away. The card around it belongs to the page, which owns the footer that
 * says what is still missing.
 */
export const AddDomainFormPlaybookLayout = ({
  playbook,
  customProperties,
  customPropertiesLoaded,
  fields,
  descriptionNode,
  glossaryTermsNode,
  extensionFields,
  control,
  formType,
  entityType,
  hasParentDomain,
  values,
}: PlaybookLayoutProps) => {
  const { t } = useTranslation();

  const nodes = useMemo(() => {
    const rendered: Record<string, ReactNode> = {
      description: descriptionNode,
      glossaryTerms: glossaryTermsNode,
    };
    visiblePaths(formType, hasParentDomain).forEach((path) => {
      const field = fields[path];
      if (field) {
        rendered[path] = getField(field);
      }
    });
    extensionFields.forEach((field) => {
      rendered[field.fieldPath] = customPropertiesLoaded ? (
        <AddDomainFormExtensionFields
          control={control}
          customProperties={customProperties}
          formFields={[field]}
        />
      ) : null;
    });

    return rendered;
  }, [
    control,
    customProperties,
    customPropertiesLoaded,
    descriptionNode,
    extensionFields,
    fields,
    formType,
    glossaryTermsNode,
    hasParentDomain,
  ]);

  const steps = stepsAtStage(
    playbook ?? { onboarding: undefined },
    ONBOARDING_STAGE.CREATION
  ).filter((step) => step.fieldPath && nodes[step.fieldPath]);
  const claimed = new Set(steps.map((step) => step.fieldPath));
  const intrinsic = (entityType ? CREATION_FIELDS[entityType] : []).filter(
    (path) => !claimed.has(path) && nodes[path]
  );
  const optional = Object.keys(nodes).filter(
    (path) => !claimed.has(path) && !intrinsic.includes(path)
  );
  const triggers = conditionalTriggers(
    playbook,
    ONBOARDING_STAGE.DRAFT,
    values
  );

  return (
    <Box className="tw:gap-5" data-testid="creation-gate-form" direction="col">
      {intrinsic.map((path) => (
        <CreationCheckBlock
          dtypeLabelKey={
            DTYPE_LABEL_KEY[
              dtypeOf({ fieldPath: path, type: CheckType.Attribute })
            ]
          }
          fieldPath={path}
          key={path}
          requirement={Requirement.Blocking}
          title={t(INTRINSIC_LABEL_KEYS[path] ?? 'label.field')}>
          {nodes[path]}
        </CreationCheckBlock>
      ))}
      {steps.map((step) => {
        const path = step.fieldPath as string;

        return (
          <CreationCheckBlock
            dtypeLabelKey={DTYPE_LABEL_KEY[dtypeOf(step, customProperties)]}
            fieldPath={path}
            guidance={step.guidance}
            key={step.id}
            requirement={step.requirement}
            title={step.title ?? path}>
            {path === 'owners' ? (
              <OwnersCheckRow>{nodes[path]}</OwnersCheckRow>
            ) : (
              nodes[path]
            )}
          </CreationCheckBlock>
        );
      })}
      {triggers.map((trigger) => (
        <Alert
          data-testid="creation-conditional-notice"
          key={trigger.value}
          title={t('message.picking-adds-conditional-checks', {
            count: trigger.steps.length,
            titles: trigger.steps
              .map((step) => step.title ?? step.fieldPath)
              .join(', '),
            value: trigger.value,
          })}
          variant="warning"
        />
      ))}
      <Accordion>
        <AccordionItem id="optional-details">
          <AccordionHeader data-testid="optional-details">
            <Typography size="text-sm" weight="semibold">
              {t('label.optional-detail-plural')}
            </Typography>
          </AccordionHeader>
          <AccordionPanel>
            <Box className="tw:gap-5 tw:p-4" direction="col">
              {optional.map((path) => (
                <div key={path}>{nodes[path]}</div>
              ))}
            </Box>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Box>
  );
};
