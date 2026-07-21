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
  Card,
  Checkbox,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Key, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { OntologyImpactReport } from '../../generated/api/data/ontologyImpactReport';
import {
  deleteGlossaryTermWithImpact,
  previewGlossaryTermDeleteImpact,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { OntologyNode } from './OntologyExplorer.interface';
import { isTermNode, isValidUUID } from './utils/graphBuilders';

interface OntologyDeleteImpactPanelProps {
  node: OntologyNode;
  nodes: OntologyNode[];
  onDeleted: () => void;
}

const OntologyDeleteImpactPanel = ({
  node,
  nodes,
  onDeleted,
}: OntologyDeleteImpactPanelProps) => {
  const { t } = useTranslation();
  const termId = node.termId ?? node.id;
  const [report, setReport] = useState<OntologyImpactReport>();
  const [reassignmentId, setReassignmentId] = useState('');
  const [isCascadeConfirmed, setIsCascadeConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const reassignmentOptions = useMemo(
    () =>
      nodes
        .filter(
          (candidate) =>
            isTermNode(candidate) &&
            candidate.id !== termId &&
            !report?.children.some((child) => child.id === candidate.id)
        )
        .map((candidate) => ({
          id: candidate.id,
          label: candidate.originalLabel ?? candidate.label,
        })),
    [nodes, report?.children, termId]
  );

  const preview = async () => {
    setIsLoading(true);
    try {
      setReport(await previewGlossaryTermDeleteImpact(termId));
      setIsCascadeConfirmed(false);
      setReassignmentId('');
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsLoading(false);
    }
  };

  const remove = async () => {
    if (report) {
      setIsLoading(true);
      try {
        await deleteGlossaryTermWithImpact(termId, {
          cascadeConfirmed: isCascadeConfirmed,
          hardDelete: false,
          impactToken: report.impactToken,
          reassignChildrenTo: reassignmentId
            ? { id: reassignmentId, type: EntityType.GLOSSARY_TERM }
            : undefined,
        });
        onDeleted();
        showSuccessToast(
          t('server.entity-deleted-success', { entity: t('label.term') })
        );
      } catch {
        showErrorToast(t('server.unexpected-error'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isValidUUID(termId)) {
    return null;
  }

  return (
    <Card className="tw:flex tw:flex-col tw:gap-4 tw:border tw:border-utility-error-300 tw:bg-error-primary tw:p-4 tw:ring-0">
      <div>
        <Typography as="h3" size="text-sm" weight="semibold">
          {t('label.delete-entity', { entity: t('label.term') })}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('label.impact')}
        </Typography>
      </div>
      {report ? (
        <>
          <ImpactCounts report={report} />
          {report.children.length ? (
            <div className="tw:flex tw:flex-col tw:gap-3">
              <Select
                data-testid="delete-impact-reassignment"
                items={reassignmentOptions}
                label={`${t('label.children')}: ${t('label.target-term')}`}
                value={reassignmentId}
                onChange={(key: Key | null) => {
                  setReassignmentId(String(key ?? ''));
                  setIsCascadeConfirmed(false);
                }}>
                {(item) => (
                  <Select.Item id={item.id} key={item.id} label={item.label} />
                )}
              </Select>
              <Checkbox
                data-testid="delete-impact-cascade"
                isSelected={isCascadeConfirmed}
                label={`${t('label.confirm')} ${t('label.cascade')}`}
                onChange={(selected) => {
                  setIsCascadeConfirmed(selected);
                  if (selected) {
                    setReassignmentId('');
                  }
                }}
              />
            </div>
          ) : null}
          <div className="tw:flex tw:justify-end tw:gap-2">
            <Button
              color="secondary"
              isDisabled={isLoading}
              onClick={() => setReport(undefined)}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              data-testid="delete-impact-confirm"
              isDisabled={
                report.children.length > 0 &&
                !isCascadeConfirmed &&
                !reassignmentId
              }
              isLoading={isLoading}
              onClick={remove}>
              {t('label.delete')}
            </Button>
          </div>
        </>
      ) : (
        <Button
          color="tertiary-destructive"
          data-testid="delete-impact-preview"
          isLoading={isLoading}
          onClick={preview}>
          {t('label.preview')} {t('label.impact')}
        </Button>
      )}
    </Card>
  );
};

const ImpactCounts = ({ report }: { report: OntologyImpactReport }) => {
  const { t } = useTranslation();
  const counts = [
    { count: report.children.length, label: t('label.children') },
    {
      count: report.relationships.length,
      label: t('label.relationship-plural'),
    },
    { count: report.boundAssetCount, label: t('label.asset-plural') },
    { count: report.conceptMappings.length, label: t('label.mapping-plural') },
  ];

  return (
    <div className="tw:grid tw:grid-cols-2 tw:gap-2">
      {counts.map((item) => (
        <div
          className="tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-3"
          key={item.label}>
          <Typography size="text-lg" weight="semibold">
            {item.count}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-xs">
            {item.label}
          </Typography>
        </div>
      ))}
    </div>
  );
};

export default OntologyDeleteImpactPanel;
