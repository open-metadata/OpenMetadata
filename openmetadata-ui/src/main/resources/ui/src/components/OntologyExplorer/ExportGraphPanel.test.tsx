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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { showErrorToast } from '../../utils/ToastUtils';
import ExportGraphPanel from './ExportGraphPanel';
import { ExportFormat } from './ExportGraphPanel.interface';

const EXPORT_TRIGGER_TESTID = 'ontology-export-graph';

const FORMAT_LABELS: Record<ExportFormat, string> = {
  [ExportFormat.PNG]: 'label.png-uppercase',
  [ExportFormat.SVG]: 'label.svg-uppercase',
  [ExportFormat.JSONLD]: 'label.json-ld',
  [ExportFormat.TURTLE]: 'label.skos-turtle',
  [ExportFormat.RDFXML]: 'label.owl-rdf-xml',
};

const resolved = (): jest.Mock<Promise<void>, []> =>
  jest.fn().mockResolvedValue(undefined);

const openMenu = async (): Promise<void> => {
  fireEvent.click(screen.getByTestId(EXPORT_TRIGGER_TESTID));

  await screen.findByText(FORMAT_LABELS[ExportFormat.PNG]);
};

describe('ExportGraphPanel', () => {
  it('shows PNG always and only shows optional formats whose callback is provided', async () => {
    render(<ExportGraphPanel onExportPng={resolved()} />);

    await openMenu();

    expect(
      screen.getByText(FORMAT_LABELS[ExportFormat.PNG])
    ).toBeInTheDocument();
    expect(
      screen.queryByText(FORMAT_LABELS[ExportFormat.SVG])
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(FORMAT_LABELS[ExportFormat.JSONLD])
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(FORMAT_LABELS[ExportFormat.TURTLE])
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(FORMAT_LABELS[ExportFormat.RDFXML])
    ).not.toBeInTheDocument();
  });

  it('renders every optional format when all callbacks are provided and supportedExports is undefined', async () => {
    render(
      <ExportGraphPanel
        onExportJsonLd={resolved()}
        onExportPng={resolved()}
        onExportRdfXml={resolved()}
        onExportSvg={resolved()}
        onExportTurtle={resolved()}
      />
    );

    await openMenu();

    Object.values(ExportFormat).forEach((format) => {
      expect(screen.getByText(FORMAT_LABELS[format])).toBeInTheDocument();
    });
  });

  it('filters menu items to the supportedExports allow-list', async () => {
    render(
      <ExportGraphPanel
        supportedExports={[ExportFormat.PNG, ExportFormat.TURTLE]}
        onExportJsonLd={resolved()}
        onExportPng={resolved()}
        onExportRdfXml={resolved()}
        onExportSvg={resolved()}
        onExportTurtle={resolved()}
      />
    );

    await openMenu();

    expect(
      screen.getByText(FORMAT_LABELS[ExportFormat.PNG])
    ).toBeInTheDocument();
    expect(
      screen.getByText(FORMAT_LABELS[ExportFormat.TURTLE])
    ).toBeInTheDocument();
    expect(
      screen.queryByText(FORMAT_LABELS[ExportFormat.SVG])
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(FORMAT_LABELS[ExportFormat.JSONLD])
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(FORMAT_LABELS[ExportFormat.RDFXML])
    ).not.toBeInTheDocument();
  });

  it('dispatches onExportPng when the PNG item is selected', async () => {
    const onExportPng = resolved();
    const onExportSvg = resolved();
    render(
      <ExportGraphPanel onExportPng={onExportPng} onExportSvg={onExportSvg} />
    );

    await openMenu();

    await act(async () => {
      fireEvent.click(screen.getByText(FORMAT_LABELS[ExportFormat.PNG]));
    });

    expect(onExportPng).toHaveBeenCalledTimes(1);
    expect(onExportSvg).not.toHaveBeenCalled();
  });

  it('dispatches the matching callback for an optional format', async () => {
    const onExportPng = resolved();
    const onExportTurtle = resolved();
    render(
      <ExportGraphPanel
        onExportPng={onExportPng}
        onExportTurtle={onExportTurtle}
      />
    );

    await openMenu();

    await act(async () => {
      fireEvent.click(screen.getByText(FORMAT_LABELS[ExportFormat.TURTLE]));
    });

    expect(onExportTurtle).toHaveBeenCalledTimes(1);
    expect(onExportPng).not.toHaveBeenCalled();
  });

  it('does not render or invoke optional formats when their callbacks are undefined', async () => {
    const onExportPng = resolved();
    render(
      <ExportGraphPanel
        supportedExports={Object.values(ExportFormat)}
        onExportPng={onExportPng}
      />
    );

    await openMenu();

    await act(async () => {
      fireEvent.click(screen.getByText(FORMAT_LABELS[ExportFormat.PNG]));
    });

    expect(onExportPng).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(FORMAT_LABELS[ExportFormat.SVG])
    ).not.toBeInTheDocument();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('shows an error toast and resets the exporting state when the callback rejects', async () => {
    const error = new Error('boom');
    const onExportPng = jest.fn().mockRejectedValue(error);
    render(<ExportGraphPanel onExportPng={onExportPng} />);

    await openMenu();

    await act(async () => {
      fireEvent.click(screen.getByText(FORMAT_LABELS[ExportFormat.PNG]));
    });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(
        String(error),
        'server.entity-fetch-error'
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId(EXPORT_TRIGGER_TESTID)).not.toBeDisabled();
    });
  });

  it('disables and loads the button while exporting and closes the menu on success', async () => {
    let resolveExport: () => void = () => undefined;
    const onExportPng = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveExport = resolve;
        })
    );
    render(<ExportGraphPanel onExportPng={onExportPng} />);

    await openMenu();

    fireEvent.click(screen.getByText(FORMAT_LABELS[ExportFormat.PNG]));

    const trigger = screen.getByTestId(EXPORT_TRIGGER_TESTID);

    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('data-loading', 'true');

    await act(async () => {
      resolveExport();
    });

    await waitFor(() => {
      expect(
        screen.queryByText(FORMAT_LABELS[ExportFormat.PNG])
      ).not.toBeInTheDocument();
    });

    expect(screen.getByTestId(EXPORT_TRIGGER_TESTID)).not.toBeDisabled();
  });
});
