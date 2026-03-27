import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../../generated/entity/type';
import { VersionStatus } from '../../../../utils/EntityVersionUtils.interface';

export interface TermItem {
  value: string;
  label: string;
  entity?: EntityReference;
}

export interface TermSelectItem {
  id: string;
  label?: string;
}

export interface RelationEditRow {
  id: string;
  relationType: string;
  terms: TermItem[];
}

export interface RelationTypeOption {
  id: string;
  label?: string;
  title?: string;
}

export interface TermsRowProps {
  rowId: string;
  initialRelationType: string;
  initialTerms: TermItem[];
  relationTypeOptions: RelationTypeOption[];
  excludeFQN: string;
  preloadedTerms: GlossaryTerm[];
  onRelationTypeChange: (rowId: string, relationType: string) => void;
  onTermsChange: (rowId: string, terms: TermItem[]) => void;
  onRemove: (rowId: string) => void;
}

export interface TermsRowEditorProps {
  rows: RelationEditRow[];
  excludeFQN: string;
  preloadedTerms: GlossaryTerm[];
  relationTypeOptions: RelationTypeOption[];
  onAddRow: () => void;
  onRelationTypeChange: (rowId: string, relationType: string) => void;
  onTermsChange: (rowId: string, terms: TermItem[]) => void;
  onRemove: (rowId: string) => void;
}

export interface RelatedTermTagButtonProps {
  entity: EntityReference;
  relationType?: string;
  versionStatus?: VersionStatus;
  getRelationDisplayName: (relationType: string) => string;
  onRelatedTermClick: (fqn: string) => void;
}
