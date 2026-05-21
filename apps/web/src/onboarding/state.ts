import type { HifzDirection, OnboardingFinishInput } from '@tahfeedh/shared';

export type OnboardingPath = 'fresh' | 'partial' | 'complete';

export type StepNumber = 1 | 2 | 3;

export interface SurahSelection {
  surah: number;
  upToAyah?: number;
}

export interface InProgressMarker {
  juz: number;
  surah: number;
  ayah: number;
}

export interface OnboardingState {
  step: StepNumber;
  path: OnboardingPath | null;
  direction: HifzDirection;
  juzs: number[];
  surahs: SurahSelection[];
  inProgress: InProgressMarker | undefined;
  newPerDay: number;
  revisionPerDay: number;
  submitting: boolean;
  error: string | null;
}

export const initialState: OnboardingState = {
  step: 1,
  path: null,
  direction: 'forward',
  juzs: [],
  surahs: [],
  inProgress: undefined,
  newPerDay: 1,
  revisionPerDay: 3,
  submitting: false,
  error: null,
};

export type Action =
  | { type: 'SET_PATH'; path: OnboardingPath }
  | { type: 'SET_DIRECTION'; direction: HifzDirection }
  | { type: 'TOGGLE_JUZ'; juz: number }
  | { type: 'SET_JUZS'; juzs: number[] }
  | { type: 'TOGGLE_SURAH'; surah: number }
  | { type: 'SET_SURAH_PARTIAL'; surah: number; upToAyah: number | undefined }
  | { type: 'SET_IN_PROGRESS'; marker: InProgressMarker | undefined }
  | { type: 'SET_NEW_PER_DAY'; value: number }
  | { type: 'SET_REVISION_PER_DAY'; value: number }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SET_SUBMITTING'; submitting: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'HYDRATE'; patch: Partial<OnboardingState> };

export function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case 'SET_PATH':
      return { ...state, path: action.path };

    case 'SET_DIRECTION':
      return { ...state, direction: action.direction };

    case 'TOGGLE_JUZ': {
      const has = state.juzs.includes(action.juz);
      return {
        ...state,
        juzs: has ? state.juzs.filter((j) => j !== action.juz) : [...state.juzs, action.juz].sort((a, b) => a - b),
      };
    }

    case 'SET_JUZS':
      return { ...state, juzs: [...action.juzs].sort((a, b) => a - b) };

    case 'TOGGLE_SURAH': {
      const idx = state.surahs.findIndex((s) => s.surah === action.surah);
      if (idx >= 0) {
        return { ...state, surahs: state.surahs.filter((_, i) => i !== idx) };
      }
      return {
        ...state,
        surahs: [...state.surahs, { surah: action.surah }].sort((a, b) => a.surah - b.surah),
      };
    }

    case 'SET_SURAH_PARTIAL': {
      const idx = state.surahs.findIndex((s) => s.surah === action.surah);
      const next: SurahSelection = { surah: action.surah, upToAyah: action.upToAyah };
      if (idx >= 0) {
        const out = state.surahs.slice();
        out[idx] = next;
        return { ...state, surahs: out };
      }
      return { ...state, surahs: [...state.surahs, next].sort((a, b) => a.surah - b.surah) };
    }

    case 'SET_IN_PROGRESS':
      return { ...state, inProgress: action.marker };

    case 'SET_NEW_PER_DAY':
      return { ...state, newPerDay: action.value };

    case 'SET_REVISION_PER_DAY':
      return { ...state, revisionPerDay: action.value };

    case 'NEXT': {
      if (state.step === 1) {
        if (state.path === 'partial') return { ...state, step: 2 };
        return { ...state, step: 3 };
      }
      if (state.step === 2) return { ...state, step: 3 };
      return state;
    }

    case 'BACK': {
      if (state.step === 3) {
        return { ...state, step: state.path === 'partial' ? 2 : 1 };
      }
      if (state.step === 2) return { ...state, step: 1 };
      return state;
    }

    case 'SET_SUBMITTING':
      return { ...state, submitting: action.submitting };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'HYDRATE':
      return { ...state, ...action.patch };
  }
}

/** Build the request payload to send to POST /api/onboarding/finish. */
export function toFinishPayload(state: OnboardingState): OnboardingFinishInput {
  if (!state.path) throw new Error('toFinishPayload: path not chosen');
  return {
    path: state.path,
    selections: {
      juzs: state.juzs,
      surahs: state.surahs,
      inProgress: state.inProgress,
    },
    session: {
      newPerDay: state.newPerDay,
      revisionPerDay: state.revisionPerDay,
    },
    hifzDirection: state.direction,
  };
}
