const LEET = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't',
  '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '+': 't', '(': 'c',
  '|': 'i', '¡': 'i', '€': 'e', '£': 'l',
};

const BANNED = [
  'fuck', 'shit', 'bitch', 'cunt', 'twat', 'whore', 'slut', 'pussy',
  'penis', 'vagina', 'dick', 'cock', 'boob', 'tits', 'dildo', 'anal',
  'sex', 'porn', 'hentai', 'blowjob', 'handjob', 'wank', 'jizz', 'semen',
  'orgasm', 'rape', 'rapist', 'molest', 'pedo',
  'nigger', 'nigga', 'faggot', 'fag', 'kike', 'chink', 'tranny', 'retard',
  'nazi', 'hitler',
];

function normalize(name) {
  let out = '';
  for (const ch of name.toLowerCase()) {
    const c = LEET[ch] ?? ch;
    if (c >= 'a' && c <= 'z') out += c;
  }
  return out;
}

export function censorName(name) {
  const flat = normalize(name);
  const squeezed = flat.replace(/(.)\1+/g, '$1');
  for (const word of BANNED) {
    if (flat.includes(word) || squeezed.includes(word)) return null;
  }
  return name;
}

export function censorMessage(text) {
  return text.replace(/\S+/g, (word) => {
    const flat = normalize(word);
    const squeezed = flat.replace(/(.)\1+/g, '$1');
    const bad = BANNED.some((b) => flat.includes(b) || squeezed.includes(b));
    return bad ? '*'.repeat(word.length) : word;
  });
}

const NAME_BANS = [
  'dmcabot',
  'flower',
];

export function isBannedName(name) {
  const flat = normalize(name);
  return NAME_BANS.some((b) => flat.includes(b));
}
