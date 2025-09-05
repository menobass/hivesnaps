/**
 * Utility functions for filtering content based on muted users
 */

// Filter out content from muted users completely (for feeds)
export const filterMutedContent = <T extends { author: string }>(
  content: T[],
  mutedUsers: Set<string>
): T[] => {
  return content.filter(item => !mutedUsers.has(item.author));
};

// Create placeholder for muted user content (for conversations)
export const createMutedUserPlaceholder = (originalContent: any) => {
  return {
    ...originalContent,
    body: '[Content from muted user]',
    json_metadata: '{}',
    posting_json_metadata: '{}',
    isMutedUserContent: true, // Flag to identify placeholder content
  };
};

// Process content with muted user placeholders (for conversations)
export const processContentWithMutedPlaceholders = <T extends { author: string }>(
  content: T[],
  mutedUsers: Set<string>
): T[] => {
  return content.map(item => {
    if (mutedUsers.has(item.author)) {
      return createMutedUserPlaceholder(item) as T;
    }
    return item;
  });
};

// Check if content is from a muted user
export const isContentFromMutedUser = (
  content: { author: string },
  mutedUsers: Set<string>
): boolean => {
  return mutedUsers.has(content.author);
};

// Check if content is a muted user placeholder
export const isMutedUserPlaceholder = (content: any): boolean => {
  return content.isMutedUserContent === true;
};
