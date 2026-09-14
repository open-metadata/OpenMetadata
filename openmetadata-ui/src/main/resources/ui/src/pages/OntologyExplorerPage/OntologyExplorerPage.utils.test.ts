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

import { useOntologyEditLease } from '../../components/OntologyExplorer/hooks/useOntologyEditLease';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { Glossary } from '../../generated/entity/data/glossary';
import { Operation } from '../../generated/entity/policies/policy';
import { checkPermission } from '../../utils/PermissionsUtils';
import { TFunc } from './OntologyExplorerPage.interface';
import {
  getContentSectionClassName,
  getExplorerSurface,
  getLeaseGlossary,
  getLeaseOwnership,
  getModeTabs,
  getOntologyPermissions,
  getSelectedGlossaryLabel,
  getSubModeConfiguration,
  getUserName,
} from './OntologyExplorerPage.utils';

jest.mock('./OntologyExplorerPage', () => ({}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn(),
}));

const mockCheckPermission = checkPermission as jest.MockedFunction<
  typeof checkPermission
>;

const t = ((key: string) => key) as TFunc;
const PERMISSIONS = {} as Parameters<typeof checkPermission>[2];

const GLOSSARY_A: Glossary = {
  id: 'g-a',
  name: 'Alpha',
  displayName: 'A',
  description: 'Alpha glossary',
};
const GLOSSARY_B: Glossary = {
  id: 'g-b',
  name: 'Beta',
  description: 'Beta glossary',
};

type EditLease = ReturnType<typeof useOntologyEditLease>;

const buildLease = (overrides: Partial<EditLease>): EditLease =>
  ({
    isOwned: false,
    lock: undefined,
    state: 'idle',
    ...overrides,
  } as EditLease);

