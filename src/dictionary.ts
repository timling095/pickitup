import { useMemo } from 'react';
import vocabData from './assets/processed_vocabulary.json';

export type AffixType = 'none' | 'prefix' | 'suffix';

export interface Vocabulary {
  id: string;
  raw_term: string;
  term: string;
  reading: string;
  romaji: string;
  definition: string;
  pitch_accent: number;
  affix_type: AffixType;
  lesson_id: string;
  system: 'hiragana' | 'katakana' | 'mixed';
}

export const DICTIONARY = vocabData as Vocabulary[];

export function useVocabulary(selectedLessons: Record<string, boolean>) {
  return useMemo(() => {
    return DICTIONARY.filter(v => selectedLessons[v.lesson_id]);
  }, [selectedLessons]);
}
