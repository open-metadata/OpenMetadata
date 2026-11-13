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
import { AxiomType as CreateAxiomType } from '../../../generated/api/data/createOntologyAxiom';
import { Code } from '../../../generated/api/data/ontologyProfileReport';
import { OntologyConcept } from '../../../generated/entity/data/ontologyConcept';
import { validateOntologyAxiom } from '../../../rest/ontologyAPI';
import {
  NativeRelationType,
  planNativeRelation,
} from './OntologyNativeRelation.utils';
import { OntologyStudioModel } from './OntologyStudioModel.utils';

interface RelationClashInput {
  readonly model: OntologyStudioModel;
  readonly from: OntologyConcept;
  readonly to: OntologyConcept;
  readonly type: NativeRelationType;
}

/**
 * The server's clash warning for the subclass edge that `from type to` would write, or undefined.
 * The server owns the clash rules, so this only asks; a failed or rejected check never blocks the
 * write, which capture still guards.
 */
export const findRelationClash = async ({
  from,
  model,
  to,
  type,
}: RelationClashInput): Promise<string | undefined> => {
  const requests = planNativeRelation({ from, model, to, type }).flatMap(
    (step) =>
      step.kind === 'axiom' &&
      step.request.axiomType === CreateAxiomType.SubclassOf
        ? [step.request]
        : []
  );
  try {
    for (const request of requests) {
      const report = await validateOntologyAxiom(request);
      const clash = report.violations.find(
        (violation) => violation.code === Code.DisjointClash
      );
      if (clash) {
        return clash.message;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
};
