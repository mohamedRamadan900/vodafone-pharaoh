import { CharacteristicKeys, InquiryDTO } from '../models/inquiry.dto';
import { IWorldCup26CamInquiryData } from '../models/mapped-inquiry';

export function toCharMap(inquiry: InquiryDTO): Record<string, string> {
  return Object.fromEntries(
    inquiry.characteristics.map((characteristic) => [characteristic.name, characteristic.value])
  );
}

export function mapInquiry(inquiries: InquiryDTO[]): IWorldCup26CamInquiryData {
  const [promo] = inquiries;
  const chars = promo ? toCharMap(promo) : {};
  const trialCapping = Number(chars[CharacteristicKeys.TRIALS_CAPPING] ?? 0);
  const giftCapping = Number(chars[CharacteristicKeys.GIFT_CAPPING] ?? 0);
  const hasWallet = Boolean(Number(chars[CharacteristicKeys.HAS_WALLET] ?? 0));
  const hasReachedTrialCapping = trialCapping === 1;

  return {
    giftId: promo?.id ?? '',
    trialCapping,
    giftCapping,
    giftRedemptionDate: chars[CharacteristicKeys.GIFT_REDEMPTION_DATE] ?? '',
    hasTrials: !hasReachedTrialCapping,
    noTrials: hasReachedTrialCapping,
    hasWallet,
  };
}
