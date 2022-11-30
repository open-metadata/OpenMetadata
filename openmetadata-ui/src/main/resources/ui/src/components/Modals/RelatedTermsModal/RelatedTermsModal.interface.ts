import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';

export type RelatedTermsModalProp = {
  glossaryTermFQN?: string;
  relatedTerms?: Array<GlossaryTerm>;
  onCancel: () => void;
  onSave: (terms: Array<GlossaryTerm>) => void;
  header: string;
  visible: boolean;
};
