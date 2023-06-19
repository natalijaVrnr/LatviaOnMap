var searchInput = document.querySelector('.search-components input');
var resultsDropdown = document.querySelector('.results-dropdown');

var map = null;
var lines = null;
var lastMarker = null;

(async () => {
  var csvFileData = await getCsvData('https://data.gov.lv/dati/dataset/0c5e1a3b-0097-45a9-afa9-7f7262f3f623/resource/1d3cbdf2-ee7d-4743-90c7-97d38824d0bf/download/aw_csv.zip', 'AW_VIETU_CENTROIDI.CSV');
  lines = getLinesFromCsvFile(csvFileData); //dabūjam tīrus datus, bez header rindas un tukšas pēdējās rindas

  map = createMap(56.933, 24.093); 
  addMarkersAttalinatie(); //pievieno visvairāk attālinātos punktus uz kartes

  wireUpDataToSearch(); // pievieno search baru un saista csv faila datus ar to
})();

async function getCsvData(archiveUrl, csvFileName) {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(archiveUrl);

        if (response.ok) {
          const archiveBlob = await response.blob();

          const fr = new FileReader();

          fr.onloadend = async () => { // archiveBlob datu apstrāde notiek tikai pēc lasīšanas beigām
            const zipFile = new JSZip();
            await zipFile.loadAsync(fr.result);

            const csvFile = zipFile.file(csvFileName);

            if (csvFile) {
              const csvData = await csvFile.async('text');
              const lines = csvData.split('\r\n');

              const data = [];

              lines.forEach(line => { // pārtaisām no teksta faila 2d masīvā ērtākai apstrādei
                const rowData = line.split(';');
                data.push(rowData);
              });

              resolve(data);
            } 
            
            else {
              reject(new Error('CSV file not found in the ZIP archive'));
            }
          };

          fr.readAsArrayBuffer(archiveBlob);
        } 
        
        else {
          reject(new Error('An unexpected error occurred when fetching the response from the server. Please try again'));
        }
      } 
      
      catch (error) {
        reject(error);
      }
    });
}

function getLinesFromCsvFile(csvFileData) { 
  var lines = csvFileData;

  const lastLine = lines.pop(); //pēdējā rinda bija tukša
  const headerLine = lines.shift(); // noņemam header rindu

  return lines;
}


function createMap(lat, long) { // sākotnējais kartes izskats
  var map = L.map('map').setView([lat, long], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a> contributors',
  }).addTo(map);

  return map;
}

function addMarkersAttalinatie() {

  var attalinatie = findAttalinatie(); // masīvs [Z, D, A, R]

  attalinatie.forEach(el => {
    createMarker(el);
  });
}


function findAttalinatie() { // atrod visvairāk attālinātās dzīvesvietas

  var attalinatie = [];

  for (let i = 8; i < 10; i++){ // 8 ir North, 9 ir East vērtība rindā
    const sorted = lines.slice().sort((a, b) => { // kārtošana, lai vieglāk piekļūtu min un max vērtībām
      return parseFloat(a[i].replaceAll("#", "")) - parseFloat(b[i].replaceAll("#", ""));
    });
  
    const least = sorted[0]; // visvairāk uz Z, A
    const greatest = sorted[sorted.length - 1]; // visvairāk uz D, R

    attalinatie.push(greatest, least);
  }

  return attalinatie; 
}

function createPopup(element) { // izveido popup priekš markera ar nosaukumu un koordinātām
  var popup = L.popup({
    maxWidth: 400
  })
  .setContent(
    `<span class="popup" style="font-size: 1.1rem;">
    <b>${element[5].replaceAll("#", "")}</b><br>
    ${parseFloat(element[8].replaceAll("#", ""))}°N ${parseFloat(element[9].replaceAll("#", ""))}°E <br>
    </span>`
  );

  return popup;
}

function createMarker(element) { // izveido markeru ar popupu
  var popup = createPopup(element);

  var marker = L.marker([parseFloat(element[8].replaceAll("#", "")), parseFloat(element[9].replaceAll("#", ""))], {
    title: element[5].replaceAll("#", "")
  })
  .bindPopup(popup)
  .addTo(map);

  marker.on('click', () => { // kad uzklikšķina, piezoomo pie attiecīgās dzīvesvietas un parāda popupu
    setViewByLatLong(element, 11);
  });

  return marker;
}

function wireUpDataToSearch() { // sasaista search baru un datus no csv faila
  
  searchInput.addEventListener('input', () => { // katru reizi, kad lietotājs ievada kko search barā, parādās dropdowns ar attiecīgiem variantiem
    removeDropdown(); // izdzēš iepriekšējo dropdownu no iepriekšējās meklēšanas

    const value = searchInput.value;

    if (value != '') { // ja ievade ir tukša, dropdowns nerādīsies

      var filtered = [];

      lines.forEach(line => {

        if (line[5].replaceAll('#', '').substr(0, value.length).toLowerCase() === value.toLowerCase()) {
          filtered.push(line);
        }
      });

      filtered.sort((a, b) => a[5].replaceAll('#', '').localeCompare(b[5].replaceAll('#', ''))); // lai rezultāti parādās alfabētiskā secībā

      createDropdown(filtered);
  }

  });

}

function createDropdown(filtered) { // izveido dropdownu ar rezultātiem no meklēšanas

  var resultsList = document.createElement('ul');
  resultsList.className = 'results-list';

  filtered.forEach(el => {
    var listItem = document.createElement('li');

    var button = document.createElement('button');
    button.innerHTML = el[5].replaceAll('#', '');

    button.addEventListener('click', () => { 
      searchInput.value = (el[5].indexOf(',') == -1) ? el[5].replaceAll('#', '') : el[5].replaceAll('#', '').substr(0, el[5].indexOf(',')-1); // ja uzklikšīna uz attiecīgā elementa, search barā rādīsies īsāks apdzīvotās vietas nosaukums
      zoomIn(el, map); // piezoomo klāt vietai
    });

    listItem.appendChild(button);

    resultsList.appendChild(listItem); 
  });

  resultsDropdown.appendChild(resultsList); // pievieno jaunu html elementu ar dropdownu
}

function removeDropdown() { // izdzēš dropdownu kā veselu html elementu
  var resultsList = document.querySelector('.results-list');

  if (resultsList) {
    resultsList.remove();
  }
}

function setViewByLatLong(element, zoomLevel) { // uzstāda vēlamo kartes izskatu, atsevišķa funkcija šim priekš lines masīva elementiem (rindām) - lai nav jāčakarējās ar garajiem pārveidojumiem iekavās
  const lat = parseFloat(element[8].replaceAll("#", ""));
  const lng = parseFloat(element[9].replaceAll("#", ""));

  map.setView([lat, lng], zoomLevel);
}

function zoomIn(listElement) { // sakonfigurē kopējo izskatu, kad ir izvēlēta konkrēta dzīvesvieta no dropdowna
  removeDropdown();

  if (lastMarker != null) { // izdzēš ar iepriekšējo meklēšanu saistītos markerus
    map.removeLayer(lastMarker);
  }

  setViewByLatLong(listElement, 11);

  lastMarker = createMarker(listElement); // uztaisa jaunu markeru priekš konkrētās dzīvesvietas un atzīmē to kā pēdējo, lai nākamajā meklēšanā zinātu, kuru dzēst
  lastMarker.openPopup(); // atver popupu ar datiem par vietu

  return lastMarker;
}