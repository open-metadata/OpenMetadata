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

import { useEffect, useState } from 'react';
import { fetchRdfConfig } from '../../../rest/rdfAPI';

interface OntologyAiCapability {
  isEnabled: boolean;
  isRdfEnabled: boolean;
  isLoading: boolean;
}

const INITIAL_CAPABILITY: OntologyAiCapability = {
  isEnabled: false,
  isRdfEnabled: false,
  isLoading: true,
};

export const useOntologyAiCapability = (): OntologyAiCapability => {
  const [capability, setCapability] =
    useState<OntologyAiCapability>(INITIAL_CAPABILITY);

  useEffect(() => {
    let isMounted = true;

    const loadCapability = async () => {
      try {
        const status = await fetchRdfConfig();
        if (isMounted) {
          setCapability({
            isEnabled: status.askCollateEnabled,
            isRdfEnabled: status.enabled,
            isLoading: false,
          });
        }
      } catch {
        if (isMounted) {
          setCapability({
            isEnabled: false,
            isRdfEnabled: false,
            isLoading: false,
          });
        }
      }
    };

    void loadCapability();

    return () => {
      isMounted = false;
    };
  }, []);

  return capability;
};
