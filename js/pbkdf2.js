/* PBKDF2-HMAC-SHA256 i ren ES5 (gamla Safari saknar WebCrypto). Kor i bitar via setTimeout. */
(function (w) {
  var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var IV = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var W = new Array(64);

  function compress(st, b, out) {
    var i, a = st[0], bb = st[1], c = st[2], d = st[3], e = st[4], f = st[5], g = st[6], h = st[7], t1, t2, x, y;
    for (i = 0; i < 16; i++) { W[i] = b[i] | 0; }
    for (i = 16; i < 64; i++) {
      x = W[i - 15]; y = W[i - 2];
      W[i] = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) + W[i - 7] +
             (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + W[i - 16] | 0;
    }
    for (i = 0; i < 64; i++) {
      t1 = h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + W[i] | 0;
      t2 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & bb) ^ (a & c) ^ (bb & c)) | 0;
      h = g; g = f; f = e; e = d + t1 | 0; d = c; c = bb; bb = a; a = t1 + t2 | 0;
    }
    out[0] = st[0] + a | 0; out[1] = st[1] + bb | 0; out[2] = st[2] + c | 0; out[3] = st[3] + d | 0;
    out[4] = st[4] + e | 0; out[5] = st[5] + f | 0; out[6] = st[6] + g | 0; out[7] = st[7] + h | 0;
  }

  function utf8(s) {
    var out = [], i, c, d;
    s = String(s);
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
        d = s.charCodeAt(i + 1);
        if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      }
      if (c < 0x80) { out.push(c); }
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c < 0x10000) { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
      else { out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return out;
  }

  function hexBytes(h) {
    var o = [], i;
    for (i = 0; i + 1 < h.length; i += 2) { o.push(parseInt(h.substr(i, 2), 16)); }
    return o;
  }

  function words(bytes, len) {
    var o = [], i;
    for (i = 0; i < len; i++) { o.push(0); }
    for (i = 0; i < bytes.length; i++) { o[i >> 2] |= bytes[i] << (24 - 8 * (i & 3)); }
    return o;
  }

  function sha256Bytes(bytes) {
    var st = IV.slice(0), n = bytes.length, total = ((n + 9 + 63) >> 6) << 6, buf = [], i, j, blk, nx = [], bits = n * 8, out = [];
    for (i = 0; i < total; i++) { buf.push(0); }
    for (i = 0; i < n; i++) { buf[i] = bytes[i]; }
    buf[n] = 0x80;
    buf[total - 4] = (bits >>> 24) & 255; buf[total - 3] = (bits >>> 16) & 255; buf[total - 2] = (bits >>> 8) & 255; buf[total - 1] = bits & 255;
    for (i = 0; i < total; i += 64) {
      blk = [];
      for (j = 0; j < 16; j++) { blk.push((buf[i + 4 * j] << 24) | (buf[i + 4 * j + 1] << 16) | (buf[i + 4 * j + 2] << 8) | buf[i + 4 * j + 3]); }
      compress(st, blk, nx);
      st = nx.slice(0);
    }
    for (i = 0; i < 8; i++) { out.push((st[i] >>> 24) & 255, (st[i] >>> 16) & 255, (st[i] >>> 8) & 255, st[i] & 255); }
    return out;
  }

  function toHex(wd) {
    var s = '', i, h;
    for (i = 0; i < wd.length; i++) { h = (wd[i] >>> 0).toString(16); s += ('00000000' + h).slice(-8); }
    return s;
  }

  // pbkdf2Sha256(passString, saltHex, iter, progress(frac), done(hex)); dkLen 32
  w.pbkdf2Sha256 = function (pass, saltHex, iter, progress, done) {
    var key = utf8(pass), i, kb, ik = [], ok = [], tmp = [];
    if (key.length > 64) { key = sha256Bytes(key); }
    for (i = 0; i < 64; i++) { kb = i < key.length ? key[i] : 0; ik.push(kb ^ 0x36); ok.push(kb ^ 0x5c); }
    var istate, ostate;
    compress(IV, words(ik, 16), tmp); istate = tmp.slice(0);
    compress(IV, words(ok, 16), tmp); ostate = tmp.slice(0);
    var msg = hexBytes(saltHex).concat([0, 0, 0, 1]);
    var inner = sha256Bytes(ik.concat(msg));
    var outer = sha256Bytes(ok.concat(inner));
    var u = words(outer, 8), t = u.slice(0), n = 1;
    var blk = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], r1 = [0,0,0,0,0,0,0,0], r2 = [0,0,0,0,0,0,0,0], j;
    function step() {
      var lim = Math.min(iter, n + 1500);
      while (n < lim) {
        for (j = 0; j < 8; j++) { blk[j] = u[j]; }
        blk[8] = 0x80000000 | 0;
        for (j = 9; j < 15; j++) { blk[j] = 0; }
        blk[15] = 768;
        compress(istate, blk, r1);
        for (j = 0; j < 8; j++) { blk[j] = r1[j]; }
        compress(ostate, blk, r2);
        for (j = 0; j < 8; j++) { u[j] = r2[j]; t[j] ^= r2[j]; }
        n++;
      }
      if (progress) { progress(n / iter); }
      if (n < iter) { setTimeout(step, 0); } else { done(toHex(t)); }
    }
    step();
  };
})(window);
