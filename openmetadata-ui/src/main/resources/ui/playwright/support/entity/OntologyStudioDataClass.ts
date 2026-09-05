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
import { APIRequestContext } from '@playwright/test';
import { uuid } from '../../utils/common';
import {
  addRelationTypesWithCardinality,
  addTermRelation,
} from '../../utils/ontologyStudio';
import { Glossary } from '../glossary/Glossary';
import { GlossaryTerm } from '../glossary/GlossaryTerm';

// Unique per module load (i.e. per worker) so that parallel workers create
// distinct relation type names. The glossary and term names are random by
// default (generated inside Glossary/GlossaryTerm), so only the global
// relation-type names need an explicit suffix.
const RUN_ID = uuid();

// ---------------------------------------------------------------------------
// E2E spec data — catalog with three terms and four relation types
// ---------------------------------------------------------------------------

export class OntologyStudioE2EData {
  static readonly catalog = new Glossary();
  static readonly termProduct = new GlossaryTerm(this.catalog);
  static readonly termCategory = new GlossaryTerm(this.catalog);
  static readonly termBrand = new GlossaryTerm(this.catalog);
  static readonly CUSTOM_OWNS_RELATION = `pw-e2e-owns-${RUN_ID}`;

  static async setup(apiContext: APIRequestContext): Promise<void> {
    await this.catalog.create(apiContext);
    await Promise.all([
      this.termProduct.create(apiContext),
      this.termCategory.create(apiContext),
      this.termBrand.create(apiContext),
    ]);

    const E2E_CUSTOM_TYPE = [
      {
        name: this.CUSTOM_OWNS_RELATION,
        displayName: 'GP Owns',
        cardinality: 'ONE_TO_MANY',
      },
    ];
    await addRelationTypesWithCardinality(apiContext, E2E_CUSTOM_TYPE);

    // termProduct is patched twice (partOf termCategory, relatedTo termBrand)
    // so these must remain sequential to avoid a PATCH race.
    await addTermRelation(
      apiContext,
      this.termProduct,
      this.termCategory,
      'partOf'
    );
    await addTermRelation(
      apiContext,
      this.termBrand,
      this.termCategory,
      'partOf'
    );
    await addTermRelation(
      apiContext,
      this.termProduct,
      this.termBrand,
      'relatedTo'
    );
    // Re-assert the custom type immediately before using it: a concurrent
    // worker whose snapshot pre-dates our registration may have issued a stale
    // PUT that overwrote it during the addTermRelation calls above.
    await addRelationTypesWithCardinality(apiContext, E2E_CUSTOM_TYPE);
    await addTermRelation(
      apiContext,
      this.termCategory,
      this.termBrand,
      this.CUSTOM_OWNS_RELATION
    );
  }

  static async teardown(apiContext: APIRequestContext): Promise<void> {
    // Glossary.delete uses ?recursive=true&hardDelete=true — all child terms
    // are cascade-deleted; no need to delete each term individually.
    await this.catalog.delete(apiContext);
  }
}

// ---------------------------------------------------------------------------
// Cardinality spec data — glossary with 12 terms covering all cardinality types
// ---------------------------------------------------------------------------

type RelationTypeSpec = {
  name: string;
  displayName: string;
  cardinality: string;
  sourceMax?: number | null;
  targetMax?: number | null;
};

export class OntologyStudioCardinalityData {
  static readonly CUSTOM_RELATION_NAMES = {
    ONE_TO_ONE: `pw-c-oto-${RUN_ID}`,
    ONE_TO_MANY: `pw-c-otm-${RUN_ID}`,
    MANY_TO_ONE: `pw-c-mto-${RUN_ID}`,
    MANY_TO_MANY: `pw-c-mtm-${RUN_ID}`,
    CUSTOM_1_M: `pw-c-cus-${RUN_ID}`,
  } as const;

  // Each relation type gets its own isolated source-target pair so no single
  // term accumulates multiple cardinality-constrained relations, which would
  // trigger backend re-validation failures on the second PATCH.
  static readonly glossary = new Glossary();
  static readonly otoSrc = new GlossaryTerm(this.glossary);
  static readonly otoDst = new GlossaryTerm(this.glossary);
  static readonly otmSrc = new GlossaryTerm(this.glossary);
  static readonly otmDst = new GlossaryTerm(this.glossary);
  static readonly mtoSrc = new GlossaryTerm(this.glossary);
  static readonly mtoDst = new GlossaryTerm(this.glossary);
  static readonly mtmSrc = new GlossaryTerm(this.glossary);
  static readonly mtmDst = new GlossaryTerm(this.glossary);
  static readonly cusSrc = new GlossaryTerm(this.glossary);
  static readonly cusDst = new GlossaryTerm(this.glossary);
  static readonly relSrc = new GlossaryTerm(this.glossary);
  static readonly relDst = new GlossaryTerm(this.glossary);

