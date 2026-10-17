import type { Lang } from '@/lib/site';
import en, { type Dict } from './en';
import tr from './tr';
import de from './de';
import fr from './fr';
import es from './es';
import pt from './pt';
import ru from './ru';
import ja from './ja';
import ko from './ko';
import zh from './zh';
import ar from './ar';
import id from './id';

const DICTS: Record<Lang, Dict> = { tr, en, de, fr, es, pt, ru, ja, ko, zh, ar, id };
export const getDict = (l: Lang): Dict => DICTS[l];
export type { Dict };
