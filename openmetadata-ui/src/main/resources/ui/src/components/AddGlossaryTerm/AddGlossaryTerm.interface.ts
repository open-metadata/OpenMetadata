import { LoadingState } from 'Models';
import { CreateGlossaryTerm } from '../../generated/api/data/createGlossaryTerm';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';

export interface AddGlossaryTermProps {
  parentGlossaryData: GlossaryTerm | undefined;
  glossaryData: Glossary;
  saveState: LoadingState;
  allowAccess: boolean;
  onSave: (value: CreateGlossaryTerm) => void;
  onCancel: () => void;
}