  private static get ALL_CUSTOM_TYPES(): RelationTypeSpec[] {
    return [
      {
        name: this.CUSTOM_RELATION_NAMES.ONE_TO_ONE,
        displayName: 'PW One To One',
        cardinality: 'ONE_TO_ONE',
      },
      {
        name: this.CUSTOM_RELATION_NAMES.ONE_TO_MANY,
        displayName: 'PW One To Many',
        cardinality: 'ONE_TO_MANY',
      },
      {
        name: this.CUSTOM_RELATION_NAMES.MANY_TO_ONE,
        displayName: 'PW Many To One',
        cardinality: 'MANY_TO_ONE',
      },
      {
        name: this.CUSTOM_RELATION_NAMES.MANY_TO_MANY,
        displayName: 'PW Many To Many',
        cardinality: 'MANY_TO_MANY',
      },
      {
        name: this.CUSTOM_RELATION_NAMES.CUSTOM_1_M,
        displayName: 'PW Custom 1:M',
        cardinality: 'CUSTOM',
        sourceMax: 1,
        targetMax: null,
      },
    ];
  }

  static async setup(apiContext: APIRequestContext): Promise<void> {
    await this.glossary.create(apiContext);

    // All 12 terms are independent POSTs — parallelize for speed.
    await Promise.all([
      this.otoSrc.create(apiContext),
      this.otoDst.create(apiContext),
      this.otmSrc.create(apiContext),
      this.otmDst.create(apiContext),
      this.mtoSrc.create(apiContext),
      this.mtoDst.create(apiContext),
      this.mtmSrc.create(apiContext),
      this.mtmDst.create(apiContext),
      this.cusSrc.create(apiContext),
      this.cusDst.create(apiContext),
      this.relSrc.create(apiContext),
      this.relDst.create(apiContext),
    ]);

    // Add all custom relation types in a single batch RMW to minimise the
    // conflict window with concurrent parallel workers.
    const types = this.ALL_CUSTOM_TYPES;
    await addRelationTypesWithCardinality(apiContext, types);
    // Idempotency guard: a concurrent worker with a stale snapshot can
    // overwrite our types between the add above and the term patches below.
    await addRelationTypesWithCardinality(apiContext, types);

    // Each source term is patched exactly once, so all 6 relations can be
    // issued in parallel without any write-write conflict.
    await Promise.all([
      addTermRelation(
        apiContext,
        this.otoSrc,
        this.otoDst,
        this.CUSTOM_RELATION_NAMES.ONE_TO_ONE
      ),
      addTermRelation(
        apiContext,
        this.otmSrc,
        this.otmDst,
        this.CUSTOM_RELATION_NAMES.ONE_TO_MANY
      ),
      addTermRelation(
        apiContext,
        this.mtoSrc,
        this.mtoDst,
        this.CUSTOM_RELATION_NAMES.MANY_TO_ONE
      ),
      addTermRelation(
        apiContext,
        this.mtmSrc,
        this.mtmDst,
        this.CUSTOM_RELATION_NAMES.MANY_TO_MANY
      ),
      addTermRelation(
        apiContext,
        this.cusSrc,
        this.cusDst,
        this.CUSTOM_RELATION_NAMES.CUSTOM_1_M
      ),
      addTermRelation(apiContext, this.relSrc, this.relDst, 'relatedTo'),
    ]);
  }

  static async teardown(apiContext: APIRequestContext): Promise<void> {
    // Cascade-deletes all 12 child terms.
    await this.glossary.delete(apiContext);
  }
}

// ---------------------------------------------------------------------------
// GlossaryTermRelationsGraph spec data
// ---------------------------------------------------------------------------

export class GlossaryTermRelationsGraphData {
  // Same-glossary group: termA has relatedTo termB and seeAlso termD; termC is unrelated.
  static readonly glossary = new Glossary();
  static readonly termA = new GlossaryTerm(this.glossary);
  static readonly termB = new GlossaryTerm(this.glossary);
  static readonly termC = new GlossaryTerm(this.glossary);
  static readonly termD = new GlossaryTerm(this.glossary);

