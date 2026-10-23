import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./ar.json";
import en from "./en.json";

let lang = "ar";
try { lang = localStorage.getItem("evias.lang") || "ar"; } catch { /* storage blocked */ }

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: lang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
