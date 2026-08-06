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
  FieldDocPanel,
  FieldDocProvider,
  useFieldDoc,
} from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';

const NAME_DOC = 'The display name for this alert.';
const SOURCE_DOC = 'The type of asset this alert watches.';

function Fields({ withDocs = true }: { withDocs?: boolean }) {
  const nameDoc = useFieldDoc({
    doc: withDocs ? NAME_DOC : undefined,
    label: 'Name',
    name: 'name',
  });
  const sourceDoc = useFieldDoc({
    doc: withDocs ? SOURCE_DOC : undefined,
    label: 'Source',
    name: 'source',
  });

  return (
    <>
      <div {...nameDoc}>
        <input aria-label="Name" />
      </div>
      <div {...sourceDoc}>
        <input aria-label="Source" />
      </div>
      <input aria-label="Undocumented" />
    </>
  );
}

const renderPanel = (props: { withDocs?: boolean } = {}) =>
  render(
    <FieldDocProvider enabled>
      <Fields {...props} />
      <FieldDocPanel emptyState={<span>No field selected</span>} />
    </FieldDocProvider>
  );

describe('FieldDocPanel', () => {
  it('opens on the first documented field, so the panel is never blank on load', () => {
    renderPanel();

    expect(screen.getByText(NAME_DOC)).toBeInTheDocument();
    expect(screen.queryByText('No field selected')).not.toBeInTheDocument();
  });

  it('shows the focused field once the user moves off the first one', () => {
    renderPanel();
    fireEvent.focus(screen.getByLabelText('Source'));

    expect(screen.getByText(SOURCE_DOC)).toBeInTheDocument();
    expect(screen.queryByText(NAME_DOC)).not.toBeInTheDocument();
  });

  it('keeps the last doc when focus lands on an undocumented control', () => {
    renderPanel();
    const source = screen.getByLabelText('Source');
    fireEvent.focus(source);
    fireEvent.blur(source, {
      relatedTarget: screen.getByLabelText('Undocumented'),
    });

    // Falling back to the first field here would silently rewind the user's
    // place in the form, which is worse than the blank panel this replaced.
    expect(screen.getByText(SOURCE_DOC)).toBeInTheDocument();
  });

  it('falls back to the empty state when the form has no docs at all', () => {
    renderPanel({ withDocs: false });

    expect(screen.getByText('No field selected')).toBeInTheDocument();
  });
});
