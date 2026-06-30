const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'assets', 'processed_vocabulary.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const isHiragana = (char) => /[\u3040-\u309F]/.test(char);
// \u30FC is the prolonged sound mark (ー), which is used primarily with Katakana. 
// However, it can technically appear with Hiragana in some stylistic contexts. 
// Standard regex for Katakana often includes it.
const isKatakana = (char) => /[\u30A0-\u30FF]/.test(char);

data.forEach(item => {
  const reading = item.reading.replace(/[\s\(\)（）〜]/g, ''); // strip spaces/punctuation if any
  let hasHira = false;
  let hasKata = false;
  
  for (let char of reading) {
    if (char === 'ー') {
      hasKata = true; // usually Katakana
    } else if (isHiragana(char)) {
      hasHira = true;
    } else if (isKatakana(char)) {
      hasKata = true;
    }
  }
  
  if (hasHira && !hasKata) {
    item.system = 'hiragana';
  } else if (hasKata && !hasHira) {
    item.system = 'katakana';
  } else if (hasHira && hasKata) {
    item.system = 'mixed';
  } else {
    item.system = 'mixed'; // fallback
  }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log("Updated JSON.");
