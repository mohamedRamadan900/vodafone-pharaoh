import { environment } from 'src/environments/environment';

const inquiry = `${environment.api}services/dxl/promo/promotion?%40type=Promo&%24.context.type=worldCupWow26`;

export const APIConfig = {
  Inquiry: {
    url: () => inquiry,
  },
  RedemptionAndGeneration: {
    url: () => `${environment.api}services/dxl/pj/wc/journey/promoJourney`,
  },
  pharaohs_dataList: {
    // testing
    // url: (lang: string) => `${environment.api}o/webContentApiV2/contentList/11797079/all/${lang}`,
    // staging
    url: (lang: string) => `${environment.api}o/webContentApiV2/contentList/14148040/all/${lang}`,
  },
};
