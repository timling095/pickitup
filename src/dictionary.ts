import { useMemo } from 'react';
import vocabData from './assets/processed_vocabulary.json';

export type AffixType = 'none' | 'prefix' | 'suffix';

// All pos values present in the dataset. The five user-visible filter categories
// are: verb, na_adj, i_adj, noun, other. The remaining pos values (pronoun,
// interjection, conjunction, pre_noun, counter, adverb, phrase, prefix, suffix,
// and the catch-all other) all collapse into the "other" filter bucket.
export type PosType =
  | 'verb' | 'na_adj' | 'i_adj' | 'noun'
  | 'adverb' | 'pronoun' | 'interjection' | 'conjunction'
  | 'pre_noun' | 'counter' | 'prefix' | 'suffix' | 'phrase'
  | 'other';

export interface Vocabulary {
  id: string;
  raw_term: string;
  term: string;
  reading: string;
  definition: string;
  pitch_accent: number;
  affix_type: AffixType;
  lesson_id: string;
  // Part-of-speech data sourced from the tableConvert CSVs.
  pos: PosType;
  pos_raw: string;           // Original Chinese 詞性 label, kept for traceability.
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

// The five user-visible word-type filter categories.
export type WordType = 'verb' | 'na_adj' | 'i_adj' | 'noun' | 'other';

// Maps a vocabulary entry's pos to one of the five filter buckets.
export function wordTypeOf(v: Vocabulary): WordType {
  if (v.pos === 'verb')   return 'verb';
  if (v.pos === 'na_adj') return 'na_adj';
  if (v.pos === 'i_adj')  return 'i_adj';
  if (v.pos === 'noun')   return 'noun';
  return 'other';
}

// isVerb is kept for backward compatibility (FlashcardEngine, TermsList, etc.)
// and now reads from the pos field rather than the dic_form heuristic.
export function isVerb(v: Vocabulary): boolean {
  return v.pos === 'verb';
}

// Traditional dictionary-style abbreviations for the Terms Viewer's narrow "form" column.
const POS_ABBREVIATIONS: Record<PosType, string> = {
  verb: 'v.',
  na_adj: 'na-adj.',
  i_adj: 'i-adj.',
  noun: 'n.',
  adverb: 'adv.',
  pronoun: 'pron.',
  interjection: 'interj.',
  conjunction: 'conj.',
  pre_noun: 'pre-n.',
  counter: 'ctr.',
  prefix: 'pref.',
  suffix: 'suf.',
  phrase: 'phr.',
  other: '—',
};

export function abbreviatePos(v: Vocabulary): string {
  return POS_ABBREVIATIONS[v.pos];
}

export function filterByWordType(vocabList: Vocabulary[], selectedWordTypes: Record<WordType, boolean>): Vocabulary[] {
  return vocabList.filter(v => selectedWordTypes[wordTypeOf(v)]);
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
