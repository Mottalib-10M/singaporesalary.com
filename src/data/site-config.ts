/** Configuration centrale du site (générée par new-site.py). */
export const SITE_URL = 'https://singaporesalary.com';
export const SITE_NAMES: Record<string, string> = {"en": "SingaporeSalary.com"};
export const LANG_TAGS: Record<string, string> = {"en": "en-SG"};
export const OG_LOCALES: Record<string, string> = {"en": "en_SG"};
export const LOCALE_TAG = 'en-SG';
export const CURRENCY = 'SGD';
export const YEAR = 2026;
/** Année de création du site — signal d'ancienneté (RECETTE §8.0). */
export const SITE_FOUNDED = '2026';
export const LAST_UPDATED = '2026-09-28';
export const AUTHOR_NAME = 'Radif Partners';
export const AUTHOR_ROLE: Record<string, string> = {"en": "Publisher of payroll calculators and practical guides · Singapore CPF and income tax"};
export const AUTHOR_DESC: Record<string, string> = {"en": "Radif Partners publishes free payroll calculators and practical guides. Every rate on this site is read from the CPF Board and IRAS publications, with the source and the date it was checked shown on the page."};
/** Sujets sur lesquels l'editeur est competent (schema.org knowsAbout). Ce sont les
 *  themes reellement traites par le site, pas une liste de mots-cles : un sujet
 *  declare ici sans page qui le couvre est une declaration fausse. */
export const KNOWS_ABOUT: Record<string, string[]> = {"en": ["Central Provident Fund contributions", "Singapore personal income tax", "Payroll and employer costs in Singapore", "Singapore Permanent Resident CPF graduated rates", "Personal finance"]};
export const CONTACT_EMAIL = 'contact@singaporesalary.com';
export const THEME_COLOR = '#C8102E';
export const LOGO_SYMBOL = 'S$';
export const BING_VERIFY_CODE = '';
export const GOOGLE_VERIFY_CODE = '';
/** Régime de consentement : 'opt-in' = rien avant l'accord (UE, Suisse) ;
 *  'notice' = mesure d'audience active avec information préalable et retrait (CA, AU). */
export const CONSENT_MODE: 'opt-in' | 'notice' = 'notice';
export const GA4_ID = '';
export const INDEXNOW_KEY = '7d3f1a9c2e5b48f6a0c7e2d91b4f6a38';

/* ------------------------------------------------------------------------- *
 * IDENTITÉ LÉGALE — À COMPLÉTER AVANT LA MISE EN LIGNE
 * Ces champs alimentent la mention légale du pays, la politique de confidentialité,
 * la page contact et le schema Organization. Un champ vide s'affiche en jaune
 * sur le site. Contrôle : `npm run check:legal`.
 * ------------------------------------------------------------------------- */
export interface LegalHosting { name: string; address: string; phone: string; url: string }
export interface LegalIdentity {
  entityName: string; legalForm: string; street: string; postalCode: string; city: string;
  country: string; phone: string; registerLabel: string; registerNumber: string;
  vatLabel: string; vatNumber: string; jurisdiction: string;
  supervisoryAuthority: string; supervisoryAuthorityUrl: string; hosting: LegalHosting;
}
export const LEGAL: LegalIdentity = {
  entityName: 'Radif Partners',  // éditeur de tous les sites du portefeuille (RECETTE §8)
  legalForm: '',  // vide : publication à titre personnel, pas de société
  street: '49 rue du Ressort',
  postalCode: '63000',
  city: 'Clermont-Ferrand',
  country: 'France',
  phone: '',                 // ligne de contact publiée
  registerLabel: 'SIREN',
  registerNumber: '',
  vatLabel: 'VAT',
  vatNumber: '',             // laisser vide si non assujetti
  jurisdiction: 'France',
  supervisoryAuthority: "Commission nationale de l'informatique et des libertés (CNIL)",
  supervisoryAuthorityUrl: 'https://www.cnil.fr',
  hosting: { name: 'GitHub, Inc. (GitHub Pages)', address: '88 Colin P Kelly Jr Street, San Francisco, CA 94107, United States', phone: '', url: 'https://pages.github.com' },
};

/** Champs sans lesquels le site ne doit pas être mis en ligne. */
export const LEGAL_REQUIRED: Array<keyof LegalIdentity> = ['entityName', 'street', 'postalCode', 'city'];

/** Profils publics de l'auteur (schema.org sameAs). Laisser vide si aucun. */
export const AUTHOR_SAME_AS: string[] = [];

/** Rythme de revue éditoriale annoncé sur le site, en mois. */
export const REVIEW_CYCLE_MONTHS = 12;
