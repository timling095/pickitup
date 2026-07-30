import { useMemo } from 'react';
import vocabData from './assets/processed_vocabulary.json';

export type AffixType = 'none' | 'prefix' | 'suffix';

export interface Vocabulary {
  id: string;
  raw_term: string;
  term: string;
  reading: string;
  definition: string;
  pitch_accent: number;
  affix_type: AffixType;
  lesson_id: string;
  dic_form?: string;
  dic_form_reading?: string;
  dic_form_pitch_accent?: number;
}

export const DICTIONARY = vocabData as Vocabulary[];

export function useVocabulary(selectedLessons: Record<string, boolean>) {
  return useMemo(() => {
    return DICTIONARY.filter(v => selectedLessons[v.lesson_id]);
  }, [selectedLessons]);
}

// For verbs with a recorded dictionary (辞書形) form, swaps term/reading/pitch_accent
// over to it — everything downstream (drills, terms list) reads those three fields
// generically, so no other code needs to know which form is active.
export function applyVerbForm(vocabList: Vocabulary[], useDicForm: boolean): Vocabulary[] {
  if (!useDicForm) return vocabList;
  return vocabList.map(v => {
    if (v.dic_form === undefined || v.dic_form_reading === undefined || v.dic_form_pitch_accent === undefined) {
      return v;
    }
    return {
      ...v,
      term: v.dic_form,
      reading: v.dic_form_reading,
      pitch_accent: v.dic_form_pitch_accent
    };
  });
}
