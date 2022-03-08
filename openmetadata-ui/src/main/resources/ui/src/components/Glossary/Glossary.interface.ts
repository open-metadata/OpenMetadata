import { Paging } from 'Models';
import { Glossary } from '../../generated/entity/data/glossary';

export interface GlossaryProps {
  data: Array<Glossary>;
  paging: Paging;
  onPageChange: (type: string) => void;
}
