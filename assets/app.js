(function () {
  'use strict';
  var S = window.SITE, $ = function (id) { return document.getElementById(id); };
  var state = { rail: 'books', book: 'all', sel: null, cur: null, collapsed: window.innerWidth < 1100 };
  var view = null, lastR = null;
  state.order = 'topic';

  // ---------- helpers
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function codeKey(c) { if (c === 'PK') return [-1, 0, 0]; var m = /^(AA\s+)?(SL|AHL)\s+(\d+)\.(\d+)/.exec(c) || []; return [(m[1] ? 10 : 0) + (m[2] === 'AHL' ? 1 : 0), +m[3] || 0, +m[4] || 0]; }
  function codeFam(c) { return c === 'PK' ? '' : (/^AA /.test(c) ? 'Analysis and Approaches' : 'Applications and Interpretation'); }
  function codeCmp(a, b) { var x = codeKey(a), y = codeKey(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; }
  function chapterById(id) { return S.chapters.filter(function (c) { return c.id === id; })[0]; }
  function bookOf(ch) { return ch.id.split('_')[0]; }
  function books() {
    var out = [], seen = {};
    S.chapters.forEach(function (ch) {
      var k = bookOf(ch);
      if (!seen[k]) { seen[k] = { code: k, name: ch.book, short: ch.bookShort, chapters: 0, examples: 0 }; out.push(seen[k]); }
      seen[k].chapters++; seen[k].examples += ch.examples.length;
    });
    return out;
  }
  function bookInfo(code) { return books().filter(function (b) { return b.code === code; })[0]; }
  function inBook(ch) { return state.book === 'all' || bookOf(ch) === state.book; }
  function scoped() { return S.chapters.filter(inBook); }
  function bookNote() {
    var name = state.book === 'all' ? 'All books' : bookInfo(state.book).name;
    return '<p class="bookline">Book: <b>' + esc(name) + '</b> <button class="linkbtn" data-rail="books">Change</button></p>';
  }
  function bookRows() {
    var h = '', ch = 0, ex = 0;
    books().forEach(function (b) { ch += b.chapters; ex += b.examples; });
    h += '<div class="row' + (state.book === 'all' ? ' on' : '') + '" role="link" tabindex="0" data-go="#/book/all"><span class="cnt">' + ex + '</span>All books<span class="sub">' + ch + ' chapters</span></div>';
    books().forEach(function (b) {
      h += '<div class="row' + (state.book === b.code ? ' on' : '') + '" role="link" tabindex="0" data-go="#/book/' + esc(b.code) + '"><span class="cnt">' + b.examples + '</span>' + esc(b.name) + '<span class="sub">' + b.chapters + ' chapters</span></div>';
    });
    return h;
  }
  function secTitle(ch, id) { var s = ch.sections.filter(function (x) { return x.id === id; })[0]; return id + (s ? ' ' + s.title : ''); }
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    var m;
    if (h === '' || h === '/') return { kind: 'landing' };
    if (h === 'browse') return { kind: 'home' };
    if ((m = /^(map|topics)\/(MAA|MAI)\/(Haese|Pearson|Both)(?:\/(.*))?$/.exec(h))) return { kind: m[1], course: m[2], pub: m[3], codes: (m[4] || '').split(',').filter(Boolean) };
    if ((m = /^pick\/(ch|code)=(.+)$/.exec(h))) return { kind: 'pick', mode: m[1], ids: m[2].split(',').filter(Boolean) };
    if ((m = /^code\/(.+)$/.exec(h))) return { kind: 'code', code: m[1] };
    if ((m = /^book\/(.+)$/.exec(h))) return { kind: 'book', code: m[1] };
    if ((m = /^ch\/(.+)$/.exec(h)) && chapterById(m[1])) return { kind: 'ch', id: m[1] };
    return { kind: 'home' };
  }
  function lbl(ex) { return ex.label || ex.n; }
  function curLabel() { var k = state.cur.split('|'), ch = chapterById(k[0]), r = k[1]; if (ch) ch.examples.forEach(function (e) { if (String(e.n) === r) r = lbl(e); }); return r; }
  function disp(c) { return c === 'PK' ? 'Previous Knowledge - MYP' : c; }
  function topicCodes(ex) {
    var aa = view.course === 'MAA';
    var cs = ex.codes.filter(function (c) { return c === 'PK' || (aa ? /^AA /.test(c) : !/^AA /.test(c)); }).sort(codeCmp);
    return cs.map(function (c) { return c === 'PK' ? 'Previous Knowledge - MYP' : c.replace(/^AA /, '').replace('AHL', 'HL'); }).join(' · ');
  }
  function codesLine(ex) { return ex.codes.length ? ex.codes.map(disp).join(' · ') : 'No syllabus code assigned yet'; }

  // ---------- view model
  function buildView(r) {
    var items = [], v;
    if (r.kind === 'home') return { eyebrow: '', title: '', lede: '', items: [], name: 'Examples', home: true };
    if (r.kind === 'pick') {
      var names = [];
      S.chapters.forEach(function (ch) {
        var chosen = r.mode === 'ch' && r.ids.indexOf(ch.id) >= 0;
        if (chosen) names.push('Ch ' + ch.chapter + ' (' + ch.bookShort + ')');
        ch.examples.forEach(function (ex) {
          var ok = r.mode === 'ch' ? chosen : (inBook(ch) && ex.codes.some(function (c) { return r.ids.indexOf(c) >= 0; }));
          if (ok) items.push({ key: ch.id + '|' + ex.n, ch: ch, ex: ex, group: ch.bookShort + ' · Chapter ' + ch.chapter + ' · ' + secTitle(ch, ex.section) });
        });
      });
      if (r.mode === 'code') names = r.ids.slice().sort(codeCmp).map(disp);
      v = { eyebrow: r.mode === 'ch' ? 'Selected chapters' : 'Selected syllabus codes', title: names.join(', '), lede: items.length + ' worked example' + (items.length === 1 ? '' : 's') + ' from ' + r.ids.length + (r.mode === 'ch' ? ' chapter' : ' code') + (r.ids.length === 1 ? '' : 's') + '. Untick boxes or press Clear to change the selection.', items: items, name: 'Your selection' };
      return v;
    }
    if (r.kind === 'code') {
      S.chapters.forEach(function (ch) {
        ch.examples.forEach(function (ex) {
          if (inBook(ch) && ex.codes.indexOf(r.code) >= 0) items.push({ key: ch.id + '|' + ex.n, ch: ch, ex: ex, group: ch.bookShort + ' · Chapter ' + ch.chapter + ' · ' + secTitle(ch, ex.section) });
        });
      });
      var info = (S.syllabus[r.code] || {});
      v = { eyebrow: 'Syllabus code', title: disp(r.code), lede: (info.label ? info.label + '. ' : '') + items.length + ' worked example' + (items.length === 1 ? '' : 's') + (state.book === 'all' ? ' across all books.' : ' in ' + bookInfo(state.book).name + '.'), items: items, hash: '#/code/' + encodeURIComponent(r.code), name: r.code };
    } else {
      var ch = chapterById(r.id);
      ch.examples.forEach(function (ex) { items.push({ key: ch.id + '|' + ex.n, ch: ch, ex: ex, group: secTitle(ch, ex.section) }); });
      v = { eyebrow: ch.book + ' · Chapter ' + ch.chapter, title: ch.title, lede: 'Try the question first. When you are ready, open the worked solution.', items: items, ch: ch, name: 'Chapter ' + ch.chapter };
    }
    return v;
  }

  // ---------- render
  function renderRails() {
    if (view && view.topics) { $('rails').innerHTML = ''; $('rails').style.display = 'none'; return; }
    $('rails').style.display = '';
    var defs = [['books', 'Books'], ['chapters', 'Chapters'], ['examples', 'Examples'], ['syllabus', 'Syllabus']];
    $('rails').innerHTML = '<button type="button" class="homebtn" data-go="#/" aria-label="Home: choose course and topics"><span class="hi">&#8962;</span><span>Home</span></button>' + defs.map(function (d) {
      return '<button role="tab" data-rail="' + d[0] + '" aria-selected="' + (state.rail === d[0]) + '">' + d[1] + '</button>';
    }).join('');
  }
  function renderPanel() {
    if (view.topics) { $('panel').innerHTML = window.IBPicker.topicsPanel(view, state); $('expandLabel').textContent = state.cur ? 'Example ' + curLabel() : ''; return; }
    var titles = { books: ['Books', 'Pick a textbook to narrow the chapter and syllabus lists.'], chapters: ['Chapters', 'Pick a chapter, in book order. Tick boxes to combine chapters.'], examples: ['Examples', view.name + ', in book order.'], syllabus: ['Syllabus', 'Pick a code to see every example for it. Tick boxes to combine codes.'] };
    var t = titles[state.rail], h = '';
    h += '<div class="phead"><div class="eyebrow">Textbook examples</div><button class="hidebtn" id="hide">&lsaquo; Hide</button></div>';
    h += '<button type="button" class="linkbtn homelink" data-go="#/">&larr; Choose course and topics</button>';
    h += '<h2>' + esc(t[0]) + '</h2><p class="hint">' + esc(t[1]) + '</p>';
    if (state.rail === 'chapters' || state.rail === 'syllabus') h += bookNote();
    var mode = state.rail === 'chapters' ? 'ch' : 'code';
    if ((state.rail === 'chapters' || state.rail === 'syllabus') && state.sel) {
      if (state.sel.mode === mode) h += '<div class="selbar"><b>' + state.sel.ids.length + ' selected</b><button class="linkbtn" data-clear="1">Clear</button></div>';
      else h += '<div class="selbar note">A ' + (state.sel.mode === 'ch' ? 'chapter' : 'syllabus') + ' selection is active. Ticking here replaces it. <button class="linkbtn" data-clear="1">Clear</button></div>';
    }
    function picked(id) { return !!(state.sel && state.sel.mode === mode && state.sel.ids.indexOf(id) >= 0); }
    if (state.rail === 'books') {
      h += bookRows();
    } else if (state.rail === 'chapters') {
      var last = '';
      scoped().forEach(function (ch) {
        if (ch.book !== last) { h += '<div class="sec">' + esc(ch.book) + '</div>'; last = ch.book; }
        var on = picked(ch.id) || (!state.sel && view.ch && view.ch.id === ch.id);
        h += '<div class="rw"><input type="checkbox" data-pick="ch" data-id="' + esc(ch.id) + '"' + (picked(ch.id) ? ' checked' : '') + ' aria-label="Select chapter ' + ch.chapter + '"><div class="row' + (on ? ' on' : '') + '" role="link" tabindex="0" data-go="#/ch/' + esc(ch.id) + '"><span class="cnt">' + ch.examples.length + '</span>Ch ' + ch.chapter + ' ' + esc(ch.title) + '</div></div>';
      });
    } else if (state.rail === 'examples') {
      var g = '';
      view.items.forEach(function (it) {
        if (it.group !== g) { h += '<div class="sec">' + esc(it.group) + '</div>'; g = it.group; }
        h += '<div class="row' + (state.cur === it.key ? ' on' : '') + '" role="link" tabindex="0" data-key="' + esc(it.key) + '">Example ' + lbl(it.ex) + (view.ch ? '' : '<span class="sub">' + esc(it.ch.bookShort + ' Ch ' + it.ch.chapter) + '</span>') + '</div>';
      });
      if (!view.items.length) h += '<div class="empty">' + (view.home ? 'Nothing selected yet.' : 'No examples yet.') + '</div>';
    } else {
      var counts = {};
      scoped().forEach(function (ch) { ch.examples.forEach(function (ex) { ex.codes.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); }); });
      var ckeys = Object.keys(counts).sort(codeCmp), mixed = ckeys.some(function (c) { return codeFam(c) === 'Analysis and Approaches'; }) && ckeys.some(function (c) { return codeFam(c) === 'Applications and Interpretation'; }), lastFam = '';
      ckeys.forEach(function (c) {
        if (mixed && codeFam(c) && codeFam(c) !== lastFam) { h += '<div class="sec">' + codeFam(c) + '</div>'; lastFam = codeFam(c); }
        var on = picked(c) || (!state.sel && view.name === c && !view.ch);
        h += '<div class="rw"><input type="checkbox" data-pick="code" data-id="' + esc(c) + '"' + (picked(c) ? ' checked' : '') + ' aria-label="Select ' + esc(disp(c)) + '"><div class="row' + (on ? ' on' : '') + '" role="link" tabindex="0" data-go="#/code/' + encodeURIComponent(c) + '"><span class="cnt">' + counts[c] + '</span>' + esc(disp(c)) + '<span class="sub">' + esc(c === 'PK' ? '' : (S.syllabus[c] || {}).label || '') + '</span></div></div>';
      });
    }
    $('panel').innerHTML = h;
    $('expandLabel').textContent = state.cur ? 'Example ' + curLabel() : '';
  }
  function renderMain() {
    if (view.home) { $('main').innerHTML = ''; return; }
    var h = '<div class="col"><div class="eyebrow">' + esc(view.eyebrow) + '</div><h1>' + esc(view.title) + '</h1><p class="lede">' + esc(view.lede) + '</p>';
    var g = '';
    view.items.forEach(function (it) {
      if (it.group !== g) { h += '<h2 class="group">' + esc(it.group) + '</h2>'; g = it.group; }
      var base = it.ch.dir + '/', ex = it.ex;
      h += '<article id="a-' + esc(it.key) + '" data-key="' + esc(it.key) + '"><div class="ahead"><div class="t">Example ' + lbl(ex) + '</div><div class="c">' + esc(view.topics ? topicCodes(ex) : codesLine(ex)) + '</div><button class="btn" data-toggle="' + esc(it.key) + '">Show solution</button></div>' +
        '<div class="abody"><img src="' + esc(base + ex.q) + '" alt="Example ' + lbl(ex) + ' question" style="width:' + ex.qw + '%">' +
        '<div class="sol" hidden><div class="lab">Worked solution</div><img data-src="' + esc(base + ex.w) + '" alt="Example ' + lbl(ex) + ' worked solution" style="width:' + ex.ww + '%"></div></div></article>';
    });
    if (!view.items.length) h += '<div class="empty">' + esc(view.emptyMsg || 'No examples found for this code yet.') + '</div>';
    $('main').innerHTML = h + '</div>';
  }
  function renderAll() { renderRails(); renderPanel(); renderMain(); $('app').classList.toggle('collapsed', state.collapsed); }

  // ---------- smooth scroll
  function glide(key, delay) {
    setTimeout(function () {
      var el = document.getElementById('a-' + key); if (!el) return;
      var root = document.scrollingElement || document.documentElement, from = root.scrollTop;
      var to = Math.max(0, Math.round(el.getBoundingClientRect().top + from)), dist = to - from;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || Math.abs(dist) < 2) { root.scrollTop = to; return; }
      var dur = Math.min(1100, 600 + Math.abs(dist) * 0.25), t0 = performance.now();
      var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
      (function step(now) { var t = Math.min(1, (now - t0) / dur); root.scrollTop = from + dist * ease(t); if (t < 1) requestAnimationFrame(step); })(performance.now());
    }, delay || 0);
  }
  function select(key, delay) { state.cur = key; renderPanel(); glide(key, delay); }
  function toggle(key) {
    var art = document.getElementById('a-' + key), sol = art.querySelector('.sol'), btn = art.querySelector('.btn');
    var opening = sol.hidden;
    if (opening) { var im = sol.querySelector('img'); if (!im.getAttribute('src')) im.setAttribute('src', im.getAttribute('data-src')); }
    sol.hidden = !opening; btn.textContent = opening ? 'Hide solution' : 'Show solution'; btn.classList.toggle('open', opening);
    if (opening) select(key, 80); else { state.cur = key; renderPanel(); }
  }
  function step(dir) {
    var i = -1; view.items.forEach(function (it, k) { if (it.key === state.cur) i = k; });
    var ni = Math.max(0, Math.min(view.items.length - 1, (i < 0 ? 0 : i) + dir));
    if (view.items[ni]) select(view.items[ni].key);
  }

  // ---------- events
  function pickHash(mode, ids) { return '#/pick/' + mode + '=' + ids.map(encodeURIComponent).join(','); }
  function single(mode, id) { return mode === 'ch' ? '#/ch/' + encodeURIComponent(id) : '#/code/' + encodeURIComponent(id); }
  function pick(mode, id) {
    var ids = state.sel && state.sel.mode === mode ? state.sel.ids.slice() : [];
    var i = ids.indexOf(id); if (i >= 0) ids.splice(i, 1); else ids.push(id);
    if (!ids.length) { clearSel(single(mode, id)); return; }
    location.hash = pickHash(mode, ids);
  }
  function clearSel(to) {
    var s = state.sel; state.sel = null;
    location.hash = to || (s ? single(s.mode, s.ids[0]) : '#/');
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-rail],[data-key],[data-toggle],[data-pick],[data-clear],[data-go],[data-order],#hide,#expand');
    if (!t) return;
    if (t.dataset.order) { state.order = t.dataset.order; view = window.IBPicker.topicsView(lastR, state.order); state.cur = view.items.length ? view.items[0].key : null; renderAll(); window.scrollTo(0, 0); return; }
    if (t.dataset.go) { location.hash = t.dataset.go; return; }
    if (t.dataset.pick) { pick(t.dataset.pick, t.dataset.id); return; }
    if (t.dataset.clear) { clearSel(); return; }
    if (t.dataset.rail) { state.rail = t.dataset.rail; renderRails(); renderPanel(); }
    else if (t.dataset.toggle) toggle(t.dataset.toggle);
    else if (t.dataset.key) { e.preventDefault(); select(t.dataset.key); }
    else if (t.id === 'hide') { state.collapsed = true; $('app').classList.add('collapsed'); }
    else if (t.id === 'expand') { state.collapsed = false; $('app').classList.remove('collapsed'); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && (e.target.hasAttribute('data-go') || e.target.hasAttribute('data-key'))) { e.preventDefault(); e.target.click(); return; }
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  function load() {
    var r = route(); lastR = r;
    if (r.kind === 'landing' || r.kind === 'map') { window.IBPicker.show(r); return; }
    window.IBPicker.hide();
    if (r.kind === 'book') {
      var info = r.code === 'all' ? null : bookInfo(r.code);
      state.book = info ? info.code : 'all';
      state.rail = 'chapters';
      location.replace('#/browse');
      return;
    }
    state.sel = r.kind === 'pick' ? { mode: r.mode, ids: r.ids } : null;
    if (r.kind === 'ch') { var cc = chapterById(r.id); if (state.book !== 'all' && bookOf(cc) !== state.book) state.book = bookOf(cc); }
    view = r.kind === 'topics' ? window.IBPicker.topicsView(r, state.order) : buildView(r);
    state.cur = view.items.length ? view.items[0].key : null;
    if (view.ch) state.rail = state.rail === 'syllabus' ? 'syllabus' : state.rail;
    renderAll(); window.scrollTo(0, 0);
  }
  window.IBT = { esc: esc, bookOf: bookOf, codeCmp: codeCmp, secTitle: secTitle, lbl: lbl, state: state };
  window.addEventListener('hashchange', load);
  if (!S.chapters.length) { $('main').innerHTML = '<div class="col"><h1>No chapters yet</h1></div>'; return; }
  load();
})();
