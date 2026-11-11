(function () {
  'use strict';
  // Landing (course + publisher), topic map, and the topics reader view.
  // Loaded before app.js; reads window.IBT (set by app.js) only when called.
  function T() { return window.IBT; }
  function S() { return window.SITE; }
  function esc(s) { return T().esc(s); }

  var STRANDS = ['Number and Algebra', 'Functions', 'Geometry and Trigonometry', 'Statistics and Probability', 'Calculus'];
  var COURSES = {
    MAI: { name: 'Applications and Interpretation', blurb: 'Modelling, statistics and technology, with graph theory, matrices and differential equations at HL.', books: 'Haese Core Topics, Haese AI, Pearson AI SL, Pearson AI HL' },
    MAA: { name: 'Analysis and Approaches', blurb: 'Algebra, proof and calculus, with complex numbers, vectors and series at HL.', books: 'Haese Core Topics, Haese AA, Pearson AA SL, Pearson AA HL' }
  };
  var PUBS = ['Haese', 'Pearson', 'Both'];
  var KEY = 'ibt-picker-v1';
  var P = { course: 'MAA', pub: 'Both', sel: { MAA: {}, MAI: {} } };
  var cur = 'landing', loaded = false, pageEl = null;

  // ---------- persistence
  function loadStore() {
    if (loaded) return; loaded = true;
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o) {
        if (COURSES[o.course]) P.course = o.course;
        if (PUBS.indexOf(o.pub) >= 0) P.pub = o.pub;
        ['MAA', 'MAI'].forEach(function (c) { P.sel[c] = {}; ((o.sel && o.sel[c]) || []).forEach(function (x) { P.sel[c][x] = true; }); });
      }
    } catch (e) { /* storage may be unavailable */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ course: P.course, pub: P.pub, sel: { MAA: Object.keys(P.sel.MAA), MAI: Object.keys(P.sel.MAI) } })); } catch (e) { /* ignore */ }
  }

  // ---------- code helpers
  function isAA(c) { return c.indexOf('AA ') === 0; }
  function inCourse(c, course) { return c === 'PK' || (course === 'MAA' ? isAA(c) : !isAA(c)); }
  function shortCode(c) { return c.replace(/^AA /, ''); }
  function fullCode(c, course) { return c === 'PK' ? c : (course === 'MAA' ? 'AA ' + c : c); }
  function dc(c) { return c === 'PK' ? 'MYP' : shortCode(c).replace('AHL', 'HL'); }
  function dcLong(c) { return c === 'PK' ? 'Previous Knowledge - MYP' : dc(c); }
  function levelOf(c) { return /AHL/.test(c) ? 'HL' : 'SL'; }
  function strandOf(c) { var m = /(\d+)\.\d+/.exec(c); return m ? +m[1] : 0; }
  function pubOf(ch) { return T().bookOf(ch).indexOf('PE') === 0 ? 'Pearson' : 'Haese'; }
  function pubOk(ch, pub) { return pub === 'Both' || pubOf(ch) === pub; }
  function pubName(pub) { return pub === 'Both' ? 'Haese and Pearson' : pub; }
  function label(c) { return c === 'PK' ? 'Previous Knowledge - MYP' : ((S().syllabus[c] || {}).label || ''); }
  function validCode(c) { return c === 'PK' || !!S().syllabus[c]; }
  function courseCodes(course) {
    return Object.keys(S().syllabus).filter(function (c) { return c !== 'PK' && inCourse(c, course); }).sort(T().codeCmp);
  }
  function counts(course, pub) {
    var m = {};
    S().chapters.forEach(function (ch) {
      if (!pubOk(ch, pub)) return;
      ch.examples.forEach(function (ex) { ex.codes.forEach(function (c) { if (inCourse(c, course)) m[c] = (m[c] || 0) + 1; }); });
    });
    return m;
  }
  function matches(course, pub, sel) {
    var out = [];
    S().chapters.forEach(function (ch) {
      if (!pubOk(ch, pub)) return;
      ch.examples.forEach(function (ex) {
        var cs = ex.codes.filter(function (c) { return inCourse(c, course) && sel[c]; });
        if (cs.length) { cs.sort(T().codeCmp); out.push({ ch: ch, ex: ex, codes: cs }); }
      });
    });
    return out;
  }
  function codesHash(course, sel) {
    var ks = Object.keys(sel).filter(function (c) { return sel[c] && inCourse(c, course); }).sort(T().codeCmp);
    return ks.map(function (c) { return encodeURIComponent(shortCode(c)); }).join(',');
  }
  function mapHash() { var c = codesHash(P.course, P.sel[P.course]); return '#/map/' + P.course + '/' + P.pub + (c ? '/' + c : ''); }
  function topicsHash(course, pub, sel) { var c = codesHash(course, sel); return '#/topics/' + course + '/' + pub + (c ? '/' + c : ''); }

  // ---------- model for the map
  function model() {
    var course = P.course, pub = P.pub, sel = P.sel[course], cn = counts(course, pub);
    var rows = courseCodes(course).map(function (c) {
      return { code: c, label: label(c), n: cn[c] || 0, level: levelOf(c), strand: strandOf(c), on: (cn[c] || 0) > 0 };
    });
    var pk = { code: 'PK', label: label('PK'), n: cn.PK || 0, level: 'PK', strand: 0, on: (cn.PK || 0) > 0 };
    var all = rows.concat([pk]);
    var picked = all.filter(function (d) { return sel[d.code] && d.on; });
    return { course: course, pub: pub, sel: sel, rows: rows, pk: pk, all: all, picked: picked };
  }
  function toggleList(list) {
    var sel = P.sel[P.course], en = list.filter(function (d) { return d.on; });
    var allOn = en.length > 0 && en.every(function (d) { return sel[d.code]; });
    en.forEach(function (d) { if (allOn) delete sel[d.code]; else sel[d.code] = true; });
  }
  function levelSets(M) {
    return [
      { id: 'SL', name: 'SL', set: M.rows.filter(function (d) { return d.on && d.level === 'SL'; }) },
      { id: 'SLHL', name: 'SL + HL', set: M.all.filter(function (d) { return d.on; }) },
      { id: 'HL', name: 'HL Only', set: M.rows.filter(function (d) { return d.on && d.level === 'HL'; }) }
    ];
  }

  // ---------- html: shared bits
  function seg(items, act, cls) {
    return '<div class="pg-seg ' + (cls || '') + '" role="group">' + items.map(function (it) {
      return '<button type="button" class="' + (it.on ? 'on' : '') + '" aria-pressed="' + it.on + '" data-act="' + act + '" data-v="' + esc(it.v) + '" data-fk="' + act + ':' + esc(it.v) + '">' + esc(it.name) + '</button>';
    }).join('') + '</div>';
  }
  function courseSeg() { return seg(['MAA', 'MAI'].map(function (c) { return { v: c, name: c, on: P.course === c }; }), 'course'); }
  function pubSeg() { return seg(PUBS.map(function (p) { return { v: p, name: p, on: P.pub === p }; }), 'pub'); }

  // ---------- html: landing
  function landingHtml() {
    var chapters = S().chapters.length, ex = 0, bk = {};
    S().chapters.forEach(function (ch) { ex += ch.examples.length; bk[T().bookOf(ch)] = 1; });
    var cards = ['MAI', 'MAA'].map(function (id) {
      var c = COURSES[id], on = P.course === id;
      return '<button type="button" class="pg-card' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-act="course" data-v="' + id + '" data-fk="card:' + id + '"><span class="pg-cid">' + id + '</span><span class="pg-cname">' + esc(c.name) + '</span><span class="pg-cblurb">' + esc(c.blurb) + '</span><span class="pg-cbooks">' + esc(c.books) + '</span></button>';
    }).join('');
    return '<div class="pg pg-land">' +
      '<header><div class="pg-kicker">Worked examples by syllabus topic</div><h1>IB Textbooks</h1><p class="pg-sub">Every worked example from the Haese and Pearson books, found by the IB syllabus topic it teaches.</p></header>' +
      '<section aria-labelledby="pg-s1"><h2 id="pg-s1">1. Choose your course</h2><div class="pg-cards">' + cards + '</div></section>' +
      '<section aria-labelledby="pg-s2"><h2 id="pg-s2">2. Choose your publisher</h2>' + pubSeg() + '</section>' +
      '<section class="pg-actions"><a class="pg-cta" href="' + esc(mapHash()) + '">Choose topics &rarr;</a><a href="#/browse">Or browse by book and chapter</a></section>' +
      '<footer>' + Object.keys(bk).length + ' books, ' + chapters + ' chapters, ' + ex.toLocaleString('en-US') + ' worked examples. MAI and MAA syllabus codes attached to every example.</footer></div>';
  }

  // ---------- html: map
  function tileHtml(d, sel) {
    var on = !!sel[d.code] && d.on;
    return '<button type="button" class="pg-tile lv-' + d.level + (on ? ' on' : '') + '" data-act="tile" data-code="' + esc(d.code) + '" data-fk="t:' + esc(d.code) + '" aria-pressed="' + on + '"' + (d.on ? '' : ' disabled') + '>' +
      '<span class="tl"><span>' + esc(d.code === 'PK' ? 'MYP' : dc(d.code)) + '</span><span>' + d.n + '</span></span><span>' + esc(d.label) + '</span></button>';
  }
  function headHtml(cls, act, attrs, fk, list, sel, whole, name) {
    var en = list.filter(function (d) { return d.on; }), k = en.filter(function (d) { return sel[d.code]; }).length;
    var all = en.length > 0 && k === en.length;
    var note = !en.length ? 'No examples' : (all ? (whole ? 'Whole strand ticked' : 'All ticked (' + en.length + ')') : k + ' of ' + en.length + ' ticked. Click to tick ' + (whole ? 'the whole strand' : 'all ' + name));
    return '<button type="button" class="' + cls + (all ? ' on' : '') + '" data-act="' + act + '" ' + attrs + ' data-fk="' + fk + '" aria-pressed="' + all + '"' + (en.length ? '' : ' disabled') + '>' + (whole ? '<span class="pg-sname">' + esc(name) + '</span>' : '<span class="pg-cl">' + name + '</span>') + '<span>' + note + '</span></button>';
  }
  function mapHtml() {
    var M = model(), sel = M.sel, ms = matches(M.course, M.pub, sel);
    var lv = levelSets(M).map(function (l) {
      var on = M.picked.length === l.set.length && l.set.length > 0 && l.set.every(function (d) { return sel[d.code]; });
      return { v: l.id, name: l.name, on: on };
    });
    var h = '<div class="pg pg-map"><header class="pg-mhead"><div><a href="#/">&larr; Course and publisher</a><h1>Choose your topics</h1></div><div class="pg-ctl">' + courseSeg() + pubSeg() + '</div></header>';
    h += '<section class="pg-tools" aria-label="Selection tools"><div class="pg-whole"><span>Whole course</span>' + seg(lv, 'level') + '</div><div class="pg-sum"><div><b>' + M.picked.length + '</b> topic' + (M.picked.length === 1 ? '' : 's') + ' ticked, <b>' + ms.length + '</b> example' + (ms.length === 1 ? '' : 's') + '</div>' +
      (ms.length ? '<a class="pg-go" href="' + esc(topicsHash(M.course, M.pub, sel)) + '">Show examples &rarr;</a>' : '<span class="pg-go off" aria-disabled="true">Show examples &rarr;</span>') + '</div></section>';
    h += '<section class="pg-pk" aria-label="Previous knowledge"><div class="pg-pkt">Previous knowledge</div><div class="pg-pktile">' + tileHtml(M.pk, sel) + '</div><div class="pg-pkn">Skills from before the IB syllabus that the books revisit. Included when you choose SL + HL.</div></section>';
    STRANDS.forEach(function (title, i) {
      var all = M.rows.filter(function (d) { return d.strand === i + 1; });
      var sl = all.filter(function (d) { return d.level === 'SL'; }), hl = all.filter(function (d) { return d.level === 'HL'; });
      h += '<section class="pg-strand">' + headHtml('pg-bar', 'strand', 'data-n="' + (i + 1) + '"', 'strand:' + (i + 1), all, sel, true, title) + '<div class="pg-cols">' +
        '<div class="pg-col">' + headHtml('pg-chead lv-SL', 'col', 'data-n="' + (i + 1) + '" data-lv="SL"', 'col:' + (i + 1) + ':SL', sl, sel, false, 'SL') + '<div class="pg-tiles">' + sl.map(function (d) { return tileHtml(d, sel); }).join('') + '</div></div>' +
        '<div class="pg-col">' + headHtml('pg-chead lv-HL', 'col', 'data-n="' + (i + 1) + '" data-lv="HL"', 'col:' + (i + 1) + ':HL', hl, sel, false, 'HL') + '<div class="pg-tiles">' + hl.map(function (d) { return tileHtml(d, sel); }).join('') + '</div></div></div></section>';
    });
    return h + '</div>';
  }

  // ---------- render + events
  function render() {
    if (!pageEl) pageEl = document.getElementById('page');
    var fk = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-fk');
    var y = window.pageYOffset || 0;
    pageEl.innerHTML = cur === 'landing' ? landingHtml() : mapHtml();
    if (fk) { var els = pageEl.querySelectorAll('[data-fk]'); for (var i = 0; i < els.length; i++) if (els[i].getAttribute('data-fk') === fk) { els[i].focus({ preventScroll: true }); break; } }
    window.scrollTo(0, y);
  }
  function syncUrl() { try { history.replaceState(null, '', mapHash()); } catch (e) { /* ignore */ } }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('#page [data-act]') : null;
    if (!t || t.disabled) return;
    var a = t.getAttribute('data-act'), v = t.getAttribute('data-v'), M, n;
    if (a === 'course') { P.course = v; }
    else if (a === 'pub') { P.pub = v; }
    else if (a === 'level') {
      M = model();
      var ls = levelSets(M).filter(function (l) { return l.id === v; })[0];
      var on = M.picked.length === ls.set.length && ls.set.length > 0 && ls.set.every(function (d) { return M.sel[d.code]; });
      P.sel[P.course] = {};
      if (!on) ls.set.forEach(function (d) { P.sel[P.course][d.code] = true; });
    }
    else if (a === 'strand') { n = +t.getAttribute('data-n'); M = model(); toggleList(M.rows.filter(function (d) { return d.strand === n; })); }
    else if (a === 'col') { n = +t.getAttribute('data-n'); var lvl = t.getAttribute('data-lv'); M = model(); toggleList(M.rows.filter(function (d) { return d.strand === n && d.level === lvl; })); }
    else if (a === 'tile') { M = model(); var code = t.getAttribute('data-code'); toggleList(M.all.filter(function (d) { return d.code === code; })); }
    else return;
    save();
    if (cur === 'map') syncUrl();
    render();
  });

  // ---------- public: show / hide pages
  function show(r) {
    loadStore();
    if (r.kind === 'map') {
      cur = 'map'; P.course = r.course; P.pub = r.pub;
      if (r.codes.length) {
        P.sel[r.course] = {};
        r.codes.forEach(function (s) { var c = fullCode(s, r.course); if (validCode(c)) P.sel[r.course][c] = true; });
      }
      save();
    } else { cur = 'landing'; }
    document.body.className = 'pg-mode';
    pageEl = document.getElementById('page'); pageEl.hidden = false;
    render(); window.scrollTo(0, 0);
  }
  function hide() {
    var el = document.getElementById('page'); if (el) el.hidden = true;
    document.body.className = '';
  }

  // ---------- public: topics reader view
  function topicsView(r, order) {
    var sel = {};
    r.codes.forEach(function (s) { var c = fullCode(s, r.course); if (validCode(c)) sel[c] = true; });
    var keys = Object.keys(sel).sort(T().codeCmp), ms = matches(r.course, r.pub, sel), items = [];
    if (order === 'book') {
      ms.forEach(function (m) {
        items.push({ key: m.ch.id + '|' + m.ex.n, ch: m.ch, ex: m.ex, codes: m.codes, group: m.ch.bookShort + ' · Chapter ' + m.ch.chapter + ' · ' + T().secTitle(m.ch, m.ex.section) });
      });
    } else {
      keys.forEach(function (k) {
        ms.forEach(function (m) {
          if (m.codes[0] !== k) return;
          items.push({ key: m.ch.id + '|' + m.ex.n, ch: m.ch, ex: m.ex, codes: m.codes, group: dcLong(k) + (k === 'PK' ? '' : ' · ' + label(k)) });
        });
      });
    }
    var title = keys.length <= 3 ? keys.map(function (k) { return dcLong(k) + (k === 'PK' ? '' : ' ' + label(k)); }).join(', ') : keys.length + ' topics';
    return {
      topics: true, course: r.course, pub: r.pub, order: order, items: items, sel: keys, name: 'Your topics',
      eyebrow: r.course + ' · ' + pubName(r.pub), title: title || 'No topics chosen',
      lede: items.length + ' worked example' + (items.length === 1 ? '' : 's') + ' from ' + keys.length + ' topic' + (keys.length === 1 ? '' : 's') + '. Try the question first, then open the worked solution. Left and right arrow keys step through the examples.',
      hash: '#/map/' + r.course + '/' + r.pub + (codesHash(r.course, sel) ? '/' + codesHash(r.course, sel) : ''),
      emptyMsg: 'No examples match these topics for this publisher. Change topics to try another choice.'
    };
  }
  function itemCodes(it) {
    return it.ch.bookShort + ' · Chapter ' + it.ch.chapter + ' · ' + it.ex.codes.filter(function (c) { return inCourse(c, T().state.courseView); }).map(dcLong).join(' · ');
  }
  function topicsPanel(view, state) {
    var h = '<div class="phead"><div class="eyebrow">Textbook examples</div><button class="hidebtn" id="hide">&lsaquo; Hide</button></div>';
    h += '<h2>Your topics</h2><p class="hint">' + view.items.length + ' example' + (view.items.length === 1 ? '' : 's') + ' from ' + view.sel.length + ' topic' + (view.sel.length === 1 ? '' : 's') + '. ' + esc(view.course) + ' · ' + esc(pubName(view.pub)) + '.</p>';
    h += '<div class="selbar"><button class="linkbtn" style="margin-left:0" data-go="' + esc(view.hash) + '">&larr; Change topics</button><button class="linkbtn" data-go="#/browse">Browse by book</button></div>';
    h += '<div class="pg-seg side" role="group" aria-label="Order of examples">' + [['topic', 'By topic'], ['book', 'Book order']].map(function (o) {
      var on = view.order === o[0];
      return '<button type="button" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" data-order="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
    var sizes = {}; view.items.forEach(function (it) { sizes[it.group] = (sizes[it.group] || 0) + 1; });
    var g = '';
    view.items.forEach(function (it) {
      if (it.group !== g) { h += '<div class="sec">' + esc(it.group) + ' <span class="gcnt">' + sizes[it.group] + '</span></div>'; g = it.group; }
      var extra = view.order === 'topic' ? (it.codes.length > 1 ? ' · also ' + it.codes.slice(1).map(dc).join(', ') : '') : ' · ' + it.codes.map(dc).join(', ');
      h += '<div class="row' + (state.cur === it.key ? ' on' : '') + '" role="link" tabindex="0" data-key="' + esc(it.key) + '">Example ' + esc(T().lbl(it.ex)) + '<span class="sub">' + esc(it.ch.bookShort + ' · Ch ' + it.ch.chapter + ' · ' + it.ex.section + extra) + '</span></div>';
    });
    if (!view.items.length) h += '<div class="empty">Nothing matches.</div>';
    return h;
  }

  window.IBPicker = { show: show, hide: hide, topicsView: topicsView, topicsPanel: topicsPanel, itemCodes: itemCodes };
})();
