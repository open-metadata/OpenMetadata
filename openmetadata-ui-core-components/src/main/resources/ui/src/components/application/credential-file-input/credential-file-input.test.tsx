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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  CredentialFileInput,
  DEFAULT_CREDENTIAL_FILE_MAX_SIZE,
} from './credential-file-input';

const PEM =
  '-----BEGIN PRIVATE KEY-----\nMIIEvg==\n-----END PRIVATE KEY-----\n';

const pemFile = (name = 'key.pem') =>
  new File([PEM], name, { type: 'application/x-pem-file' });

/** A file whose bytes are not valid UTF-8 — stands in for DER/PKCS#12. */
const binaryFile = (name = 'key.p12') =>
  new File([new Uint8Array([0x30, 0x82, 0xff, 0xfe, 0xff])], name);

const oversizedFile = () => {
  const file = new File([PEM], 'huge.pem');
  Object.defineProperty(file, 'size', {
    value: DEFAULT_CREDENTIAL_FILE_MAX_SIZE + 1,
  });

  return file;
};

const dropFiles = (files: File[]) => {
  fireEvent.drop(screen.getByTestId('credential-file-dropzone'), {
    dataTransfer: { files },
  });
};

describe('CredentialFileInput', () => {
  describe('upload-only mode (uiFieldType: file)', () => {
    it('renders the drop zone and no manual-input textarea', () => {
      render(<CredentialFileInput label="Private Key" />);

      expect(
        screen.getByTestId('credential-file-dropzone')
      ).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('submits the file content when a file is chosen with the picker', async () => {
      const onChange = vi.fn();
      render(<CredentialFileInput onChange={onChange} />);

      await userEvent.upload(
        screen.getByTestId('credential-file-input'),
        pemFile()
      );

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(PEM));
      expect(screen.getByTestId('credential-file-name')).toHaveTextContent(
        'key.pem'
      );
    });

    it('submits the same content when the file is dropped', async () => {
      const onChange = vi.fn();
      render(<CredentialFileInput onChange={onChange} />);

      dropFiles([pemFile()]);

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(PEM));
    });

    it('keeps only the first file when several are dropped', async () => {
      const onChange = vi.fn();
      render(<CredentialFileInput onChange={onChange} />);

      dropFiles([pemFile('first.pem'), pemFile('second.pem')]);

      await waitFor(() =>
        expect(screen.getByTestId('credential-file-name')).toHaveTextContent(
          'first.pem'
        )
      );
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('shows a chip for a credential already stored server-side', () => {
      render(<CredentialFileInput value="*********" />);

      expect(screen.getByTestId('credential-file-chip')).toBeInTheDocument();
      expect(
        screen.queryByTestId('credential-file-dropzone')
      ).not.toBeInTheDocument();
    });

    it('clears the value and restores the drop zone on remove', async () => {
      const onChange = vi.fn();
      render(<CredentialFileInput value={PEM} onChange={onChange} />);

      await userEvent.click(screen.getByTestId('credential-file-remove'));

      expect(onChange).toHaveBeenCalledWith(undefined);
    });
  });

  describe('rejections leave the value untouched', () => {
    it('rejects a file whose extension is not accepted', async () => {
      const onChange = vi.fn();
      render(
        <CredentialFileInput
          acceptedFileTypes={['.pem']}
          validationMessages={{ unacceptedType: 'Bad type' }}
          onChange={onChange}
        />
      );

      dropFiles([pemFile('notes.txt')]);

      expect(await screen.findByRole('alert')).toHaveTextContent('Bad type');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('rejects a file over the size limit', async () => {
      const onChange = vi.fn();
      render(
        <CredentialFileInput
          validationMessages={{ sizeLimit: 'Too big' }}
          onChange={onChange}
        />
      );

      dropFiles([oversizedFile()]);

      expect(await screen.findByRole('alert')).toHaveTextContent('Too big');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('rejects a binary file instead of saving mojibake', async () => {
      const onChange = vi.fn();
      render(
        <CredentialFileInput
          validationMessages={{ binary: 'Not text' }}
          onChange={onChange}
        />
      );

      dropFiles([binaryFile()]);

      expect(await screen.findByRole('alert')).toHaveTextContent('Not text');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('rejects a file that cannot be read', async () => {
      const onChange = vi.fn();
      vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(
        function (this: FileReader) {
          this.dispatchEvent(new Event('error'));
        }
      );

      render(
        <CredentialFileInput
          validationMessages={{ unreadable: 'Cannot read' }}
          onChange={onChange}
        />
      );

      dropFiles([pemFile()]);

      expect(await screen.findByRole('alert')).toHaveTextContent('Cannot read');
      expect(onChange).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('reports the rejection to the host form', async () => {
      const onValidationError = vi.fn();
      render(
        <CredentialFileInput
          acceptedFileTypes={['.pem']}
          onValidationError={onValidationError}
        />
      );

      dropFiles([pemFile('notes.txt')]);

      await waitFor(() =>
        expect(onValidationError).toHaveBeenCalledWith(
          expect.any(String),
          'unacceptedType'
        )
      );
    });
  });

  describe('manual input mode (uiFieldType: fileOrInput)', () => {
    it('offers both a drop zone and a masked textarea', () => {
      render(<CredentialFileInput allowManualInput label="Private Key" />);

      expect(
        screen.getByTestId('credential-file-dropzone')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', { name: 'Enter file content' })
      ).toBeInTheDocument();
    });

    it('submits typed content unchanged', async () => {
      const onChange = vi.fn();
      // The component is fully controlled, so a state owner is required for
      // successive keystrokes to accumulate rather than each replacing the last.
      const Harness = () => {
        const [value, setValue] = useState<string | undefined>();

        return (
          <CredentialFileInput
            allowManualInput
            value={value}
            onChange={(next) => {
              setValue(next);
              onChange(next);
            }}
          />
        );
      };

      render(<Harness />);

      await userEvent.type(screen.getByRole('textbox'), 'abc');

      expect(onChange).toHaveBeenLastCalledWith('abc');
    });

    it('produces the same value from a dropped file as from typing', async () => {
      const typed = vi.fn();
      const dropped = vi.fn();

      const { unmount } = render(
        <CredentialFileInput allowManualInput onChange={typed} />
      );
      fireEvent.change(screen.getByRole('textbox'), { target: { value: PEM } });
      unmount();

      render(<CredentialFileInput allowManualInput onChange={dropped} />);
      dropFiles([pemFile()]);

      await waitFor(() => expect(dropped).toHaveBeenCalled());
      expect(dropped.mock.calls[0][0]).toBe(typed.mock.calls[0][0]);
    });

    it('clears the value when the textarea is emptied', () => {
      const onChange = vi.fn();
      render(
        <CredentialFileInput allowManualInput value="x" onChange={onChange} />
      );

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith(undefined);
    });
  });

  describe('accessibility and disabled state', () => {
    it('exposes the drop zone as a keyboard-reachable button', () => {
      render(<CredentialFileInput />);

      const dropzone = screen.getByTestId('credential-file-dropzone');

      expect(dropzone).toHaveAttribute('role', 'button');
      expect(dropzone).toHaveAttribute('tabindex', '0');
    });

    it('opens the file picker from the keyboard', () => {
      render(<CredentialFileInput />);

      const input = screen.getByTestId('credential-file-input');
      const click = vi.spyOn(input, 'click');

      fireEvent.keyDown(screen.getByTestId('credential-file-dropzone'), {
        key: 'Enter',
      });

      expect(click).toHaveBeenCalled();
    });

    it('ignores a drop while disabled', () => {
      const onChange = vi.fn();
      render(<CredentialFileInput isDisabled onChange={onChange} />);

      dropFiles([pemFile()]);

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('credential-file-dropzone')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('ignores a drop while read-only', () => {
      const onChange = vi.fn();
      render(<CredentialFileInput isReadOnly onChange={onChange} />);

      dropFiles([pemFile()]);

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