describe('OntologyExplorerPage.utils', () => {
  beforeEach(() => {
    mockCheckPermission.mockReset();
    mockCheckPermission.mockReturnValue(false);
  });

  describe('getLeaseGlossary', () => {
    it('uses the selected glossary for the graph and no draft', () => {
      expect(getLeaseGlossary(GLOSSARY_A, GLOSSARY_B, undefined, [])).toEqual({
        graphLeaseGlossary: GLOSSARY_A,
        leaseGlossary: GLOSSARY_A,
      });
    });

    it('falls back to the authoring glossary when nothing is selected', () => {
      expect(getLeaseGlossary(undefined, GLOSSARY_B, undefined, [])).toEqual({
        graphLeaseGlossary: GLOSSARY_B,
        leaseGlossary: GLOSSARY_B,
      });
    });

    it('prefers the authoring glossary for a concept draft', () => {
      const result = getLeaseGlossary(
        GLOSSARY_A,
        GLOSSARY_B,
        { id: 'draft', defaultGlossaryId: GLOSSARY_A.id },
        [GLOSSARY_A, GLOSSARY_B]
      );

      expect(result.leaseGlossary).toBe(GLOSSARY_B);
      expect(result.graphLeaseGlossary).toBe(GLOSSARY_A);
    });

    it('resolves the draft default glossary when there is no authoring glossary', () => {
      const result = getLeaseGlossary(
        undefined,
        undefined,
        { id: 'draft', defaultGlossaryId: GLOSSARY_B.id },
        [GLOSSARY_A, GLOSSARY_B]
      );

      expect(result.leaseGlossary).toBe(GLOSSARY_B);
      expect(result.graphLeaseGlossary).toBeUndefined();
    });
  });

  describe('getLeaseOwnership', () => {
    it('treats a lease without a lock as owned when the hook says so', () => {
      expect(
        getLeaseOwnership(
          buildLease({ isOwned: true, state: 'owned' }),
          GLOSSARY_A
        )
      ).toEqual({
        editLeaseState: 'owned',
        isLeaseForCurrentGlossary: true,
        isLeaseOwned: true,
      });
    });

    it('reports acquiring when the owned lock targets another glossary', () => {
      expect(
        getLeaseOwnership(
          buildLease({
            isOwned: true,
            lock: { resourceId: GLOSSARY_B.id } as EditLease['lock'],
            state: 'owned',
          }),
          GLOSSARY_A
        )
      ).toEqual({
        editLeaseState: 'acquiring',
        isLeaseForCurrentGlossary: false,
        isLeaseOwned: false,
      });
    });

    it('keeps the hook state when the lease is not owned', () => {
      expect(
        getLeaseOwnership(
          buildLease({
            isOwned: false,
            lock: { resourceId: GLOSSARY_A.id } as EditLease['lock'],
            state: 'contended',
          }),
          GLOSSARY_A
        )
      ).toEqual({
        editLeaseState: 'contended',
        isLeaseForCurrentGlossary: true,
        isLeaseOwned: false,
      });
    });
  });

  describe('getOntologyPermissions', () => {
    it('grants everything to admins without consulting permissions', () => {
      expect(getOntologyPermissions(true, PERMISSIONS)).toEqual({
        canCreateConcept: true,
        canEditOntology: true,
      });
      expect(mockCheckPermission).not.toHaveBeenCalled();
    });

    it('derives edit access from glossary permissions', () => {
      mockCheckPermission.mockImplementation(
        (operation) => operation === Operation.EditGlossaryTerms
      );

      expect(getOntologyPermissions(false, PERMISSIONS)).toEqual({
        canCreateConcept: true,
        canEditOntology: true,
      });
      expect(mockCheckPermission).toHaveBeenCalledWith(
        Operation.EditAll,
        ResourceEntity.GLOSSARY,
        PERMISSIONS
      );
    });

    it('allows concept creation from the glossary term create permission alone', () => {
      mockCheckPermission.mockImplementation(
        (operation, resource) =>
          operation === Operation.Create &&
          resource === ResourceEntity.GLOSSARY_TERM
      );

      expect(getOntologyPermissions(undefined, PERMISSIONS)).toEqual({
        canCreateConcept: true,
        canEditOntology: false,
      });
    });

    it('denies both when no permission matches', () => {
      expect(getOntologyPermissions(false, PERMISSIONS)).toEqual({
        canCreateConcept: false,
        canEditOntology: false,
      });
    });
  });

  describe('getModeTabs', () => {
    it('always exposes view and query', () => {
      expect(getModeTabs(false, false, t).map((tab) => tab.id)).toEqual([
        'view',
        'query',
      ]);
    });

    it('adds edit and ai tabs when enabled', () => {
      expect(getModeTabs(true, true, t)).toEqual([
        { id: 'view', label: 'label.view' },
        { id: 'edit', label: 'label.edit' },
        { id: 'query', label: 'label.query' },
        { id: 'ai', label: 'label.ai' },
      ]);
    });
  });

  describe('getSubModeConfiguration', () => {
    const surfaces = {
      editSurface: 'model' as const,
      querySurface: 'builder' as const,
      viewSurface: 'tree' as const,
    };

    it('builds the view configuration', () => {
      expect(getSubModeConfiguration('view', surfaces, false, t)).toEqual({
        id: 'tree',
        items: [
          { id: 'graph', label: 'label.graph' },
          { id: 'tree', label: 'label.tree' },
        ],
        label: 'label.explore',
      });
    });

    it('builds the edit configuration', () => {
      expect(getSubModeConfiguration('edit', surfaces, false, t)).toEqual({
        id: 'model',
        items: [
          { id: 'graph', label: 'label.graph' },
          { id: 'model', label: 'label.model' },
        ],
        label: 'label.author',
      });
    });

    it('exposes query surfaces only when rdf is enabled', () => {
      expect(getSubModeConfiguration('query', surfaces, true, t)).toEqual({
        id: 'builder',
        items: [
          { id: 'console', label: 'label.sparql-console' },
          { id: 'builder', label: 'label.visual-builder' },
        ],
        label: 'label.query',
      });
      expect(
        getSubModeConfiguration('query', surfaces, false, t).items
      ).toEqual([]);
    });

    it('builds the ai configuration', () => {
      expect(getSubModeConfiguration('ai', surfaces, true, t)).toEqual({
        id: 'ai',
        items: [],
        label: 'label.ontology-ai-assistant',
      });
    });
  });

  describe('label helpers', () => {
    it('picks display name, then name, then the all-glossaries label', () => {
      expect(getSelectedGlossaryLabel(GLOSSARY_A, 'all')).toBe('A');
      expect(getSelectedGlossaryLabel(GLOSSARY_B, 'all')).toBe('Beta');
      expect(getSelectedGlossaryLabel(undefined, 'all')).toBe('all');
    });

    it('picks the user display name, name, or generic label', () => {
      expect(getUserName({ displayName: 'Jane', name: 'jane' }, t)).toBe(
        'Jane'
      );
      expect(getUserName({ name: 'jane' }, t)).toBe('jane');
      expect(getUserName(undefined, t)).toBe('label.user');
    });
  });

  describe('surface helpers', () => {
    it('only honours the view surface in view mode', () => {
      expect(getExplorerSurface('view', 'tree')).toBe('tree');
      expect(getExplorerSurface('edit', 'tree')).toBe('graph');
    });

    it('uses the secondary background for query and ai modes', () => {
      expect(getContentSectionClassName('query')).toContain('tw:bg-secondary');
      expect(getContentSectionClassName('ai')).toContain('tw:bg-secondary');
      expect(getContentSectionClassName('view')).toContain('tw:bg-primary');
    });
  });
});
