'use strict';
// Only explicit, authored math delimiters are interpreted. Prose is always escaped.
function mathEscape(value) {
 return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function typeset(tex, display = false) {
 try {
  if (!window.katex) throw Error('Math renderer unavailable');
  return katex.renderToString(String(tex), {displayMode:display,throwOnError:true,trust:false,strict:'warn',output:'htmlAndMathml'});
 } catch (_) {
  return '<code class="math-fallback">' + mathEscape(tex) + '</code>';
 }
}
function mathText(value) {
 const text = String(value ?? '');
 const pattern = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
 let html = '', end = 0;
 for (const match of text.matchAll(pattern)) {
  html += mathEscape(text.slice(end, match.index));
  const display = match[2] !== undefined;
  html += '<span class="' + (display ? 'math-display' : 'math-inline') + '">' + typeset(match[display ? 2 : 1], display) + '</span>';
  end = match.index + match[0].length;
 }
 return html + mathEscape(text.slice(end));
}
function renderRule(tex) {
 return String(tex ?? '').split(/,?\\qquad\s*|,?\\quad\s*/).filter(Boolean).map(part => '<div class="formula-math">' + typeset(part, true) + '</div>').join('');
}
