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
    ButtonUtility,
    SlideoutMenu,
    Tabs,
    Typography
} from '@openmetadata/ui-core-components';
import {
    ArrowLeft,
    AskCollateSparkle,
    ChevronLeft,
    ChevronRight,
    XClose
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../generated/entity/data/ontologyChangeSet';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import OntologyAiProposalConfidence from './OntologyAiProposalConfidence';
import OntologyAiProposalSource from './OntologyAiProposalSource';
import OntologyAiRelationshipProposalDetail from './OntologyAiRelationshipProposalDetail';
import OntologyAiTermProposalDetail from './OntologyAiTermProposalDetail';
import { ONTOLOGY_DRAWER_WIDTH } from './OntologyExplorer.constants';
import {
    AiProposalTab,
    AiProposalView,
    OntologyProposalPermissions
} from './OntologyExplorer.interface';
import {
    getProposalQueue,
    getReferenceLabel,
    getRelationLabel,
    OntologyProposal,
    OntologyProposals,
    ProposedRelationship,
    ProposedTerm
} from './utils/ontologyProposals';

interface OntologyAiProposalsPanelProps {
  readonly isSaving: boolean;
  readonly permissions: OntologyProposalPermissions;
  readonly proposals: OntologyProposals;
  readonly relationTypes: RelationshipType[];
  readonly view: AiProposalView;
  readonly onApplyAllRelationships: () => void;
  readonly onApplyAllTerms: () => void;
  readonly onApplyRelationship: (
    relationship: ProposedRelationship,
    relationshipType: EntityReference
  ) => void;
  readonly onApplyTerm: (
    term: ProposedTerm,
    checkedRelationshipKeys: ReadonlySet<string>,
    andEdit: boolean
  ) => void;
  readonly onClose: () => void;
  readonly onRejectRelationship: (relationship: ProposedRelationship) => void;
  readonly onRejectTerm: (term: ProposedTerm) => void;
  readonly onSelectTerm: (nodeId: string) => void;
  readonly onViewChange: (view: AiProposalView) => void;
}

const CARD_CLASS_NAME =
  'tw:w-full tw:items-start tw:justify-start tw:gap-3 tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-4 tw:text-left tw:*:data-text:w-full';

const OntologyAiProposalsPanel = ({
  isSaving,
  permissions,
  proposals,
  relationTypes,
  view,
  onApplyAllRelationships,
  onApplyAllTerms,
  onApplyRelationship,
  onApplyTerm,
  onClose,
  onRejectRelationship,
  onRejectTerm,
  onSelectTerm,
  onViewChange,
}: OntologyAiProposalsPanelProps) => {
  const { t } = useTranslation();
  const queue = getProposalQueue(proposals);
  const index =
    view.kind === 'item'
      ? queue.findIndex((item) => item.key === view.key)
      : -1;
  const current = index >= 0 ? queue[index] : undefined;
  const openList = (tab: AiProposalTab) => onViewChange({ kind: 'list', tab });
  const openItem = (item: OntologyProposal) =>
    onViewChange({ key: item.key, kind: 'item' });

  const renderTermCard = (term: ProposedTerm) => (
    <li key={term.key}>
      <Button
        noTextPadding
        className={CARD_CLASS_NAME}
        color="tertiary"
        data-testid={`ontology-ai-term-card-${term.key}`}
        onPress={() => openItem(term)}>
        <span className="tw:flex tw:w-full tw:items-start tw:gap-3">
          <span className="tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-dashed tw:border-utility-purple-400 tw:bg-utility-purple-50">
            <AskCollateSparkle aria-hidden className="tw:size-4" />
          </span>
          <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
            <span className="tw:flex tw:items-center tw:gap-2">
              <span className="tw:min-w-0 tw:flex-1">
                <Typography ellipsis as="span" size="text-sm" weight="medium">
                  {term.node.label}
                </Typography>
              </span>
              <OntologyAiProposalConfidence item={term} />
            </span>
            <Typography as="span" className="tw:text-tertiary" size="text-xs">
              {[
                t('label.count-relationship', {
                  count: term.relationships.length,
                }),
                t('label.count-property', { count: term.properties.length }),
                term.node.group,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
            <span className="tw:mt-1">
              <OntologyAiProposalSource item={term} />
            </span>
          </span>
          <ChevronRight
            aria-hidden
            className="tw:mt-1 tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
          />
        </span>
      </Button>
    </li>
  );

  const renderRelationshipCard = (relationship: ProposedRelationship) => (
    <li key={relationship.key}>
      <Button
        noTextPadding
        className={CARD_CLASS_NAME}
        color="tertiary"
        data-testid={`ontology-ai-relationship-card-${relationship.key}`}
        onPress={() => openItem(relationship)}>
        <span className="tw:flex tw:w-full tw:items-start tw:gap-3">
          <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
            <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              <Typography as="span" size="text-sm" weight="medium">
                {getReferenceLabel(relationship.from)}
              </Typography>
              <Badge color="blue" size="sm" type="pill-color">
                {getRelationLabel(relationship)}
              </Badge>
              <Typography as="span" size="text-sm" weight="medium">
                {getReferenceLabel(relationship.to)}
              </Typography>
              <span className="tw:flex-1" />
              <OntologyAiProposalConfidence item={relationship} />
            </span>
            <OntologyAiProposalSource item={relationship} />
          </span>
          <ChevronRight
            aria-hidden
            className="tw:mt-1 tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
          />
        </span>
      </Button>
    </li>
  );

  const renderList = (tab: AiProposalTab) => {
    const isTerms = tab === 'terms';
    const items = isTerms ? proposals.terms : proposals.relationships;

    return (
      <>
        <div className="tw:flex tw:shrink-0 tw:flex-col tw:gap-4 tw:border-b tw:border-secondary tw:px-6 tw:pt-5 tw:pb-4">
          <div className="tw:flex tw:items-center tw:gap-3">
            <span className="tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-utility-purple-200 tw:bg-utility-purple-50">
              <AskCollateSparkle aria-hidden className="tw:size-4" />
            </span>
            <Typography as="span" size="text-md" weight="semibold">
              {t('label.ai-proposal-plural')}
            </Typography>
            <Badge color="purple" size="sm" type="pill-color">
              {queue.length}
            </Badge>
            <span className="tw:flex-1" />
            <ButtonUtility
              color="tertiary"
              data-testid="ontology-ai-proposals-close"
              icon={XClose}
              size="sm"
              tooltip={t('label.close')}
              onClick={onClose}
            />
          </div>
          <Typography as="p" className="tw:text-tertiary" size="text-sm">
            {t('message.ai-proposals-description')}
          </Typography>
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => openList(key as AiProposalTab)}>
            <Tabs.List fullWidth size="sm" type="button-border">
              <Tabs.Item
                badge={proposals.terms.length}
                id="terms"
                label={t('label.new-term-plural')}
              />
              <Tabs.Item
                badge={proposals.relationships.length}
                id="relationships"
                label={t('label.relationship-plural')}
              />
            </Tabs.List>
            <Tabs.Panel className="tw:hidden" id="terms" />
            <Tabs.Panel className="tw:hidden" id="relationships" />
          </Tabs>
        </div>
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-6 tw:pt-4 tw:pb-6">
          {items.length === 0 ? (
            <div className="tw:flex tw:min-h-14 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-dashed tw:border-primary tw:px-4 tw:py-3">
              <Typography className="tw:text-tertiary" size="text-sm">
                {isTerms
                  ? t('message.no-term-proposal-left')
                  : t('message.no-relationship-proposal-left')}
              </Typography>
            </div>
          ) : (
            <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0">
              {isTerms
                ? proposals.terms.map(renderTermCard)
                : proposals.relationships.map(renderRelationshipCard)}
            </ul>
          )}
        </div>
        {items.length > 0 ? (
          <div className="tw:flex tw:shrink-0 tw:justify-end tw:border-t tw:border-secondary tw:px-6 tw:py-4">
            <Button
              color="primary"
              data-testid="ontology-ai-proposals-apply-all"
              isDisabled={!permissions.canApprove || isSaving}
              isLoading={isSaving}
              onPress={isTerms ? onApplyAllTerms : onApplyAllRelationships}>
              {isTerms
                ? t('label.add-all-count', { count: items.length })
                : t('label.accept-all-count', { count: items.length })}
            </Button>
          </div>
        ) : null}
      </>
    );
  };

  const renderItemHeader = (item: OntologyProposal) => (
    <div className="tw:flex tw:shrink-0 tw:flex-col tw:gap-1 tw:border-b tw:border-secondary tw:px-6 tw:pt-5 tw:pb-4">
      <div className="tw:flex tw:items-center tw:gap-2">
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-ai-proposal-back"
          icon={ArrowLeft}
          size="sm"
          tooltip={t('label.back')}
          onClick={() =>
            openList(item.kind === 'term' ? 'terms' : 'relationships')
          }
        />
        <Typography ellipsis as="span" size="text-md" weight="semibold">
          {item.kind === 'term' ? item.node.label : t('label.relationship')}
        </Typography>
        <Badge color="purple" size="sm" type="color">
          {t('label.new')}
        </Badge>
        <span className="tw:flex-1" />
        <Typography
          as="span"
          className="tw:whitespace-nowrap tw:text-tertiary"
          size="text-xs">
          {t('label.current-of-total', {
            current: index + 1,
            total: queue.length,
          })}
        </Typography>
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-ai-proposal-previous"
          icon={ChevronLeft}
          isDisabled={index <= 0}
          size="sm"
          tooltip={t('label.previous')}
          onClick={() => openItem(queue[index - 1])}
        />
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-ai-proposal-next"
          icon={ChevronRight}
          isDisabled={index >= queue.length - 1}
          size="sm"
          tooltip={t('label.next')}
          onClick={() => openItem(queue[index + 1])}
        />
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-ai-proposals-close"
          icon={XClose}
          size="sm"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </div>
      {item.kind === 'term' ? (
        <Typography as="p" className="tw:pl-9 tw:text-tertiary" size="text-xs">
          {item.node.fullyQualifiedName}
          <span className="tw:mx-2 tw:text-quaternary">|</span>
          <span className="tw:font-medium tw:text-utility-purple-700">
            {t('label.proposed-term')}
          </span>
        </Typography>
      ) : null}
    </div>
  );

  const renderItem = (item: OntologyProposal) => (
    <>
      {renderItemHeader(item)}
      {item.kind === 'term' ? (
        <OntologyAiTermProposalDetail
          isSaving={isSaving}
          key={item.key}
          permissions={permissions}
          term={item}
          onApprove={(checked, andEdit) => onApplyTerm(item, checked, andEdit)}
          onReject={() => onRejectTerm(item)}
        />
      ) : (
        <OntologyAiRelationshipProposalDetail
          isSaving={isSaving}
          key={item.key}
          permissions={permissions}
          relationTypes={relationTypes}
          relationship={item}
          onApprove={(type) => onApplyRelationship(item, type)}
          onReject={() => onRejectRelationship(item)}
          onSelectTerm={onSelectTerm}
        />
      )}
    </>
  );

  // An item that was just decided drops out of the queue; fall back to a list.
  const fallbackTab: AiProposalTab =
    proposals.terms.length > 0 ? 'terms' : 'relationships';
  const listTab = view.kind === 'list' ? view.tab : fallbackTab;

  return (
    <SlideoutMenu
      isDismissable
      isOpen
      aria-label={t('label.ai-proposal-plural')}
      dialogClassName="tw:gap-0 tw:items-stretch"
      width={ONTOLOGY_DRAWER_WIDTH}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <div
        className="tw:flex tw:size-full tw:min-h-0 tw:flex-col"
        data-testid="ontology-ai-proposals-panel">
        {current ? renderItem(current) : renderList(listTab)}
      </div>
    </SlideoutMenu>
  );
};

export default OntologyAiProposalsPanel;
