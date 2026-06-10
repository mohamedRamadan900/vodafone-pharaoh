import { TYPE } from '../defines/defines';
import {
  IAttachment,
  ICharacteristic,
  IWorldCup26CamRequestBody,
  IWorldCup26CamRequestPayload,
} from '../models/world-cup26-cam.dto';

export const WorldCup26CamRequestConfig = {
  redemptionBody: (payload: IWorldCup26CamRequestPayload): IWorldCup26CamRequestBody => {
    const attachment: IAttachment[] = [
      {
        attachmentType: 'Image',
        content: payload.imageBase64,
        mimeType: payload.mimeType,
      },
    ];

    const characteristics: ICharacteristic[] = [
      {
        name: 'pharaohName',
        value: payload.pharaohName,
      },
    ];

    const body: IWorldCup26CamRequestBody = {
      '@type': TYPE,
      id: payload.giftId, // {{gift_token}}
      attachment,
      characteristics,
    };

    return body;
  },
} as const;
