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
import { render } from '@testing-library/react';
import BlockEditor from './BlockEditor';

jest.mock(
  '../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider',
  () => ({
    useEntityAttachment: () => ({ isPopoverOpenRef: { current: false } }),
  })
);

describe('BlockEditor', () => {
  afterEach(() => jest.useRealTimers());

  // The editor used to start editable and switch on a deferred timer, so in
  // between a click on a previewed "@name" could open a mention popup.
  it('starts read-only when not editable, before any timer runs', () => {
    jest.useFakeTimers();
    const { container } = render(
      <BlockEditor content="<p>hello @alice</p>" editable={false} />
    );

    expect(container.querySelector('.ProseMirror')).toHaveAttribute(
      'contenteditable',
      'false'
    );
  });

  it('starts editable by default', () => {
    const { container } = render(<BlockEditor content="<p>hello</p>" />);

    expect(container.querySelector('.ProseMirror')).toHaveAttribute(
      'contenteditable',
      'true'
    );
  });
});
