declare module 'react-native-share-menu' {
  export interface ShareItem {
    data: string;
    mimeType?: string;
  }

  export interface ShareData {
    data?: string | ShareItem[];
    mimeType?: string;
  }

  export type ShareListener = (share: ShareData) => void;

  interface ShareMenuInterface {
    getInitialShare(): Promise<ShareData | null>;
    addNewShareListener(listener: ShareListener): void;
    removeNewShareListener(listener: ShareListener): void;
  }

  const ShareMenu: ShareMenuInterface;
  export default ShareMenu;
}
