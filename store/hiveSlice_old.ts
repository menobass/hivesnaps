import { HiveState, HiveAction, CACHE_DURATIONS } from './types';

// Initial hive state
export const initialHiveState: HiveState = {
  data: {
    hivePrice: null,
    globalProps: null,
    rewardFund: null,
    lastUpdated: 0,
  },
  loading: false,
};

// Hive reducer
export const hiveReducer = (state: HiveState, action: HiveAction): HiveState => {
  switch (action.type) {
    case 'SET_HIVE_DATA':
      return {
        ...state,
        data: {
          ...state.data,
          ...action.payload,
          lastUpdated: Date.now(),
        },
        loading: false,
      };

    case 'SET_HIVE_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    default:
      return state;
  }
};

// Selectors
export const selectHiveData = (state: HiveState) => state.data;

export const selectHivePrice = (state: HiveState) => state.data.hivePrice;

export const selectGlobalProps = (state: HiveState) => state.data.globalProps;

export const selectRewardFund = (state: HiveState) => state.data.rewardFund;

export const selectIsHiveDataCached = (state: HiveState) => {
  const { lastUpdated } = state.data;
  if (!lastUpdated) return false;
  return Date.now() - lastUpdated < CACHE_DURATIONS.HIVE_DATA;
};

export const selectIsHiveLoading = (state: HiveState) => state.loading;
