function showWave(wave) {
  let waveS = '';
  for (const el of wave) {
    waveS += '(' + el + ')' + ', ';
  }
  console.log(waveS);
}

function showField(field) {
  const fieldT = (m => m[0].map((x,i) => m.map(x => x[i])))(field);
  let fieldS = '';
  for (let x = 0; x < fieldT.length; x++) {
    const col = fieldT[x];
    for (let y = 0; y < col.length; y++) {
      let el = fieldT[x][y];
      if (el === null) el = '.';
      if (el === -1) el = '█';
      fieldS += el + ' ';
    }
    fieldS += '\n';
  }
  console.log(fieldS);
}

export default {
  showWave,
  showField,
};