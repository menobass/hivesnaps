import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, AppAction } from './types';
import { appReducer, initialAppState } from './reducer';

// Context types
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// Hook to use the context
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// Convenience hooks for specific slices
export const useUserState = () => {
  const { state, dispatch } = useAppContext();
  return {
    ...state.user,
    dispatch: (action: any) => dispatch({ type: 'USER', payload: action }),
  };
};

export const useHiveState = () => {
  const { state, dispatch } = useAppContext();
  return {
    ...state.hive,
    dispatch: (action: any) => dispatch({ type: 'HIVE', payload: action }),
  };
};

export const useNotificationState = () => {
  const { state, dispatch } = useAppContext();
  return {
    ...state.notifications,
    dispatch: (action: any) => dispatch({ type: 'NOTIFICATIONS', payload: action }),
  };
};
