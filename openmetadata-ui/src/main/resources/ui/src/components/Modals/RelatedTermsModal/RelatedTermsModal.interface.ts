import { FormattedGlossaryTermData } from 'Models';

export type RelatedTermsModalProp = {
  glossaryTermFQN?: string;
  relatedTerms?: Array<FormattedGlossaryTermData>;
  onCancel: () => void;
  onSave: (terms: Array<FormattedGlossaryTermData>) => void;
  header: string;
  visible: boolean;
};
