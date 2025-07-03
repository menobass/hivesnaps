declare module 'react-native-image-viewing' {
  import { ComponentType } from 'react';
  import { StyleProp, ViewStyle } from 'react-native';

  export interface ImageSource {
    uri: string;
    headers?: { [key: string]: string };
  }

  export interface ImageViewingProps {
    images: ImageSource[];
    imageIndex: number;
    visible: boolean;
    onRequestClose: () => void;
    backgroundColor?: string;
    swipeToCloseEnabled?: boolean;
    doubleTapToZoomEnabled?: boolean;
    presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
    animationType?: 'fade' | 'slide' | 'none';
    HeaderComponent?: ComponentType<any>;
    FooterComponent?: ComponentType<any>;
  }

  const ImageViewing: ComponentType<ImageViewingProps>;
  export default ImageViewing;
}
