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
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getModelRelationLabel,
  humanizeName,
  OntologyModelRelation,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { RelationTypeOptionGroup } from '../../../OntologyExplorer/RelationshipTypePicker.interface';
import OntologyStudioDrawer from '../OntologyStudioDrawer/OntologyStudioDrawer';
import OntologyRelationControls from './OntologyRelationControls';

interface OntologyRelationDetailProps {
  readonly relation: OntologyModelRelation;
  readonly groups: RelationTypeOptionGroup[];
  readonly canEdit: boolean;
  readonly canCreateRelationType: boolean;
  readonly checkType: (typeId: string) => string | undefined;
  readonly onEdit: (typeId: string) => Promise<boolean>;
  readonly onDelete: () => Promise<boolean>;
  readonly onClose: () => void;
  readonly onOpenConcept: (conceptId: string) => void;
}

const KIND_LABELS: Record<OntologyModelRelation['kind'], string> = {
  disjointWith: 'label.disjoint-with',
  equivalentClass: 'label.equivalent-to',
  objectAssertion: 'label.relationship',
  objectProperty: 'label.relationship',
  restriction: 'label.relationship',
  subClassOf: 'label.hierarchy',
};

/** What the canvas edge says: who is related to whom, by which type, with the actions that change it. */
const OntologyRelationDetail = ({
  relation,
  groups,
  canEdit,
  canCreateRelationType,
  checkType,
  onEdit,
  onDelete,
  onClose,
  onOpenConcept,
}: OntologyRelationDetailProps) => {
  const { t } = useTranslation();
  const canChange =
    canEdit && relation.axiom && relation.kind !== 'objectProperty';

  const renderEnd = (
    label: string,
    concept: OntologyModelRelation['from'],
    testId: string
  ) => (
    <Box direction="col" gap={1}>
      <Typography color="secondary" size="text-xs" weight="semibold">
        {label}
      </Typography>
      <Button
        noTextPadding
        className="tw:justify-start"
        color="link-color"
        data-testid={testId}
        onPress={() => onOpenConcept(concept.id)}>
        {getEntityName(concept)}
      </Button>
    </Box>
  );

  return (
    <OntologyStudioDrawer testId="ontology-relation-detail">
      <Box
        align="center"
        className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-4 tw:py-3"
        gap={2}>
        <Typography className="tw:flex-1" size="text-sm" weight="semibold">
          {t('label.relationship')}
        </Typography>
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-relation-detail-close"
          icon={XClose}
          size="sm"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </Box>
      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-4"
        direction="col"
        gap={4}>
        {renderEnd(
          t('label.source'),
          relation.from,
          'ontology-relation-detail-source'
        )}
        <Box direction="col" gap={1}>
          <Typography color="secondary" size="text-xs" weight="semibold">
            {t('label.type')}
          </Typography>
          <Box align="center" gap={2}>
            <Badge
              color="brand"
              data-testid="ontology-relation-detail-type"
              size="sm"
              type="pill-color">
              {humanizeName(getModelRelationLabel(relation))}
            </Badge>
            <Typography color="secondary" size="text-xs">
              {t(KIND_LABELS[relation.kind])}
            </Typography>
          </Box>
        </Box>
        {renderEnd(
          t('label.target'),
          relation.to,
          'ontology-relation-detail-target'
        )}
        {canChange ? (
          <Box
            align="center"
            data-testid="ontology-relation-detail-actions"
            gap={2}>
            <OntologyRelationControls
              canCreateRelationType={canCreateRelationType}
              checkType={checkType}
              groups={groups}
              relation={relation}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </Box>
        ) : null}
      </Box>
    </OntologyStudioDrawer>
  );
};

export default OntologyRelationDetail;
