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
import { fireEvent, render, screen } from '@testing-library/react';
import SsoSamlMetadataUpload from './SsoSamlMetadataUpload';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.fileName ? `${key}:${params.fileName}` : key,
  }),
}));

const props = {
  fileName: 'idp.xml',
  onUpload: jest.fn(),
  onChangeFile: jest.fn(),
};

describe('SsoSamlMetadataUpload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts one XML file and hands it over for parsing', () => {
    render(<SsoSamlMetadataUpload {...props} status={null} />);
    const input = screen.getByTestId(
      'sso-saml-metadata-input'
    ) as HTMLInputElement;
    const file = new File(['<xml />'], 'idp.xml', { type: 'text/xml' });

    expect(input).toHaveAttribute('accept', '.xml,application/xml,text/xml');
    expect(input.multiple).toBe(false);

    fireEvent.change(input, { target: { files: [file] } });

    expect(props.onUpload).toHaveBeenCalled();
    expect(props.onUpload.mock.calls[0][0][0]).toBe(file);
  });

  it('reports a parsed file and lets the admin pick another', () => {
    render(<SsoSamlMetadataUpload {...props} status="success" />);

    expect(screen.getByTestId('sso-saml-metadata-status')).toHaveTextContent(
      'message.metadata-xml-file-parsed-success:idp.xml'
    );

    fireEvent.click(screen.getByTestId('change-metadata-xml-btn'));

    expect(props.onChangeFile).toHaveBeenCalled();
  });

  it('reports a file that could not be parsed', () => {
    render(<SsoSamlMetadataUpload {...props} status="error" />);

    expect(screen.getByTestId('sso-saml-metadata-status')).toHaveTextContent(
      'message.metadata-xml-file-parsed-error:idp.xml'
    );
    expect(
      screen.queryByTestId('sso-saml-metadata-upload')
    ).not.toBeInTheDocument();
  });
});
