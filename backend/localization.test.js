const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const catalogs = Object.fromEntries(['en','fr-TD','ar-TD'].map(locale => [locale,
    JSON.parse(fs.readFileSync(path.join(root, 'assets/locales', locale + '.json'), 'utf8'))]));

function createI18n(locale) {
    const sandbox = {
        window: { FAMINA_TRANSLATIONS: catalogs },
        localStorage: { getItem: () => locale, setItem() {} },
        MutationObserver: class { disconnect() {} observe() {} },
        document: { documentElement: {}, body: { dataset: {} }, querySelectorAll: () => [],
            createTreeWalker: () => ({ nextNode: () => false }), dispatchEvent() {} },
        NodeFilter: { SHOW_TEXT: 4 }, CustomEvent: class {}, console
    };
    const source = fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8').split('const i18n = new I18n();')[0];
    vm.runInNewContext(source + ';globalThis.instance = new I18n();', sandbox);
    const instance = sandbox.instance;
    instance.translations = catalogs[locale];
    instance.buildTextCatalog();
    return instance;
}

test('French and Arabic include every built-in message and template', () => {
    function keys(object, prefix = '') {
        return Object.entries(object).flatMap(([key, value]) =>
            typeof value === 'object' && !Array.isArray(value) ? keys(value, prefix + key + '.') : [prefix + key]);
    }
    const expected = keys(catalogs.en).sort();
    assert.deepEqual(keys(catalogs['fr-TD']).sort(), expected);
    assert.deepEqual(keys(catalogs['ar-TD']).sort(), expected);
    for (const data of Object.values(catalogs)) {
        for (const message of Object.values(data.text)) assert.equal(typeof message, 'string');
    }
});

test('dynamic phrases translate nested item names and statuses while preserving IDs', () => {
    const fr = createI18n('fr-TD');
    assert.equal(fr.translateText('Order #901'), 'Commande n° 901');
    assert.equal(fr.translateText('Margherita Pizza x2'), 'Pizza margherita ×2');
    assert.equal(fr.translateText('2 items found'), '2 plats trouvés');
    assert.equal(fr.translateText('Please fill in all required fields: name, email'), 'Veuillez remplir tous les champs obligatoires : Nom complet, E-mail');
    const ar = createI18n('ar-TD');
    assert.equal(ar.translateText('Order Status: CONFIRMED'), 'حالة الطلب: مؤكد');
    assert.equal(ar.translateText('Estimated delivery: 12 minutes'), 'وقت التوصيل المتوقع: 12 دقيقة');
    assert.equal(ar.translateText('Italian Delight'), 'Italian Delight');
});

test('switching languages repeatedly restores the original source without losing node identity', () => {
    const instance = createI18n('fr-TD');
    const node = {};
    let current = 'Your Profile';
    const translate = () => instance.localizeValue(node, 'text', current, value => current = value);
    translate(); assert.equal(current, 'Votre profil');
    instance.currentLanguage = 'ar-TD'; instance.translations = catalogs['ar-TD']; instance.buildTextCatalog();
    translate(); assert.equal(current, 'ملفك الشخصي');
    instance.currentLanguage = 'en'; instance.translations = catalogs.en; instance.buildTextCatalog();
    translate(); assert.equal(current, 'Your Profile');
    current = 'Your Cart'; translate(); assert.equal(current, 'Your Cart');
    instance.currentLanguage = 'fr-TD'; instance.translations = catalogs['fr-TD']; instance.buildTextCatalog();
    translate(); assert.equal(current, 'Votre panier');
});

test('embedded catalog exactly matches the JSON source of truth', () => {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/locales/catalog.js'), 'utf8'), sandbox);
    assert.equal(JSON.stringify(sandbox.window.FAMINA_TRANSLATIONS), JSON.stringify(catalogs));
});