  // Cross-glossary group: termInX (glossaryX) has relatedTo termInY (glossaryY).
  static readonly glossaryX = new Glossary();
  static readonly glossaryY = new Glossary();
  static readonly termInX = new GlossaryTerm(this.glossaryX);
  static readonly termInY = new GlossaryTerm(this.glossaryY);

  static async setup(apiContext: APIRequestContext): Promise<void> {
    await Promise.all([
      this.glossary.create(apiContext),
      this.glossaryX.create(apiContext),
      this.glossaryY.create(apiContext),
    ]);
    await Promise.all([
      this.termA.create(apiContext),
      this.termB.create(apiContext),
      this.termC.create(apiContext),
      this.termD.create(apiContext),
      this.termInX.create(apiContext),
      this.termInY.create(apiContext),
    ]);
    // termA is patched twice (relatedTo termB, seeAlso termD) — must be sequential.
    await addTermRelation(apiContext, this.termA, this.termB, 'relatedTo');
    await addTermRelation(apiContext, this.termA, this.termD, 'seeAlso');
    await addTermRelation(apiContext, this.termInX, this.termInY, 'relatedTo');
  }

  static async teardown(apiContext: APIRequestContext): Promise<void> {
    // Each glossary cascade-deletes its child terms via ?recursive=true&hardDelete=true.
    await Promise.all([
      this.glossary.delete(apiContext),
      this.glossaryX.delete(apiContext),
      this.glossaryY.delete(apiContext),
    ]);
  }
}

// ---------------------------------------------------------------------------
// OntologyStudio.spec.ts data — 3 glossaries
// ---------------------------------------------------------------------------

export class OntologyStudioPageData {
  // glossary: term1 relatedTo term2
  static readonly glossary = new Glossary();
  static readonly term1 = new GlossaryTerm(this.glossary);
  static readonly term2 = new GlossaryTerm(this.glossary);

  // glossary2: isolated terms (no relations) — used to trigger empty state
  static readonly glossary2 = new Glossary();
  static readonly term3 = new GlossaryTerm(this.glossary2);
  static readonly term4 = new GlossaryTerm(this.glossary2);

  // multiRelGlossary: two relation types between the same term pair
  static readonly multiRelGlossary = new Glossary();
  static readonly multiRelTermA = new GlossaryTerm(this.multiRelGlossary);
  static readonly multiRelTermB = new GlossaryTerm(this.multiRelGlossary);

  static async setup(apiContext: APIRequestContext): Promise<void> {
    await Promise.all([
      this.glossary.create(apiContext),
      this.glossary2.create(apiContext),
      this.multiRelGlossary.create(apiContext),
    ]);
    await Promise.all([
      this.term1.create(apiContext),
      this.term2.create(apiContext),
      this.term3.create(apiContext),
      this.term4.create(apiContext),
      this.multiRelTermA.create(apiContext),
      this.multiRelTermB.create(apiContext),
    ]);
    await addTermRelation(apiContext, this.term1, this.term2, 'relatedTo');
    // multiRelTermA is patched twice — must stay sequential.
    await addTermRelation(
      apiContext,
      this.multiRelTermA,
      this.multiRelTermB,
      'relatedTo'
    );
    await addTermRelation(
      apiContext,
      this.multiRelTermA,
      this.multiRelTermB,
      'partOf'
    );
  }

  static async teardown(apiContext: APIRequestContext): Promise<void> {
    await Promise.all([
      this.glossary.delete(apiContext),
      this.glossary2.delete(apiContext),
      this.multiRelGlossary.delete(apiContext),
    ]);
  }
}

// ---------------------------------------------------------------------------
// OntologyStudioInteractions — Isolated nodes + relation filter combo
// ---------------------------------------------------------------------------

export class OntologyStudioComboData {
  static readonly comboGlossary = new Glossary();
  static readonly connectedTermA = new GlossaryTerm(this.comboGlossary);
  static readonly connectedTermB = new GlossaryTerm(this.comboGlossary);
  static readonly isolatedTerm = new GlossaryTerm(this.comboGlossary);

  static async setup(apiContext: APIRequestContext): Promise<void> {
    await this.comboGlossary.create(apiContext);
    await Promise.all([
      this.connectedTermA.create(apiContext),
      this.connectedTermB.create(apiContext),
      this.isolatedTerm.create(apiContext),
    ]);
    await addTermRelation(
      apiContext,
      this.connectedTermA,
      this.connectedTermB,
      'relatedTo'
    );
  }

  static async teardown(apiContext: APIRequestContext): Promise<void> {
    await this.comboGlossary.delete(apiContext);
  }
}

