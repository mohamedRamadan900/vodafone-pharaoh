export type InquiryDTO = {
  id: string;
  name: string;
  validFor?: Record<string, unknown>;
  channel?: Channel;
  characteristics: Characteristic[];
  pattern: Pattern[];
};

export type Channel = {
  id?: string;
};

export type Characteristic = {
  name: string;
  value: string;
  '@type'?: string;
};

export type Pattern = {
  trigger?: string;
  priority?: number;
  validFor?: {
    startDateTime?: number;
    endDateTime?: number;
  };
  action?: Action[];
  price?: Price;
};

export type Action = {
  id?: string;
  actionType?: string;
  actionValue?: number;
};

export type Price = {
  value?: number;
  unit?: string;
};

export const CharacteristicKeys = {
  TRIALS_CAPPING: 'TRIALS_REACHED_CAPPING',
  GIFT_CAPPING: 'GIFT_REACHED_CAPPING',
  GIFT_REDEMPTION_DATE: 'giftRedemptionDate',
  HAS_WALLET: 'HAS_CASH_WALLET',
} as const;

export type CharacteristicKey = (typeof CharacteristicKeys)[keyof typeof CharacteristicKeys];
