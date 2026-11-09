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
import { ProcessingStatus } from '../generated/entity/data/contextFile';
import { PageProcessingStatus } from '../generated/entity/data/page';
import { PageType } from '../interface/knowledge-center.interface';
import {
  isArticleNeverExtracted,
  isFileNeverExtracted,
} from './ContextCenterMemoryExtractionPureUtils';

const uploadedWhileExtractionWasOff = {
  headContentId: 'content-1',
  processingStatus: ProcessingStatus.Processed,
};

const articleWrittenWhileExtractionWasOff = {
  description: '<p>GDPR covers the personal data of every EU resident.</p>',
  pageType: PageType.ARTICLE,
};

describe('isFileNeverExtracted', () => {
  it('holds for a file uploaded while extraction was off', () => {
    expect(isFileNeverExtracted(uploadedWhileExtractionWasOff)).toBe(true);
  });

  it('does not hold for a file extracted into no memories', () => {
    expect(
      isFileNeverExtracted({
        ...uploadedWhileExtractionWasOff,
        extractionStats: {
          chunksProcessed: 1,
          chunksTotal: 1,
          pillsCreated: 0,
        },
      })
    ).toBe(false);
  });

  // A Collate chat attachment is copied in Processed but with no content snapshot.
  it('does not hold for a chat attachment', () => {
    expect(
      isFileNeverExtracted({
        ...uploadedWhileExtractionWasOff,
        headContentId: undefined,
      })
    ).toBe(false);
  });

  it.each(
    Object.values(ProcessingStatus).filter(
      (status) => status !== ProcessingStatus.Processed
    )
  )('does not hold for a %s file', (processingStatus) => {
    expect(
      isFileNeverExtracted({
        ...uploadedWhileExtractionWasOff,
        processingStatus,
      })
    ).toBe(false);
  });
});

describe('isArticleNeverExtracted', () => {
  it('holds for an article written while extraction was off', () => {
    expect(isArticleNeverExtracted(articleWrittenWhileExtractionWasOff)).toBe(
      true
    );
  });

  it.each(Object.values(PageProcessingStatus))(
    'does not hold once the article was %s',
    (processingStatus) => {
      expect(
        isArticleNeverExtracted({
          ...articleWrittenWhileExtractionWasOff,
          processingStatus,
        })
      ).toBe(false);
    }
  );

  it.each([undefined, '', ' \n\t '])(
    'does not hold for an article whose body is %p',
    (description) => {
      expect(
        isArticleNeverExtracted({
          ...articleWrittenWhileExtractionWasOff,
          description,
        })
      ).toBe(false);
    }
  );

  it('does not hold for a quick link', () => {
    expect(
      isArticleNeverExtracted({
        ...articleWrittenWhileExtractionWasOff,
        pageType: PageType.QUICK_LINK,
      })
    ).toBe(false);
  });
});
