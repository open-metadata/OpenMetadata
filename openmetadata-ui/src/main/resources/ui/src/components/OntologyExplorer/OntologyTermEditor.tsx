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
  Card,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import OntologyDeleteImpactPanel from './OntologyDeleteImpactPanel';
import { OntologyEdge, OntologyNode } from './OntologyExplorer.interface';
import { OntologyNodeRelationsContent } from './OntologyNodeRelationsContent';
import { isTermNode } from './utils/graphBuilders';
import { getRelationshipColor } from './utils/relationshipTypeUtils';

interface OntologyTermEditorProps {
  readonly edges: OntologyEdge[];
  readonly isEditable: boolean;
  readonly nodes: OntologyNode[];
  readonly relationTypes: RelationshipType[];
  readonly selectedNode: OntologyNode | null;
  readonly onCreateRelation: (
    fromId: string,
    toId: string,
    relationType: string
  ) => Promise<void>;
  readonly onSelectNode: (node: OntologyNode) => void;
  readonly onDeleteTerm: () => void;
}

const OntologyTermEditor = ({
  edges,
  isEditable,
  nodes,
  relationTypes,
  selectedNode,
  onCreateRelation,
  onDeleteTerm,
  onSelectNode,
}: OntologyTermEditorProps) => {
  const { t } = useTranslation();
  const termNodes = useMemo(() => nodes.filter(isTermNode), [nodes]);
  const activeNode =
    selectedNode && isTermNode(selectedNode) ? selectedNode : termNodes[0];
  const [selectedRelationType, setSelectedRelationType] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const targetNodes = useMemo(
    () => termNodes.filter((term) => term.id !== activeNode?.id),
    [activeNode?.id, termNodes]
  );
  const systemRelationTypes = relationTypes.filter(
    (relationType) => relationType.systemDefined
  );
  const customRelationTypes = relationTypes.filter(
    (relationType) => !relationType.systemDefined
  );

  useEffect(() => {
    if (!selectedNode && termNodes[0]) {
      onSelectNode(termNodes[0]);
    }
  }, [onSelectNode, selectedNode, termNodes]);

  useEffect(() => {
    if (
      !selectedRelationType ||
      !relationTypes.some(
        (relationType) => relationType.name === selectedRelationType
      )
    ) {
      setSelectedRelationType(relationTypes[0]?.name ?? '');
    }
  }, [relationTypes, selectedRelationType]);

  useEffect(() => {
    if (!targetNodes.some((target) => target.id === selectedTargetId)) {
      setSelectedTargetId(targetNodes[0]?.id ?? '');
    }
  }, [selectedTargetId, targetNodes]);

  const renderRelationTypeGroup = (
    label: string,
    types: RelationshipType[]
  ) => {
    if (types.length === 0) {
      return null;
    }

    return (
      <div className="tw:flex tw:flex-col tw:gap-1.5">
        <Typography
          as="span"
          className="tw:text-[10px]! tw:tracking-[0.06em] tw:text-quaternary tw:uppercase"
          size="text-xs"
          weight="semibold">
          {label}
        </Typography>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {types.map((relationType) => (
            <Button
              className={classNames(
                selectedRelationType === relationType.name &&
                  'tw:bg-brand-primary_alt! tw:ring-brand!'
              )}
              color="secondary"
              data-testid={`term-editor-relation-${relationType.name}`}
              isDisabled={!isEditable}
              key={relationType.name}
              size="sm"
              onClick={() => setSelectedRelationType(relationType.name)}>
              <span
                className="tw:size-2 tw:rounded-full"
                style={{
                  backgroundColor: getRelationshipColor(relationType),
                }}
              />
              {relationType.displayName || relationType.name}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  if (!activeNode) {
    return (
      <div className="tw:flex tw:h-full tw:items-center tw:justify-center">
        <Typography as="p" className="tw:text-tertiary" size="text-sm">
          {t('message.no-glossary-terms-found')}
        </Typography>
      </div>
    );
  }

  return (
    <div
      className="tw:h-full tw:overflow-auto tw:bg-primary tw:px-[26px] tw:py-[22px]"
      data-testid="ontology-term-editor">
      <div className="tw:flex tw:max-w-[760px] tw:flex-col tw:gap-5">
        <div className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
          <div>
            <div className="tw:flex tw:items-center tw:gap-2">
              <Typography
                as="h2"
                className="tw:text-[22px]! tw:leading-normal!"
                size="display-xs"
                weight="bold">
                {activeNode.label}
              </Typography>
              <Badge color="blue" size="sm" type="color">
                {t('label.glossary-term')}
              </Badge>
            </div>
            <Typography
              as="p"
              className="tw:mt-0.5 tw:font-mono tw:text-[11px]! tw:font-normal tw:text-quaternary"
              size="text-xs">
              {activeNode.fullyQualifiedName}
            </Typography>
          </div>
          <Select
            aria-label={t('label.term')}
            className="tw:min-w-64"
            items={termNodes.map((term) => ({
              id: term.id,
              label: term.label,
            }))}
            size="sm"
            value={activeNode.id}
            onChange={(key) => {
              const term = termNodes.find((node) => node.id === String(key));
              if (term) {
                onSelectNode(term);
              }
            }}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
        </div>

        <div>
          <Typography
            as="h3"
            className="tw:text-[15px]! tw:leading-normal!"
            size="text-sm"
            weight="semibold">
            {t('label.relationship-plural')}
          </Typography>
          <OntologyNodeRelationsContent
            edges={edges}
            isEditMode={isEditable}
            node={activeNode}
            nodes={nodes}
            relationTypes={relationTypes}
          />
        </div>
        <Card className="tw:flex tw:flex-col tw:gap-[13px] tw:rounded-[10px] tw:border tw:border-dashed tw:border-secondary tw:bg-secondary tw:p-[13px] tw:ring-0 tw:shadow-none">
          <Typography as="h3" size="text-sm" weight="semibold">
            {t('label.add-entity', { entity: t('label.relationship') })}
          </Typography>
          {renderRelationTypeGroup(
            t('label.system-defined'),
            systemRelationTypes
          )}
          {renderRelationTypeGroup(t('label.custom'), customRelationTypes)}
          <div className="tw:flex tw:flex-wrap tw:items-end tw:gap-3">
            <div className="tw:flex tw:min-w-72 tw:flex-1 tw:flex-col tw:gap-1">
              <Typography
                as="span"
                className="tw:text-secondary"
                size="text-xs"
                weight="medium">
                {t('label.target-term')}
              </Typography>
              <Select
                aria-label={t('label.target-term')}
                isDisabled={!isEditable}
                items={targetNodes.map((term) => ({
                  id: term.id,
                  label: term.label,
                }))}
                placeholder={t('label.select-entity', {
                  entity: t('label.term'),
                })}
                size="sm"
                value={selectedTargetId}
                onChange={(key) => setSelectedTargetId(String(key))}>
                {(item) => (
                  <Select.Item id={item.id} key={item.id} label={item.label} />
                )}
              </Select>
            </div>
            <Button
              color="primary"
              data-testid="term-editor-add-relationship"
              isDisabled={
                !isEditable ||
                isSaving ||
                !selectedRelationType ||
                !selectedTargetId
              }
              size="sm"
              onClick={async () => {
                setIsSaving(true);
                try {
                  await onCreateRelation(
                    activeNode.id,
                    selectedTargetId,
                    selectedRelationType
                  );
                } finally {
                  setIsSaving(false);
                }
              }}>
              {t('label.add-entity', { entity: t('label.relationship') })}
            </Button>
          </div>
        </Card>
        {isEditable ? (
          <OntologyDeleteImpactPanel
            node={activeNode}
            nodes={termNodes}
            onDeleted={onDeleteTerm}
          />
        ) : null}
      </div>
    </div>
  );
};

export default OntologyTermEditor;
