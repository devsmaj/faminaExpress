class I18n {
    constructor() {
        const saved = localStorage.getItem('language');
        this.currentLanguage = ['en', 'fr-TD', 'ar-TD'].includes(saved) ? saved : 'fr-TD';
        this.translations = {};
        this.observers = [];
        this.requestId = 0;
    }
    async loadLanguage(lang) {
        if (!['en', 'fr-TD', 'ar-TD'].includes(lang)) return false;
        const requestId = ++this.requestId;
        try {
            const response = await fetch(`assets/locales/${lang}.json`);
            if (!response.ok) throw new Error('Language unavailable');
            const data = await response.json();
            if (requestId !== this.requestId) return false;
            this.translations = data;
            this.currentLanguage = lang;
            localStorage.setItem('language', lang);
            document.documentElement.lang = lang;
            document.documentElement.dir = lang === 'ar-TD' ? 'rtl' : 'ltr';
            this.updatePageTranslations();
            this.observers.forEach(callback => callback(lang));
            document.dispatchEvent(new CustomEvent('languagechange', { detail: lang }));
            return true;
        } catch (error) { console.error('Could not load language:', error); return false; }
    }
    t(key, fallback = '') {
        const value = key.split('.').reduce((value, part) => value?.[part], this.translations);
        return typeof value === 'string' ? value : fallback || key;
    }
    getCurrentLanguage() { return this.currentLanguage; }
    async setLanguage(lang) { return this.loadLanguage(lang); }
    updatePageTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const translation = this.t(element.getAttribute('data-i18n'), element.textContent);
            if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) element.placeholder = translation;
            else if (element.textContent !== translation) element.textContent = translation;
        });
        for (const attribute of ['title', 'value', 'aria-label']) {
            document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => {
                element.setAttribute(attribute, this.t(element.getAttribute(`data-i18n-${attribute}`)));
            });
        }
        document.querySelectorAll('[data-language-select]').forEach(select => select.value = this.currentLanguage);
        const titleKey = document.body.dataset.authPage;
        if (titleKey) document.title = `${this.t(`auth.${titleKey}_title`)} - FA-MINNA Express`;
    }
    async init() { if (!await this.loadLanguage(this.currentLanguage)) await this.loadLanguage('en'); }
    subscribe(callback) { this.observers.push(callback); }
    unsubscribe(callback) { this.observers = this.observers.filter(observer => observer !== callback); }
}
const i18n = new I18n();
window.i18n = i18n;
document.addEventListener('change', async event => {
    if (!event.target.matches('[data-language-select]')) return;
    if (!await i18n.setLanguage(event.target.value)) event.target.value = i18n.getCurrentLanguage();
});
document.addEventListener('componentloaded', () => i18n.updatePageTranslations());
// main.js injects this script after DOMContentLoaded, so initialize immediately then.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => i18n.init());
else i18n.init();
if (typeof module !== 'undefined' && module.exports) module.exports = I18n;
