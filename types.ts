
export interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
  dataUrl: string; // Base64 image with transparency mask
  type: 'image' | 'text';
  text?: string;
  fontSize?: number;
  textColor?: string;
  textHeightPx?: number;
  isBold?: boolean;
  preserveBackground?: boolean; // New: If true, renders image behind text
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface Page {
  id: string;
  pageNumber: number;
  imageSrc: string;
  width: number;
  height: number;
  blocks: Block[];
  status: ProcessingStatus;
  granularity?: number;
  processedGranularity?: number;
}