// ---------------------------------------------------------------------------
// OntologyStudioInteractions — Cross-glossary term hydration
// ---------------------------------------------------------------------------

export class OntologyStudioCrossGlossaryData {
  static readonly salesGlossary = new Glossary();
  static readonly financeGlossary = new Glossary();
  static readonly termRevenue = new GlossaryTerm(this.salesGlossary);
  static readonly termExpense = new GlossaryTerm(this.financeGlossary);

  static async setup(apiContext: APIRequestContext): Promise<void> {
    await Promise.all([
      this.salesGlossary.create(apiContext),
      this.financeGlossary.create(apiContext),
    ]);
    await Promise.all([
      this.termRevenue.create(apiContext),
      this.termExpense.create(apiContext),
    ]);
    await addTermRelation(
      apiContext,
      this.termRevenue,
      this.termExpense,
      'relatedTo'
    );
  }

  static async teardown(apiContext: APIRequestContext): Promise<void> {
    await Promise.all([
      this.salesGlossary.delete(apiContext),
      this.financeGlossary.delete(apiContext),
    ]);
  }
}

// ---------------------------------------------------------------------------
// OntologyStudioInteractions — Embedded scope (Relations Graph tab)
// ---------------------------------------------------------------------------

export class OntologyStudioEmbeddedData {
  static readonly embeddedGlossary = new Glossary();
  static readonly termA = new GlossaryTerm(this.embeddedGlossary);
  static readonly termB = new GlossaryTerm(this.embeddedGlossary);
  static readonly termC = new GlossaryTerm(this.embeddedGlossary);

  static async setup(apiContext: APIRequestContext): Promise<void> {
    await this.embeddedGlossary.create(apiContext);
    await Promise.all([
      this.termA.create(apiContext),
      this.termB.create(apiContext),
      this.termC.create(apiContext),
    ]);
    await addTermRelation(apiContext, this.termA, this.termB, 'relatedTo');
  }

  static async teardown(apiContext: APIRequestContext): Promise<void> {
    await this.embeddedGlossary.delete(apiContext);
  }
}

// ---------------------------------------------------------------------------
// OntologyStudioIsolatedToggle.spec.ts data
// ---------------------------------------------------------------------------

export class OntologyStudioIsolatedToggleData {
  static readonly toggleGlossary = new Glossary();
  static readonly toggleTermA = new GlossaryTerm(this.toggleGlossary);
  static readonly toggleTermB = new GlossaryTerm(this.toggleGlossary);
  static readonly toggleTermIso = new GlossaryTerm(this.toggleGlossary);

  static async setup(apiContext: APIRequestContext): Promise<void> {
    await this.toggleGlossary.create(apiContext);
    await Promise.all([
      this.toggleTermA.create(apiContext),
      this.toggleTermB.create(apiContext),
      this.toggleTermIso.create(apiContext),
    ]);
    await addTermRelation(
      apiContext,
      this.toggleTermA,
      this.toggleTermB,
      'relatedTo'
    );
  }

  static async teardown(apiContext: APIRequestContext): Promise<void> {
    await this.toggleGlossary.delete(apiContext);
  }
}

// ---------------------------------------------------------------------------
// OntologyStudio.spec.ts scope data — two glossaries, one with a relation
// ---------------------------------------------------------------------------

export class OntologyStudioFiltersData {
  // glossary: term1 relatedTo term2 (1 relation for filter stats assertions)
  static readonly glossary = new Glossary();
  static readonly term1 = new GlossaryTerm(this.glossary);
  static readonly term2 = new GlossaryTerm(this.glossary);

  // glossary2: term3 and term4 with no relations (isolated, for 0-relation stats)
  static readonly glossary2 = new Glossary();
  static readonly term3 = new GlossaryTerm(this.glossary2);
  static readonly term4 = new GlossaryTerm(this.glossary2);

  static async setup(apiContext: APIRequestContext): Promise<void> {
    await Promise.all([
      this.glossary.create(apiContext),
      this.glossary2.create(apiContext),
    ]);
    await Promise.all([
      this.term1.create(apiContext),
      this.term2.create(apiContext),
      this.term3.create(apiContext),
      this.term4.create(apiContext),
    ]);
    await addTermRelation(apiContext, this.term1, this.term2, 'relatedTo');
  }

  static async teardown(apiContext: APIRequestContext): Promise<void> {
    await Promise.all([
      this.glossary.delete(apiContext),
      this.glossary2.delete(apiContext),
    ]);
  }
}
