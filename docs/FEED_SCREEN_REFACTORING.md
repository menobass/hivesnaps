# FeedScreen Refactoring: Separating Business Logic from UI

## Problem Statement

The original `FeedScreen.tsx` was a massive 2,160-line component that mixed business logic with UI rendering, making it:

- **Hard to maintain**: Changes to business logic required touching UI code
- **Difficult to test**: Business logic was tightly coupled to React components
- **Not reusable**: Logic couldn't be shared between different screens
- **Hard to debug**: Issues could be in UI, state management, or API calls

## Solution: Custom Hooks Architecture

Instead of Redux (which would be overkill), we implemented a **Custom Hooks + React Context** pattern that provides:

### 1. **useFeedData** - Feed Management

```typescript
const {
  snaps,
  loading: feedLoading,
  error: feedError,
  fetchSnaps,
  refreshSnaps,
} = useFeedData(username);
```

**Responsibilities:**

- Fetch snaps for different filters (newest, following, trending, my)
- Handle caching with 5-minute expiration
- Avatar enhancement and caching
- Error handling and loading states

### 2. **useUserAuth** - User Authentication & Profile

```typescript
const {
  username,
  avatarUrl,
  hasUnclaimedRewards,
  votingPower,
  vpLoading,
  loading: userLoading,
  logout,
} = useUserAuth();
```

**Responsibilities:**

- User authentication state
- Profile data fetching
- Voting power management
- Logout functionality

### 3. **useUpvote** - Voting Functionality

```typescript
const {
  upvoteModalVisible,
  voteWeight,
  voteValue,
  upvoteLoading,
  openUpvoteModal,
  confirmUpvote,
  updateSnapsOptimistically,
} = useUpvote(username, globalProps, rewardFund, hivePrice);
```

**Responsibilities:**

- Upvote modal state management
- Vote weight calculation
- Optimistic UI updates
- Blockchain transaction handling

### 4. **useSearch** - Search Functionality

```typescript
const {
  query: searchQuery,
  type: searchType,
  results: searchResults,
  recentSearches,
  search: handleSearch,
  saveToRecentSearches,
} = useSearch();
```

**Responsibilities:**

- User and content search
- Recent searches management
- Search history persistence
- Search type switching

### 5. **useHiveData** - Blockchain Data

```typescript
const { hivePrice, globalProps, rewardFund } = useHiveData();
```

**Responsibilities:**

- HIVE price fetching
- Global blockchain properties
- Reward fund data
- Data refresh management

## Benefits of This Approach

### ✅ **Separation of Concerns**

- **UI Components**: Focus only on rendering and user interactions
- **Custom Hooks**: Handle all business logic, API calls, and state management
- **Clear Boundaries**: Easy to understand what each part does

### ✅ **Reusability**

- Hooks can be used across different screens
- `useFeedData` works for FeedScreen, DiscoveryScreen, ProfileScreen
- `useSearch` can be used in any screen that needs search

### ✅ **Testability**

- Business logic can be tested independently of UI
- Hooks can be unit tested with mock data
- UI components can be tested with mock hooks

### ✅ **Maintainability**

- Changes to business logic don't affect UI code
- New features can be added by creating new hooks
- Bug fixes are isolated to specific hooks

### ✅ **Performance**

- Hooks can implement their own caching strategies
- State updates are optimized per hook
- Unnecessary re-renders are minimized

## Before vs After

### Before (Original FeedScreen)

```typescript
// 2,160 lines of mixed concerns
const FeedScreen = () => {
  // 50+ state variables
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  // ... 47 more state variables

  // 20+ useEffect hooks
  useEffect(() => { /* fetch user */ }, []);
  useEffect(() => { /* fetch snaps */ }, [activeFilter]);
  // ... 18 more effects

  // 15+ complex functions
  const fetchSnaps = async () => { /* 50 lines */ };
  const handleUpvote = async () => { /* 40 lines */ };
  // ... 13 more functions

  // 500+ lines of JSX
  return (
    <View>
      {/* Complex UI with embedded logic */}
    </View>
  );
};
```

### After (Refactored FeedScreen)

```typescript
// 400 lines focused on UI only
const FeedScreenRefactored = () => {
  // Clean hook usage
  const { snaps, loading, fetchSnaps } = useFeedData(username);
  const { username, avatarUrl, logout } = useUserAuth();
  const { upvoteModalVisible, openUpvoteModal } = useUpvote(...);
  const { searchQuery, handleSearch } = useSearch();

  // Simple event handlers
  const handleFilterPress = (filter) => setActiveFilter(filter);
  const handleUpvotePress = (target) => openUpvoteModal(target);

  // Clean JSX focused on layout
  return (
    <View>
      {/* UI components with clear props */}
    </View>
  );
};
```

## Migration Strategy

### Phase 1: Create Hooks (✅ Complete)

- Extract business logic into custom hooks
- Maintain existing functionality
- Add proper TypeScript interfaces

### Phase 2: Update FeedScreen (✅ Complete)

- Replace inline logic with hook calls
- Remove duplicate state management
- Simplify event handlers

### Phase 3: Apply to Other Screens

- Use `useFeedData` in DiscoveryScreen and ProfileScreen
- Use `useSearch` in other search-enabled screens
- Use `useUserAuth` across the app

### Phase 4: Add Features

- Implement pagination in `useFeedData`
- Add offline support
- Add real-time updates

## Why Not Redux?

For this app, Redux would be overkill because:

1. **Simple State**: Most state is local to specific features
2. **No Complex State Sharing**: Different screens don't need to share much state
3. **Performance**: Custom hooks are more performant for local state
4. **Bundle Size**: Redux adds significant bundle size
5. **Learning Curve**: Team can focus on React patterns they already know

## Future Considerations

### When to Consider Redux:

- If state sharing becomes complex across many screens
- If you need advanced dev tools for debugging
- If you need middleware for side effects
- If the team is already familiar with Redux

### Alternative State Management:

- **Zustand**: Lighter alternative to Redux
- **Jotai**: Atomic state management
- **Valtio**: Proxy-based state management

## Conclusion

This refactoring demonstrates that **you don't always need Redux** for clean architecture. Custom hooks provide:

- **Better separation of concerns**
- **Improved testability**
- **Enhanced reusability**
- **Simpler debugging**
- **Better performance**

The FeedScreen is now focused purely on layout and user interactions, while all business logic is cleanly separated into reusable, testable hooks.
