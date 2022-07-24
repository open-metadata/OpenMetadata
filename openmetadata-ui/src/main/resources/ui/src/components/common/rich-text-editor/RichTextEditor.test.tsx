/*
 *  Copyright 2021 Collate
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

import { findByTestId, queryByTestId, render } from '@testing-library/react';
import React, { Component } from 'react';
import { MemoryRouter } from 'react-router-dom';
import RichTextEditor from './RichTextEditor';

jest.mock('@toast-ui/react-editor', () => {
  class Editor extends Component {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getInstance() {}

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getRootElement() {}

    render() {
      return <p>Editor</p>;
    }
  }

  class Viewer extends Component {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getInstance() {}

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getRootElement() {}

    render() {
      return <p>Viewer</p>;
    }
  }

  return {
    Editor,
    Viewer,
  };
});

const mockProp = {
  initialValue: '',
  readonly: false,
};

describe('Test RichText Editor', () => {
  it('Should render rich text editor', async () => {
    const { container } = render(<RichTextEditor {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const editor = await findByTestId(container, 'editor');

    expect(editor).toBeInTheDocument();
  });

  it('Should render viewer if readOnly is true', async () => {
    const { container } = render(<RichTextEditor {...mockProp} readonly />, {
      wrapper: MemoryRouter,
    });

    const editor = queryByTestId(container, 'editor');
    const viewer = await findByTestId(container, 'viewer');

    expect(editor).not.toBeInTheDocument();
    expect(viewer).toBeInTheDocument();
  });
});
