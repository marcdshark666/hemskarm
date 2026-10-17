// Bygger auth.json (salt + PBKDF2-hash). Kor: node tools/make-auth.js
// Standard: laser e-post/losen ur ~/.husvakten (Husvaktens) UTAN att skriva ut dem.
// Test: node tools/make-auth.js --test epost losen
var fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
var epost, losen, a = process.argv;
if (a[2] === '--test') { epost = a[3]; losen = a[4]; }
else {
  var dir = path.join(os.homedir(), '.husvakten');
  epost = fs.readFileSync(path.join(dir, 'epost.txt'), 'utf8').trim();
  losen = fs.readFileSync(path.join(dir, 'losen.txt'), 'utf8').replace(/[\r\n]+$/, '');
}
epost = String(epost).trim().toLowerCase();
var iter = 100000;
var salt = crypto.randomBytes(16);
var hash = crypto.pbkdf2Sync(epost + '\n' + losen, salt, iter, 32, 'sha256');
fs.writeFileSync(path.join(__dirname, '..', 'auth.json'), JSON.stringify({ v: 1, iter: iter, salt: salt.toString('hex'), hash: hash.toString('hex') }, null, 1) + '\n');
console.log('auth.json skriven (iter ' + iter + ')');
