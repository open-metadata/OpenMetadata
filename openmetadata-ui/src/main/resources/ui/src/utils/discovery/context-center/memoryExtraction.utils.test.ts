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
import { MemoryExtractionAction } from '../../../constants/ContextCenter.constants';
import { Reason } from '../../../generated/api/context/extractionAvailability';
import {
  ContextFile,
  ProcessingStatus,
} from '../../../generated/entity/data/contextFile';
import { PageProcessingStatus } from '../../../generated/entity/data/page';
import { User } from '../../../generated/entity/teams/user';
import {
  KnowledgePage,
  PageType,
} from '../../../interface/knowledge-center.interface';
import {
  canRequestMemoryExtraction,
  getArticleExtractionAction,
  getExtractionUnavailableMessageKey,
  getFileExtractionAction,
  withExtractionState,
} from './memoryExtraction.utils';

const file = (overrides: Partial<ContextFile>): ContextFile => ({
  id: 'file-1',
  name: 'report.pdf',
  headContentId: 'content-1',
  processingStatus: ProcessingStatus.Processed,
  neverExtracted: false,
  ...overrides,
});

const article = (overrides: Partial<KnowledgePage> = {}): KnowledgePage => ({
  id: 'page-1',
  name: 'gdpr',
  fullyQualifiedName: 'gdpr',
  description: '<p>GDPR covers the personal data of every EU resident.</p>',
  version: 0.2,
  updatedAt: 1,
  updatedBy: 'alice',
  href: '',
  pageType: PageType.ARTICLE,
  page: { publicationDate: new Date(0), relatedArticles: [] },
  deleted: false,
  ...overrides,
});

const user = (overrides: Partial<User> = {}): User => ({
  id: 'user-alice',
  name: 'alice',
  email: 'alice@example.com',
  ...overrides,
});

describe('getFileExtractionAction', () => {
  it('extracts a file the server reports never extracted', () => {
    expect(getFileExtractionAction(file({ neverExtracted: true }))).toBe(
      MemoryExtractionAction.Extract
    );
  });

  it('retries a failed file from its content snapshot', () => {
    expect(
      getFileExtractionAction(
        file({ processingStatus: ProcessingStatus.Failed })
      )
    ).toBe(MemoryExtractionAction.Retry);
  });

  // A Collate chat attachment has no content snapshot, so the server has nothing to retry.
  it('offers nothing for a failed file without a content snapshot', () => {
    expect(
      getFileExtractionAction(
        file({
          headContentId: undefined,
          processingStatus: ProcessingStatus.Failed,
        })
      )
    ).toBeUndefined();
  });

  it.each([
    ProcessingStatus.Processed,
    ProcessingStatus.Unsupported,
    ProcessingStatus.Uploaded,
    ProcessingStatus.Analyzing,
    ProcessingStatus.ExtractingContext,
  ])(
    'offers nothing for a %s file that was extracted or is under way',
    (status) => {
      expect(
        getFileExtractionAction(file({ processingStatus: status }))
      ).toBeUndefined();
    }
  );

  it('does not guess from a read that did not ask whether the file was extracted', () => {
    expect(
      getFileExtractionAction(file({ neverExtracted: undefined }))
    ).toBeUndefined();
  });
});

describe('getArticleExtractionAction', () => {
  it('extracts an article the server reports never extracted', () => {
    expect(getArticleExtractionAction(article({ neverExtracted: true }))).toBe(
      MemoryExtractionAction.Extract
    );
  });

  it('retries a failed article', () => {
    expect(
      getArticleExtractionAction(
        article({ processingStatus: PageProcessingStatus.Failed })
      )
    ).toBe(MemoryExtractionAction.Retry);
  });

  it.each([
    PageProcessingStatus.Queued,
    PageProcessingStatus.Processing,
    PageProcessingStatus.Processed,
  ])('offers nothing for a %s article', (status) => {
    expect(
      getArticleExtractionAction(article({ processingStatus: status }))
    ).toBeUndefined();
  });

  // The endpoint reads only live articles, and an archived one is restored before it is edited.
  it('offers nothing on an archived article', () => {
    expect(
      getArticleExtractionAction(
        article({
          deleted: true,
          neverExtracted: true,
          processingStatus: PageProcessingStatus.Failed,
        })
      )
    ).toBeUndefined();
  });
});

