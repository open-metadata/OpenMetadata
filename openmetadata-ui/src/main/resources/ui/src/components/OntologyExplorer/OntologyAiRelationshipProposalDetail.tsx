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
  Select,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AskCollateSparkle,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../generated/entity/data/ontologyChangeSet';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import OntologyAiProposalConfidence from './OntologyAiProposalConfidence';
import OntologyAiProposalSource from './OntologyAiProposalSource';
import { OntologyProposalPermissions } from './OntologyExplorer.interface';
import {
  getReferenceLabel,
  ProposedRelationship,
} from './utils/ontologyProposals';

interface OntologyAiRelationshipProposalDetailProps {
  readonly isSaving: boolean;
  readonly permissions: OntologyProposalPermissions;
  readonly relationship: ProposedRelationship;
  readonly relationTypes: RelationshipType[];
  readonly onApprove: (relationshipType: EntityReference) => void;
  readonly onReject: () => void;
  readonly onSelectTerm: (nodeId: string) => void;
}

const OntologyAiRelationshipProposalDetail = ({
  isSaving,
  permissions,
  relationship,
  relationTypes,
  onApprove,
  onReject,
  onSelectTerm,
}: OntologyAiRelationshipProposalDetailProps) => {
  const { t } = useTranslation();
  const proposedType = relationship.operation.relationship
    ?.relationshipType as EntityReference;
  const [typeId, setTypeId] = useState(proposedType.id);
  const typeItems = useMemo<SelectItemType[]>(
    () =>
      relationTypes.map((type) => ({
        id: type.id,
        label: type.displayName ?? type.name,
      })),
    [relationTypes]
  );
  const selectedType = relationTypes.find((type) => type.id === typeId);

  const renderEnd = (nodeId: string, ref: EntityReference) => (
    <Button
      noTextPadding
      className="tw:min-h-14 tw:w-full tw:justify-start tw:rounded-none tw:px-3.5 tw:py-2 tw:text-left tw:*:data-text:w-full"
      color="tertiary"
      onPress={() => onSelectTerm(nodeId)}>
      <span className="tw:flex tw:w-full tw:min-w-0 tw:items-center tw:gap-2.5">
        <span className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-utility-blue-400" />
        <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
          <Typography ellipsis as="span" size="text-sm" weight="medium">
            {getReferenceLabel(ref)}
          </Typography>
          <Typography
            ellipsis
            as="span"
            className="tw:text-tertiary"
            size="text-xs">
            {ref.fullyQualifiedName}
          </Typography>
        </span>
        <ChevronRight
          aria-hidden
          className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
        />
      </span>
    </Button>
  );

  return (
    <>
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-3 tw:overflow-y-auto tw:px-6 tw:pt-5 tw:pb-6">
        <div
          className="tw:flex tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary"
          data-testid="ontology-ai-relationship-ends">
          {renderEnd(relationship.fromId, relationship.from)}
          <div className="tw:flex tw:items-center tw:gap-2.5 tw:border-y tw:border-dashed tw:border-utility-purple-200 tw:bg-utility-purple-50 tw:px-3.5 tw:py-2.5">
            <AskCollateSparkle aria-hidden className="tw:size-4 tw:shrink-0" />
            <Select
              aria-label={t('label.relationship-type')}
              className="tw:flex-1"
              data-testid="ontology-ai-relationship-type"
              items={typeItems}
              placeholder={proposedType.displayName ?? proposedType.name}
              size="sm"
              value={typeId}
              onChange={(key) => setTypeId(String(key ?? proposedType.id))}>
              {(item) => (
                <Select.Item id={item.id} key={item.id} label={item.label} />
              )}
            </Select>
          </div>
          {renderEnd(relationship.toId, relationship.to)}
        </div>

        <div
          className="tw:flex tw:flex-col tw:gap-1.5 tw:rounded-xl tw:border tw:border-utility-purple-200 tw:bg-utility-purple-50 tw:px-3.5 tw:py-3"
          data-testid="ontology-ai-proposal-reason">
          <div className="tw:flex tw:items-center tw:gap-2">
            <span className="tw:min-w-0 tw:flex-1">
              <OntologyAiProposalSource isEmphasized item={relationship} />
            </span>
            <OntologyAiProposalConfidence withLabel item={relationship} />
          </div>
          {relationship.operation.rationale ? (
            <Typography as="p" className="tw:text-secondary" size="text-sm">
              {relationship.operation.rationale}
            </Typography>
          ) : null}
        </div>
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
          color="primary"
          data-testid="ontology-ai-proposal-accept"
          isDisabled={!permissions.canApprove || isSaving}
          isLoading={isSaving}
          onPress={() =>
            onApprove(
              selectedType
                ? {
                    displayName: selectedType.displayName,
                    fullyQualifiedName: selectedType.fullyQualifiedName,
                    id: selectedType.id,
                    name: selectedType.name,
                    type: 'relationshipType',
                  }
                : proposedType
            )
          }>
          {t('label.accept-relationship')}
        </Button>
      </div>
    </>
  );
};

export default OntologyAiRelationshipProposalDetail;
