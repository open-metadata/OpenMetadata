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
import { isAxiosError } from 'axios';
import {
  CreateOntology,
  Layer,
} from '../../../../generated/api/data/createOntology';
import { OntologyPackManifest } from '../../../../generated/api/data/ontologyPackManifest';
import {
  createOntology,
  getOntologyByName,
} from '../../../../rest/ontologyAPI';
import { generateUUID } from '../../../../utils/StringUtils';
import { getOwnersOrCurrentUser } from '../../../Glossary/AddGlossary/AddGlossary.utils';

export const nativeLibraryOntologyRequest = (
  pack: OntologyPackManifest,
  userId: string
): CreateOntology => {
  const id = generateUUID();

  return {
    name: `${pack.id}-${id}`,
    displayName: pack.name,
    iri: `urn:openmetadata:ontology:${id}`,
    namespace: `urn:openmetadata:ontology:${id}:`,
    layer: Layer.L1,
    owners: getOwnersOrCurrentUser([], userId),
  };
};

const recoverTarget = async (request: CreateOntology) => {
  try {
    const found = await getOntologyByName(request.name);
    if (
      found.name !== request.name ||
      found.iri !== request.iri ||
      found.deleted
    ) {
      throw new Error('The retained ontology identity does not match.');
    }

    return found;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }

    throw error;
  }
};

export const resolveNativeLibraryTarget = async (
  request: CreateOntology,
  retry: boolean
) => {
  if (retry) {
    const found = await recoverTarget(request);
    if (found) {
      return found;
    }
  }
  try {
    return await createOntology(request);
  } catch (error) {
    const found = await recoverTarget(request);
    if (found) {
      return found;
    }

    throw error;
  }
};
