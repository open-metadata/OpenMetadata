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
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';
import { OntologyEdge, OntologyNode } from './OntologyExplorer.interface';
import { OntologyNodeRelationsContent } from './OntologyNodeRelationsContent';
import { isTermNode } from './utils/graphBuilders';

interface OntologyTermEditorProps {
  readonly edges: OntologyEdge[];
  readonly nodes: OntologyNode[];
  readonly relationTypes: GlossaryTermRelationType[];
  readonly selectedNode: OntologyNode | null;
  readonly onCreateRelation: (
    fromId: string,
    toId: string,
    relationType: string
  ) => Promise<void>;
  readonly onSelectNode: (node: OntologyNode) => void;
}

const OntologyTermEditor = ({
  edges,
  nodes,
  relationTypes,
  selectedNode,
  onCreateRelation,
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
    (relationType) => relationType.isSystemDefined
  );
  const customRelationTypes = relationTypes.filter(
    (relationType) => !relationType.isSystemDefined
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
    types: GlossaryTermRelationType[]
  ) => {
    if (types.length === 0) {
      return null;
    }

    return (
      <div className="tw:flex tw:flex-col tw:gap-2">
        <Typography
          as="span"
          className="tw:uppercase tw:text-quaternary"
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
              key={relationType.name}
              size="sm"
              onClick={() => setSelectedRelationType(relationType.name)}>
              <span
                className="tw:size-2 tw:rounded-full"
                style={{
                  backgroundColor:
                    relationType.color ?? 'var(--color-fg-quaternary)',
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
      className="tw:h-full tw:overflow-auto tw:bg-secondary tw:p-6"
      data-testid="ontology-term-editor">
      <div className="tw:flex tw:max-w-4xl tw:flex-col tw:gap-5">
        <div className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
          <div>
            <div className="tw:flex tw:items-center tw:gap-2">
              <Typography as="h2" size="display-xs" weight="semibold">
                {activeNode.label}
              </Typography>
              <Badge color="blue" size="sm" type="color">
                {t('label.glossary-term')}
              </Badge>
            </div>
            <Typography
              as="p"
              className="tw:font-mono tw:text-quaternary"
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

        <Card className="tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-utility-gray-blue-100 tw:p-4 tw:ring-0 tw:shadow-sm">
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
                isSaving || !selectedRelationType || !selectedTargetId
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

        <div>
          <Typography as="h3" size="text-sm" weight="semibold">
            {t('label.relationship-plural')}
          </Typography>
          <OntologyNodeRelationsContent
            isEditMode
            edges={edges}
            node={activeNode}
            nodes={nodes}
            relationTypes={relationTypes}
          />
        </div>
      </div>
    </div>
  );
};

export default OntologyTermEditor;
