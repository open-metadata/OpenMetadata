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
  Checkbox,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PROPOSAL_LIST_CLASS_NAME,
  PROPOSAL_ROW_CLASS_NAME,
} from './OntologyAiProposal.constants';
import OntologyAiProposalConfidence from './OntologyAiProposalConfidence';
import OntologyAiProposalSection from './OntologyAiProposalSection';
import OntologyAiProposalSource from './OntologyAiProposalSource';
import OntologyAiTermProposalFacts from './OntologyAiTermProposalFacts';
import { OntologyProposalPermissions } from './OntologyExplorer.interface';
import {
  getConfidencePercent,
  getReferenceLabel,
  getRelationLabel,
  ProposedTerm,
} from './utils/ontologyProposals';

interface OntologyAiTermProposalDetailProps {
  readonly isSaving: boolean;
  readonly permissions: OntologyProposalPermissions;
  readonly term: ProposedTerm;
  readonly onApprove: (
    checkedRelationshipKeys: ReadonlySet<string>,
    andEdit: boolean
  ) => void;
  readonly onReject: () => void;
}

const OntologyAiTermProposalDetail = ({
  isSaving,
  permissions,
  term,
  onApprove,
  onReject,
}: OntologyAiTermProposalDetailProps) => {
  const { t } = useTranslation();
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(
    () => new Set(term.relationships.map((item) => item.key))
  );
  const toggle = (key: string, isSelected: boolean) =>
    setCheckedKeys((current) => {
      const next = new Set(current);
      if (isSelected) {
        next.add(key);
      } else {
        next.delete(key);
      }

      return next;
    });

  return (
    <>
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:px-6 tw:pt-5 tw:pb-6">
        {term.node.description ? (
          <Typography as="p" className="tw:text-secondary" size="text-sm">
            {term.node.description}
          </Typography>
        ) : null}

        <div
          className="tw:flex tw:flex-col tw:gap-1.5 tw:rounded-xl tw:border tw:border-utility-purple-200 tw:bg-utility-purple-50 tw:px-3.5 tw:py-3"
          data-testid="ontology-ai-proposal-reason">
          <div className="tw:flex tw:items-center tw:gap-2">
            <span className="tw:min-w-0 tw:flex-1">
              <OntologyAiProposalSource isEmphasized item={term} />
            </span>
            <OntologyAiProposalConfidence withLabel item={term} />
          </div>
          {term.operation.rationale ? (
            <Typography as="p" className="tw:text-secondary" size="text-sm">
              {term.operation.rationale}
            </Typography>
          ) : null}
        </div>

        {term.relationships.length > 0 ? (
          <OntologyAiProposalSection
            count={`${checkedKeys.size}/${term.relationships.length}`}
            hint={t('message.uncheck-proposed-relationship')}
            testId="ontology-ai-term-relationships"
            title={t('label.proposed-relationship-plural')}>
            <ul className={PROPOSAL_LIST_CLASS_NAME}>
              {term.relationships.map((item) => {
                const isOutgoing = item.fromId === term.node.id;
                const itemConfidence = getConfidencePercent(item.operation);

                return (
                  <li className={PROPOSAL_ROW_CLASS_NAME} key={item.key}>
                    <Checkbox
                      aria-label={getRelationLabel(item)}
                      isSelected={checkedKeys.has(item.key)}
                      onChange={(isSelected) => toggle(item.key, isSelected)}
                    />
                    <Badge color="blue" size="sm" type="pill-color">
                      {getRelationLabel(item)}
                    </Badge>
                    <span className="tw:min-w-0 tw:flex-1">
                      <Typography
                        ellipsis
                        as="span"
                        size="text-sm"
                        weight="medium">
                        {getReferenceLabel(isOutgoing ? item.to : item.from)}
                      </Typography>
                    </span>
                    {itemConfidence === undefined ? null : (
                      <Typography
                        as="span"
                        className="tw:text-tertiary"
                        size="text-xs">
                        {itemConfidence}%
                      </Typography>
                    )}
                  </li>
                );
              })}
            </ul>
          </OntologyAiProposalSection>
        ) : null}

        <OntologyAiTermProposalFacts term={term} />
      </div>

      <div className="tw:flex tw:shrink-0 tw:items-center tw:justify-end tw:gap-1.5 tw:border-t tw:border-secondary tw:px-5 tw:py-4">
        <Button
          color="link-gray"
          data-testid="ontology-ai-proposal-dismiss"
          isDisabled={!permissions.canReject || isSaving}
          onPress={onReject}>
          {t('label.dismiss')}
        </Button>
        <Button
          color="secondary"
          data-testid="ontology-ai-proposal-add-and-edit"
          isDisabled={!permissions.canApprove || isSaving}
          onPress={() => onApprove(checkedKeys, true)}>
          {t('label.add-and-edit')}
        </Button>
        <Button
          color="primary"
          data-testid="ontology-ai-proposal-add"
          isDisabled={!permissions.canApprove || isSaving}
          isLoading={isSaving}
          onPress={() => onApprove(checkedKeys, false)}>
          {checkedKeys.size > 0
            ? t('label.add-term-with-link', { count: checkedKeys.size })
            : t('label.add-term')}
        </Button>
      </div>
    </>
  );
};

export default OntologyAiTermProposalDetail;