describe('canRequestMemoryExtraction', () => {
  const owners = [
    { id: 'user-alice', type: 'user', name: 'alice' },
    { id: 'team-finance', type: 'team', name: 'finance' },
  ];

  it('lets an owner of the document request it', () => {
    expect(canRequestMemoryExtraction(user(), owners)).toBe(true);
  });

  it('lets a member of an owning team request it', () => {
    expect(
      canRequestMemoryExtraction(
        user({
          id: 'user-bob',
          name: 'bob',
          teams: [{ id: 'team-finance', type: 'team' }],
        }),
        owners
      )
    ).toBe(true);
  });

  it('lets an admin who owns nothing request it', () => {
    expect(
      canRequestMemoryExtraction(
        user({ id: 'user-root', name: 'root', isAdmin: true }),
        []
      )
    ).toBe(true);
  });

  it('refuses anyone else', () => {
    expect(
      canRequestMemoryExtraction(
        user({
          id: 'user-bob',
          name: 'bob',
          teams: [{ id: 'team-sales', type: 'team' }],
        }),
        owners
      )
    ).toBe(false);
  });

  // A read that did not load the owners cannot say this user owns the document.
  it('refuses a non-admin when the owners were not loaded', () => {
    expect(canRequestMemoryExtraction(user(), undefined)).toBe(false);
  });

  it('refuses while no user is signed in', () => {
    expect(canRequestMemoryExtraction(undefined, owners)).toBe(false);
  });
});

describe('getExtractionUnavailableMessageKey', () => {
  it('gives no reason while extraction is available', () => {
    expect(
      getExtractionUnavailableMessageKey({ available: true })
    ).toBeUndefined();
  });

  // The server decides on every request; an unread availability does not disable the action.
  it('gives no reason before the availability is read', () => {
    expect(getExtractionUnavailableMessageKey(undefined)).toBeUndefined();
  });

  it('says extraction is off', () => {
    expect(
      getExtractionUnavailableMessageKey({
        available: false,
        reason: Reason.ExtractionDisabled,
      })
    ).toBe('message.memory-extraction-off');
  });

  // OSS's default provider never answers it; a provider with a platform of its own does.
  it('says the AI platform is off', () => {
    expect(
      getExtractionUnavailableMessageKey({
        available: false,
        reason: Reason.ProviderDisabled,
      })
    ).toBe('message.memory-extraction-ai-platform-off');
  });

  it('says the AI service is unavailable', () => {
    expect(
      getExtractionUnavailableMessageKey({
        available: false,
        reason: Reason.ProviderUnavailable,
      })
    ).toBe('message.memory-extraction-service-unavailable');
  });

  it('reads a reason newer than this UI, or none, as the service being unavailable', () => {
    expect(
      getExtractionUnavailableMessageKey({
        available: false,
        reason: 'QuotaExceeded' as Reason,
      })
    ).toBe('message.memory-extraction-service-unavailable');
    expect(getExtractionUnavailableMessageKey({ available: false })).toBe(
      'message.memory-extraction-service-unavailable'
    );
  });
});

describe('withExtractionState', () => {
  it('takes the extraction state of the article that was read', () => {
    const failed = article({
      processingStatus: PageProcessingStatus.Failed,
      processingError: 'Provider exploded',
    });

    expect(
      withExtractionState(failed, {
        id: 'page-1',
        neverExtracted: false,
        processingStatus: PageProcessingStatus.Queued,
      })
    ).toEqual({
      ...failed,
      neverExtracted: false,
      processingError: undefined,
      processingStatus: PageProcessingStatus.Queued,
    });
  });

  it('leaves another article as it is', () => {
    const shown = article({ id: 'page-2', neverExtracted: true });

    expect(
      withExtractionState(shown, {
        id: 'page-1',
        neverExtracted: false,
        processingStatus: PageProcessingStatus.Queued,
      })
    ).toBe(shown);
  });

  it('keeps no article when none is shown', () => {
    expect(
      withExtractionState(undefined, {
        id: 'page-1',
        processingStatus: PageProcessingStatus.Queued,
      })
    ).toBeUndefined();
  });
});
