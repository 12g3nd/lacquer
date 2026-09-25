import i18next, { init, t as i18t, changeLanguage } from 'i18next';
import { loadLanguageResources } from 'virtual:i18n';

export const APPLICATION_NAME = 'Lacquer';

/**
 * Initialises i18next with English (the fallback) plus `language`, not all 68
 * bundled languages — every full page load pays for whatever the preload and
 * renderer load here. `setLanguage` fetches any other language on demand.
 */
export const loadI18n = async (language = 'en') =>
  await init({
    resources: await loadLanguageResources(['en', language]),
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export const setLanguage = async (language: string) => {
  if (!i18next.hasResourceBundle(language, 'translation')) {
    const resources = await loadLanguageResources([language]);
    const bundle = resources[language]?.translation;
    if (bundle) i18next.addResourceBundle(language, 'translation', bundle);
  }
  return await changeLanguage(language);
};

export const t = i18t.bind(i18next);
