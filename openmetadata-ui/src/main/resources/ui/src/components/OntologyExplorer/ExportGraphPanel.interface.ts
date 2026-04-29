export enum ExportFormat {
  PNG = 'png',
  SVG = 'svg',
  JSONLD = 'jsonld',
  TURTLE = 'turtle',
  RDFXML = 'rdfxml',
}

export interface ExportGraphPanelProps {
  supportedExports?: ExportFormat[];
  onExportPng: () => Promise<void>;
  onExportSvg?: () => Promise<void>;
  onExportJsonLd?: () => Promise<void>;
  onExportTurtle?: () => Promise<void>;
  onExportRdfXml?: () => Promise<void>;
  'data-testid'?: string;
}
