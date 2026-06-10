import { PharaohProfile } from 'src/app/shared/app-standalone-components/pharaoh-similarity-camera/models/pharaoh.model';

export interface AITransformResponse {
  originalImageUrl: string;
  transformedImageUrl: string;
  transformedImageBase64?: string;
  pharaohMatch: PharaohProfile;
  similarityScore?: number;
  processedAt?: string;
}

export interface UploadPhotoRequest {
  imageBase64: string;
  mimeType: string;
  fileName: string;
}

export interface TransformPhotoRequest {
  photoId: string;
}

export interface ICharacteristic {
  name: string;
  value: string;
}

export interface IAttachment {
  attachmentType: string;
  content: string;
  mimeType: string;
}

export interface IWorldCup26CamRequestPayload {
  giftId: string;
  imageBase64: string;
  pharaohName: string;
  mimeType: string;
}

export interface IWorldCup26CamRequestBody {
  '@type': string;
  id: string;
  attachment: IAttachment[];
  characteristics: ICharacteristic[];
}

export interface WorldCup26RedemptionResponse {
  imageContent: string;
}

export interface ProcessingStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  transformId?: string;
  error?: string;
}

export interface WorldCup26CamState {
  currentPhotoId: string | null;
  transformId: string | null;
  transformResult: AITransformResponse | null;
  uploadProgress: number;
  processingProgress: number;
}
