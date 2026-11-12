// Local, deterministic translations. Never send personal or checkout data to a translation API.
class I18n {
    constructor() {
        const saved = localStorage.getItem('language');
        this.currentLanguage = ['en', 'fr-TD', 'ar-TD'].includes(saved) ? saved : 'fr-TD';
        this.translations = {};
        this.observers = [];
        this.records = new WeakMap();
        this.chartRecords = new WeakMap();
        this.requestId = 0;
        this.queued = false;
        this.observer = new MutationObserver(() => this.scheduleUpdate());
    }
    normalize(value) { return String(value).replace(/\s+/g, ' ').trim(); }
    async loadLanguage(lang) {
        if (!['en', 'fr-TD', 'ar-TD'].includes(lang)) return false;
        const requestId = ++this.requestId;
        try {
            let data = window.FAMINA_TRANSLATIONS?.[lang];
            if (!data) {
                const response = await fetch(`assets/locales/${lang}.json`);
                if (!response.ok) throw new Error('Language unavailable');
                data = await response.json();
            }
            if (requestId !== this.requestId) return false;
            this.translations = data;
            this.currentLanguage = lang;
            this.buildTextCatalog();
            localStorage.setItem('language', lang);
            document.documentElement.lang = lang;
            document.documentElement.dir = lang === 'ar-TD' ? 'rtl' : 'ltr';
            this.updatePageTranslations();
            for (const chart of Object.values(window.Chart?.instances || {})) chart.update('none');
            this.observers.forEach(callback => callback(lang));
            document.dispatchEvent(new CustomEvent('languagechange', { detail: lang }));
            return true;
        } catch (error) { console.error('Could not load language:', error); return false; }
    }
    buildTextCatalog() {
        this.textCatalog = new Map();
        const visit = (en, local) => {
            for (const [key, value] of Object.entries(en || {})) {
                if (['text', 'patterns', 'preserved'].includes(key)) continue;
                if (typeof value === 'string') this.textCatalog.set(this.normalize(value), local?.[key] || value);
                else if (value && typeof value === 'object') visit(value, local?.[key]);
            }
        };
        visit(window.FAMINA_TRANSLATIONS?.en, this.translations);
        for (const [source, target] of Object.entries(this.translations.text || {})) this.textCatalog.set(this.normalize(source), target);
        this.patterns = Object.entries(this.translations.patterns || {}).sort((a, b) => b[0].replace(/\{\d+\}/g, '').length - a[0].replace(/\{\d+\}/g, '').length).map(([source, target]) => {
            const indices = [];
            const escaped = source.split(/(\{\d+\})/).map(part => {
                if (/^\{\d+\}$/.test(part)) { indices.push(Number(part.slice(1,-1))); return '(.+?)'; }
                return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }).join('');
            return { regex: new RegExp('^' + escaped + '$'), target, indices };
        });
    }
    translateText(source, depth = 0) {
        const clean = this.normalize(source);
        if (!clean || this.currentLanguage === 'en' || this.translations.preserved?.includes(clean)) return source;
        let translated = this.textCatalog?.get(clean);
        if (translated === undefined && depth < 3 && clean.includes(', ')) {
            const parts = clean.split(', ');
            if (parts.every(part => this.textCatalog?.has(part))) {
                translated = parts.map(part => this.translateText(part, depth + 1)).join(this.currentLanguage === 'ar-TD' ? '، ' : ', ');
            }
        }
        if (translated === undefined && depth < 3) {
            for (const pattern of this.patterns || []) {
                const match = clean.match(pattern.regex);
                if (!match) continue;
                const values = {};
                pattern.indices.forEach((index, position) => values[index] = this.translateText(match[position+1], depth+1));
                translated = pattern.target.replace(/\{(\d+)\}/g, (_, index) => values[index]);
                break;
            }
        }
        if (translated === undefined) return source;
        return (String(source).match(/^\s*/)?.[0] || '') + translated + (String(source).match(/\s*$/)?.[0] || '');
    }
    t(key, fallback = '') {
        const value = key.split('.').reduce((value, part) => value?.[part], this.translations);
        return typeof value === 'string' ? value : fallback || key;
    }
    getCurrentLanguage() { return this.currentLanguage; }
    async setLanguage(lang) { return this.loadLanguage(lang); }
    localizeValue(node, key, current, write) {
        let record = this.records.get(node);
        if (!record) { record = {}; this.records.set(node, record); }
        const previous = record[key];
        const source = previous && previous.last === current ? previous.source : current;
        const last = this.translateText(source);
        record[key] = { source, last };
        if (current !== last) write(last);
    }
    scheduleUpdate() {
        if (this.queued) return;
        this.queued = true;
        requestAnimationFrame(() => { this.queued = false; this.updatePageTranslations(); });
    }
    updatePageTranslations() {
        this.observer.disconnect();
        try {
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const translation = this.t(element.dataset.i18n, element.textContent);
                if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) element.placeholder = translation;
                else if (element.textContent !== translation) element.textContent = translation;
            });
            for (const attribute of ['title', 'value', 'aria-label']) {
                document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => element.setAttribute(attribute, this.t(element.getAttribute(`data-i18n-${attribute}`))));
            }
            const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            for (const node of nodes) {
                if (!node.parentElement || node.parentElement.closest('script,style,noscript,textarea,code,[data-no-translate],[translate="no"],[data-i18n]')) continue;
                if (node.parentElement.tagName === 'TITLE' && document.body.dataset.authPage) continue;
                this.localizeValue(node, 'text', node.nodeValue, value => node.nodeValue = value);
            }
            document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(element => {
                if (element.closest('[data-no-translate],[translate="no"]')) return;
                for (const attribute of ['placeholder','title','aria-label','alt']) {
                    if (!element.hasAttribute(attribute) || element.hasAttribute(`data-i18n-${attribute}`) || (attribute === 'placeholder' && element.hasAttribute('data-i18n'))) continue;
                    this.localizeValue(element, attribute, element.getAttribute(attribute), value => element.setAttribute(attribute, value));
                }
            });
            const locale = this.currentLanguage;
            document.querySelectorAll('[data-localized-date]').forEach(element => {
                const date = new Date(element.getAttribute('datetime'));
                if (Number.isNaN(date.getTime())) return;
                const options = element.dataset.localizedDate === 'datetime'
                    ? { dateStyle: 'medium', timeStyle: 'short', hour12: false } : { dateStyle: 'medium' };
                element.textContent = new Intl.DateTimeFormat(locale, options).format(date);
            });
            document.querySelectorAll('[data-language-select]').forEach(select => select.value = locale);
            document.querySelectorAll('[data-language-choice]').forEach(button => button.setAttribute('aria-checked', String(button.dataset.languageChoice === locale)));
            document.querySelectorAll('[data-language-code]').forEach(label => label.textContent = locale.split('-')[0].toUpperCase());
            const titleKey = document.body.dataset.authPage;
            if (titleKey) document.title = `${this.t(`auth.${titleKey}_title`)} - FA-MINNA Express`;
        } finally {
            this.observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['placeholder','title','aria-label','alt'] });
        }
    }
    localizeChart(chart) {
        let source = this.chartRecords.get(chart);
        if (!source) {
            source = { labels: [...(chart.data.labels || [])], datasetLabels: chart.data.datasets.map(set => set.label) };
            this.chartRecords.set(chart, source);
        }
        chart.data.labels = source.labels.map(label => typeof label === 'string' ? this.translateText(label) : label);
        chart.data.datasets.forEach((set, index) => { if (source.datasetLabels[index]) set.label = this.translateText(source.datasetLabels[index]); });
        chart.options.locale = this.currentLanguage;
    }
    async init() {
        if (window.Chart?.register) window.Chart.register({ id: 'faminna-i18n', beforeUpdate: chart => this.localizeChart(chart) });
        if (!await this.loadLanguage(this.currentLanguage)) await this.loadLanguage('en');
    }
    subscribe(callback) { this.observers.push(callback); }
    unsubscribe(callback) { this.observers = this.observers.filter(observer => observer !== callback); }
}
const i18n = new I18n();
window.i18n = i18n;
window.i18nReady = i18n.init();
for (const method of ['alert', 'confirm']) {
    const original = window[method].bind(window);
    window[method] = message => original(i18n.translateText(message));
}
function closeLanguageMenu(restoreFocus = false) {
    const button = document.querySelector('[data-language-toggle]');
    const menu = document.getElementById('language-menu');
    if (button) button.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
    if (restoreFocus) button?.focus();
}
document.addEventListener('click', async event => {
    const toggle = event.target.closest('[data-language-toggle]');
    const choice = event.target.closest('[data-language-choice]');
    if (toggle) {
        const menu = document.getElementById('language-menu');
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        menu.hidden = !open;
        if (open) (menu.querySelector('[aria-checked="true"]') || menu.querySelector('button')).focus();
    } else if (choice) {
        if (await i18n.setLanguage(choice.dataset.languageChoice)) closeLanguageMenu(true);
    } else if (!event.target.closest('.language-picker')) closeLanguageMenu();
});
document.addEventListener('keydown', event => {
    const menu = document.getElementById('language-menu');
    if (event.key === 'Escape' && menu && !menu.hidden) { closeLanguageMenu(true); return; }
    if (!menu || menu.hidden || !menu.contains(event.target)) return;
    const buttons = [...menu.querySelectorAll('[data-language-choice]')];
    const index = buttons.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowUp') next = (index + buttons.length - 1) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next !== undefined) { event.preventDefault(); buttons[next].focus(); }
});
document.addEventListener('focusin', event => { if (!event.target.closest('.language-picker')) closeLanguageMenu(); });
document.addEventListener('change', async event => {
    if (event.target.matches('[data-language-select]') && !await i18n.setLanguage(event.target.value)) event.target.value = i18n.getCurrentLanguage();
});
document.addEventListener('componentloaded', () => i18n.updatePageTranslations());
if (typeof module !== 'undefined' && module.exports) module.exports = I18n;
