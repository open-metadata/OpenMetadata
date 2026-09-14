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

import { APIRequestContext, expect, Page } from '@playwright/test';
import { Glossary } from '../glossary/Glossary';
import { GlossaryTerm } from '../glossary/GlossaryTerm';

interface SparqlAskResult {
  boolean: boolean;
}

interface RdfStatusBody {
  baseUri: string;
  enabled: boolean;
}

interface RelationSeed {
  relationType: string;
  source: GlossaryTerm;
  target: GlossaryTerm;
}

const isSparqlAskResult = (value: unknown): value is SparqlAskResult =>
  typeof value === 'object' &&
  value !== null &&
  'boolean' in value &&
  typeof value.boolean === 'boolean';

const isRdfStatusBody = (value: unknown): value is RdfStatusBody =>
  typeof value === 'object' &&
  value !== null &&
  'baseUri' in value &&
  typeof value.baseUri === 'string' &&
  'enabled' in value &&
  value.enabled === true;

export class OntologyRdfFixture {
  readonly glossary: Glossary;
  readonly terms: GlossaryTerm[] = [];

  constructor(glossaryName: string) {
    this.glossary = new Glossary(glossaryName);
  }

  async create(apiContext: APIRequestContext): Promise<void> {
    await this.glossary.create(apiContext);
  }

  async createTerm(
    apiContext: APIRequestContext,
    name: string,
    parent?: GlossaryTerm
  ): Promise<GlossaryTerm> {
    const term = new GlossaryTerm(
      this.glossary,
      parent?.responseData.fullyQualifiedName,
      name
    );
    await term.create(apiContext);
    this.terms.push(term);
    expect(term.responseData.id).not.toHaveLength(0);

    return term;
  }

  async addRelation(
    apiContext: APIRequestContext,
    seed: RelationSeed
  ): Promise<void> {
    const response = await apiContext.post(
      `/api/v1/glossaryTerms/${seed.source.responseData.id}/relations`,
      {
        data: {
          provenance: 'Manual',
          relationType: seed.relationType,
          status: 'Approved',
          term: {
            displayName: seed.target.responseData.displayName,
            fullyQualifiedName: seed.target.responseData.fullyQualifiedName,
            id: seed.target.responseData.id,
            name: seed.target.responseData.name,
            type: 'glossaryTerm',
          },
        },
      }
    );

    expect(response.ok(), await response.text()).toBe(true);
  }

  async selectInStudio(page: Page): Promise<void> {
    await page.getByTestId('ontology-glossary-menu-trigger').click();
    await page
      .getByRole('menuitemradio')
      .filter({ hasText: this.glossary.responseData.displayName })
      .click();
    await expect(
      page.getByTestId('ontology-glossary-menu-trigger')
    ).toContainText(this.glossary.responseData.displayName);
    await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
      `${this.terms.length} terms`
    );
    await this.waitForTermsInGraph(page);
    await expect(page.getByTestId('ontology-explorer')).toBeVisible();
  }

  private async waitForTermsInGraph(page: Page): Promise<void> {
    const termIds = this.terms.map((term) => term.responseData.id);
    if (termIds.length === 0) {
      await expect(
        page.getByTestId('ontology-graph-loading')
      ).not.toBeVisible();
    } else {
      await page.waitForFunction(
        (expectedTermIds) => {
          const container = document.querySelector<HTMLElement>(
            '.ontology-g6-container'
          );
          const positions = JSON.parse(
            container?.dataset.nodePositions ?? '{}'
          ) as Record<string, unknown>;

          return expectedTermIds.every((termId) => termId in positions);
        },
        termIds,
        { timeout: 30_000 }
      );
    }
  }

  async expectProjected(
    apiContext: APIRequestContext,
    term: GlossaryTerm
  ): Promise<void> {
    await expect
      .poll(() => this.ask(apiContext, this.termProjectionPattern(term)), {
        message: `RDF projection did not expose ${term.responseData.id}`,
        timeout: 45_000,
      })
      .toBe(true);
  }

  async expectRelationProjected(
    apiContext: APIRequestContext,
    source: GlossaryTerm,
    predicateIri: string,
    target: GlossaryTerm
  ): Promise<void> {
    const pattern = `<${await this.termIri(
      apiContext,
      source
    )}> <${predicateIri}> <${await this.termIri(apiContext, target)}> .`;

    await expect
      .poll(() => this.ask(apiContext, pattern), {
        message: `RDF projection did not expose ${predicateIri}`,
        timeout: 45_000,
      })
      .toBe(true);
  }

  async termIri(
    apiContext: APIRequestContext,
    term: GlossaryTerm
  ): Promise<string> {
    const baseUri = await this.baseUri(apiContext);

    return `${baseUri}entity/glossaryTerm/${term.responseData.id}`;
  }

  async delete(apiContext: APIRequestContext): Promise<void> {
    if (this.glossary.responseData.id) {
      await this.glossary.delete(apiContext);
    }
  }

  private async ask(
    apiContext: APIRequestContext,
    graphPattern: string
  ): Promise<boolean> {
    const query = `ASK { GRAPH ?graph { ${graphPattern} } }`;
    const queryResponse = await apiContext.post('/api/v1/rdf/sparql', {
      data: { query },
    });
    const queryBody: unknown = queryResponse.ok()
      ? await queryResponse.json()
      : undefined;

    return isSparqlAskResult(queryBody) && queryBody.boolean;
  }

  private async baseUri(apiContext: APIRequestContext): Promise<string> {
    const response = await apiContext.get('/api/v1/rdf/status');
    const body: unknown = response.ok() ? await response.json() : undefined;
    expect(isRdfStatusBody(body), 'RDF status must be enabled and typed').toBe(
      true
    );
    if (!isRdfStatusBody(body)) {
      throw new Error('RDF status response is invalid or disabled');
    }

    return body.baseUri.endsWith('/') ? body.baseUri : `${body.baseUri}/`;
  }

  private termProjectionPattern(term: GlossaryTerm): string {
    return `?term ?predicate ?object . FILTER(STRENDS(STR(?term), "/entity/glossaryTerm/${term.responseData.id}"))`;
  }
}
