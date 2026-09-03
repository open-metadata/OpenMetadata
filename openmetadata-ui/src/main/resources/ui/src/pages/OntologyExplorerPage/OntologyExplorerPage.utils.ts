/*
 *  Copyright 2024 Collate.
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

import classNames from 'classnames';
import { useOntologyEditLease } from '../../components/OntologyExplorer/hooks/useOntologyEditLease';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { Glossary } from '../../generated/entity/data/glossary';
import { Operation } from '../../generated/entity/policies/policy';
import { checkPermission } from '../../utils/PermissionsUtils';
import {
  EditSurface,
  QuerySurface,
  StudioMode,
  StudioModeTab,
  StudioSubMode,
  ViewSurface,
} from './OntologyExplorerPage';
import { TFunc } from './OntologyExplorerPage.interface';

export const getLeaseGlossary = (
  selectedGlossary: Glossary | undefined,
  authoringGlossary: Glossary | undefined,
  conceptDraft: { defaultGlossaryId?: string; id: string } | undefined,
  glossaries: Glossary[]
) => {
  const graphLeaseGlossary = selectedGlossary ?? authoringGlossary;
  const leaseGlossary = conceptDraft
    ? authoringGlossary ??
      glossaries.find(
        (glossary) => glossary.id === conceptDraft.defaultGlossaryId
      )
    : graphLeaseGlossary;

  return { graphLeaseGlossary, leaseGlossary };
};

export const getLeaseOwnership = (
  editLease: ReturnType<typeof useOntologyEditLease>,
  leaseGlossary: Glossary | undefined
) => {
  const isLeaseForCurrentGlossary =
    !editLease.lock || editLease.lock.resourceId === leaseGlossary?.id;
  const isLeaseOwned = editLease.isOwned && isLeaseForCurrentGlossary;
  const editLeaseState =
    editLease.isOwned && !isLeaseForCurrentGlossary
      ? ('acquiring' as const)
      : editLease.state;

  return { editLeaseState, isLeaseForCurrentGlossary, isLeaseOwned };
};

export const getOntologyPermissions = (
  isAdminUser: boolean | undefined,
  permissions: Parameters<typeof checkPermission>[2]
) => {
  const canEditOntology =
    Boolean(isAdminUser) ||
    checkPermission(Operation.EditAll, ResourceEntity.GLOSSARY, permissions) ||
    checkPermission(
      Operation.EditGlossaryTerms,
      ResourceEntity.GLOSSARY,
      permissions
    ) ||
    checkPermission(
      Operation.EditEntityRelationship,
      ResourceEntity.GLOSSARY_TERM,
      permissions
    );
  const canCreateConcept =
    canEditOntology ||
    Boolean(isAdminUser) ||
    checkPermission(
      Operation.Create,
      ResourceEntity.GLOSSARY_TERM,
      permissions
    );

  return { canCreateConcept, canEditOntology };
};

export const getModeTabs = (
  isOntologyAiEnabled: boolean,
  canEditOntology: boolean,
  t: TFunc
): StudioModeTab[] => {
  const aiModeTabs: StudioModeTab[] = isOntologyAiEnabled
    ? [{ id: 'ai', label: t('label.ai') }]
    : [];
  const editModeTabs: StudioModeTab[] = canEditOntology
    ? [{ id: 'edit', label: t('label.edit') }]
    : [];

  return [
    { id: 'view', label: t('label.view') },
    ...editModeTabs,
    { id: 'query', label: t('label.query') },
    ...aiModeTabs,
  ];
};

const SUB_MODE_CONFIGURATION_BUILDERS: Record<
  StudioMode,
  (
    surfaces: {
      viewSurface: ViewSurface;
      editSurface: EditSurface;
      querySurface: QuerySurface;
    },
    isRdfEnabled: boolean,
    t: TFunc
  ) => StudioSubMode
> = {
  view: ({ viewSurface }, _isRdfEnabled, t) => ({
    id: viewSurface,
    items: [
      { id: 'graph', label: t('label.graph') },
      { id: 'tree', label: t('label.tree') },
    ],
    label: t('label.explore'),
  }),
  edit: ({ editSurface }, _isRdfEnabled, t) => ({
    id: editSurface,
    items: [
      { id: 'graph', label: t('label.graph') },
      { id: 'model', label: t('label.model') },
    ],
    label: t('label.author'),
  }),
  query: ({ querySurface }, isRdfEnabled, t) => ({
    id: querySurface,
    items: isRdfEnabled
      ? [
          { id: 'console', label: t('label.sparql-console') },
          { id: 'builder', label: t('label.visual-builder') },
        ]
      : [],
    label: t('label.query'),
  }),
  ai: (_surfaces, _isRdfEnabled, t) => ({
    id: 'ai',
    items: [],
    label: t('label.ontology-ai-assistant'),
  }),
};

export const getSubModeConfiguration = (
  mode: StudioMode,
  surfaces: {
    viewSurface: ViewSurface;
    editSurface: EditSurface;
    querySurface: QuerySurface;
  },
  isRdfEnabled: boolean,
  t: TFunc
): StudioSubMode =>
  SUB_MODE_CONFIGURATION_BUILDERS[mode](surfaces, isRdfEnabled, t);

export const getSelectedGlossaryLabel = (
  selectedGlossary: Glossary | undefined,
  allGlossariesLabel: string
): string =>
  selectedGlossary?.displayName ?? selectedGlossary?.name ?? allGlossariesLabel;

export const getUserName = (
  currentUser: { displayName?: string; name?: string } | undefined,
  t: TFunc
): string => currentUser?.displayName ?? currentUser?.name ?? t('label.user');

export const getExplorerSurface = (
  mode: StudioMode,
  viewSurface: ViewSurface
): 'graph' | 'tree' => (mode === 'view' ? viewSurface : 'graph');

export const getContentSectionClassName = (mode: StudioMode): string =>
  classNames(
    'tw:flex tw:min-h-0 tw:flex-1',
    mode === 'query' || mode === 'ai' ? 'tw:bg-secondary' : 'tw:bg-primary'
  );
