# Vallbruna website

Marketing site for Vallbruna SE, in English, German and Czech.

- `index.html` is the whole page (styles and script inline). English text lives in the markup.
- `i18n.js` holds the German (`de`) and Czech (`cs`) translations, keyed by each element's `data-i18n` attribute, plus the translated report examples.
- `img/` holds the photography.

Open a language directly with `#en`, `#de` or `#cs` at the end of the URL. Otherwise the page uses the visitor's last choice, then their browser language.
