import { environment } from 'src/environments/environment';

export const APIConfig = {
  pharaohs_dataList: {
    // testing
    // url: (lang: string) => `${environment.api}o/webContentApiV2/contentList/11797079/all/${lang}`,
    // staging
    url: (lang: string) => `${environment.api}o/webContentApiV2/contentList/14148040/all/${lang}`,
  },
};
