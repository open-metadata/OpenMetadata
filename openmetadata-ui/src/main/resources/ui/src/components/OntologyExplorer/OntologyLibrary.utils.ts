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
  OntologyPackManifest,
  OntologyPackModule,
} from '../../generated/api/data/ontologyPackManifest';

export interface OntologyPackTotals {
  concepts: number;
  relationships: number;
}

const requireModule = (
  modules: OntologyPackModule[],
  moduleId: string
): OntologyPackModule => {
  const module = modules.find((candidate) => candidate.id === moduleId);

  if (!module) {
    throw new Error(`Unknown ontology pack module: ${moduleId}`);
  }

  return module;
};

const includeDependencies = (
  modules: OntologyPackModule[],
  moduleId: string,
  selected: Set<string>
) => {
  const module = requireModule(modules, moduleId);
  module.dependencies.forEach((dependency) =>
    includeDependencies(modules, dependency, selected)
  );
  selected.add(moduleId);
};

const dependsOn = (
  modules: OntologyPackModule[],
  candidateId: string,
  dependencyId: string,
  visited: Set<string>
): boolean => {
  const candidate = requireModule(modules, candidateId);
  const hasDirectDependency = candidate.dependencies.includes(dependencyId);
  const hasTransitiveDependency = candidate.dependencies.some(
    (parentId) =>
      !visited.has(parentId) &&
      dependsOn(
        modules,
        parentId,
        dependencyId,
        new Set([...visited, parentId])
      )
  );

  return hasDirectDependency || hasTransitiveDependency;
};

export const defaultModuleIds = (pack: OntologyPackManifest): string[] => {
  const selected = new Set<string>();
  pack.modules
    .filter((module) => module.selectedByDefault)
    .forEach((module) =>
      includeDependencies(pack.modules, module.id, selected)
    );

  return pack.modules
    .filter((module) => selected.has(module.id))
    .map((module) => module.id);
};

export const updateModuleSelection = (
  pack: OntologyPackManifest,
  currentIds: string[],
  moduleId: string,
  isSelected: boolean
): string[] => {
  const selected = new Set(currentIds);

  if (isSelected) {
    includeDependencies(pack.modules, moduleId, selected);
  } else {
    pack.modules
      .filter(
        (module) =>
          module.id === moduleId ||
          dependsOn(pack.modules, module.id, moduleId, new Set([module.id]))
      )
      .forEach((module) => selected.delete(module.id));
  }

  return pack.modules
    .filter((module) => selected.has(module.id))
    .map((module) => module.id);
};

export const selectedModuleTotals = (
  pack: OntologyPackManifest,
  selectedIds: string[]
): OntologyPackTotals =>
  pack.modules
    .filter((module) => selectedIds.includes(module.id))
    .reduce(
      (totals, module) => ({
        concepts: totals.concepts + module.conceptCount,
        relationships: totals.relationships + module.relationshipCount,
      }),
      { concepts: 0, relationships: 0 }
    );
