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
}

export const DICTIONARY = vocabData as Vocabulary[];

export function useVocabulary(lessonId?: string) {
  return useMemo(() => {
    if (!lessonId || lessonId === 'all') return DICTIONARY;
    return DICTIONARY.filter(v => v.lesson_id === lessonId);
  }, [lessonId]);
}
