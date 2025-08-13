import { AppState, AppAction } from './types';
import { userReducer, initialUserState } from './userSlice';
import { hiveReducer, initialHiveState } from './hiveSlice';
import { notificationReducer, initialNotificationState } from './notificationSlice';

// Initial app state
export const initialAppState: AppState = {
  user: initialUserState,
  hive: initialHiveState,
  notifications: initialNotificationState,
};

// Root reducer
export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'USER':
      return {
        ...state,
        user: userReducer(state.user, action.payload),
      };

    case 'HIVE':
      return {
        ...state,
        hive: hiveReducer(state.hive, action.payload),
      };

    case 'NOTIFICATIONS':
      return {
        ...state,
        notifications: notificationReducer(state.notifications, action.payload),
      };

    default:
      return state;
  }
};
