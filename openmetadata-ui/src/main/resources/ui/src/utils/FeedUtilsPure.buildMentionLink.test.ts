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

import { EntityType } from '../enums/entity.enum';
import { buildMentionLink } from './FeedUtilsPure';

// Mentions are the only place a feed turns an entity reference into a URL, so each branch here is
// a route contract. A failure means the route moved and mentions are about to 404.
describe('buildMentionLink', () => {
  const origin = `${document.location.protocol}//${document.location.host}`;

  it('routes a glossary term under /glossary', () => {
    expect(buildMentionLink(EntityType.GLOSSARY_TERM, 'Business.Revenue')).toBe(
      `${origin}/glossary/Business.Revenue`
    );
  });

  it('routes a tag to its classification, not its own FQN', () => {
    // There is no per-tag page; the UI opens the classification the tag belongs to.
    expect(buildMentionLink(EntityType.TAG, 'PII.Sensitive')).toBe(
      `${origin}/tags/PII`
    );
  });

  it('routes a knowledge page to the Context Center article route', () => {
    expect(
      buildMentionLink(EntityType.KNOWLEDGE_PAGE, 'Onboarding.Runbook')
    ).toBe(`${origin}/context-center/articles/Onboarding.Runbook`);
  });

  it('routes every other entity type under its own name', () => {
    expect(buildMentionLink(EntityType.TABLE, 'svc.db.sch.orders')).toBe(
      `${origin}/table/svc.db.sch.orders`
    );
  });

  it('encodes characters that would break the URL', () => {
    expect(
      buildMentionLink(EntityType.GLOSSARY_TERM, 'Business.Monthly Revenue')
    ).toBe(`${origin}/glossary/Business.Monthly%20Revenue`);
  });
});
