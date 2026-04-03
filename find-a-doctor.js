const doctors = [
  {name:'Dr. Sana Khelifi',spec:'General Practitioner',gender:'female',rating:5,reviews:42,dist:0.8,avail:true,home:true,tele:true,insur:true,ini:'SK',av:'av-r',
   desc:'Experienced general practitioner with over 12 years in primary care. Specialises in preventive medicine and chronic disease management.'},
  {name:'Dr. Amine Ben Slama',spec:'Cardiologist',gender:'male',rating:4,reviews:87,dist:1.4,avail:true,home:false,tele:true,insur:true,ini:'AB',av:'av-b',
   desc:'Board-certified cardiologist with expertise in interventional procedures, heart failure management, and cardiac imaging.'},
  {name:'Dr. Leila Mhiri',spec:'Neurologist',gender:'female',rating:5,reviews:61,dist:2.1,avail:false,home:false,tele:false,insur:true,ini:'LM',av:'av-r',
   desc:'Neurologist specialising in headache disorders, epilepsy, and neurodegenerative conditions. Fluent in Arabic, French, and English.'},
  {name:'Dr. Karim Trabelsi',spec:'Pulmonologist',gender:'male',rating:4,reviews:33,dist:2.6,avail:true,home:false,tele:true,insur:false,ini:'KT',av:'av-b',
   desc:'Pulmonologist with a focus on asthma, COPD, and sleep disorders. Offers spirometry and bronchoscopy on site.'},
  {name:'Dr. Rima Abidi',spec:'Infectious Disease',gender:'female',rating:5,reviews:29,dist:3.0,avail:false,home:false,tele:true,insur:true,ini:'RA',av:'av-r',
   desc:'Infectious disease specialist with extensive experience in tropical medicine and antibiotic stewardship programs.'},
  {name:'Dr. Fares Gharbi',spec:'General Practitioner',gender:'male',rating:4,reviews:55,dist:0.5,avail:true,home:true,tele:true,insur:true,ini:'FG',av:'av-b',
   desc:'Family physician providing comprehensive care for patients of all ages, with a special interest in sports medicine.'},
  {name:'Dr. Nadia Sfaxi',spec:'Psychiatrist',gender:'female',rating:4,reviews:48,dist:1.9,avail:true,home:false,tele:true,insur:false,ini:'NS',av:'av-r',
   desc:'Psychiatrist specialising in anxiety, depression, and trauma. Offers both medication management and talk therapy.'},
  {name:'Dr. Omar Belhadj',spec:'Hematologist',gender:'male',rating:5,reviews:22,dist:3.5,avail:false,home:false,tele:false,insur:true,ini:'OB',av:'av-b',
   desc:'Hematologist treating blood disorders including anemia, clotting conditions, and hematologic malignancies.'},
  {name:'Dr. Yosra Baccouche',spec:'Allergist',gender:'female',rating:4,reviews:36,dist:2.3,avail:true,home:false,tele:true,insur:true,ini:'YB',av:'av-r',
   desc:'Allergist and immunologist with expertise in food allergies, asthma, and eczema. Offers skin-prick testing and immunotherapy.'},
  {name:'Dr. Tarek Mansouri',spec:'Nutritionist',gender:'male',rating:3,reviews:18,dist:1.1,avail:true,home:true,tele:true,insur:false,ini:'TM',av:'av-b',
   desc:'Clinical nutritionist helping patients manage diabetes, obesity, and nutritional deficiencies through tailored diet plans.'},
];

let filters = {avail:'all', rating:'0', gender:'all', dist:10};

function setFilter(el, type) {
  document.querySelectorAll(`[data-filter="${type}"]`).forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  filters[type] = el.dataset.val;
  filterDoctors();
}

function updateDist(inp) {
  filters.dist = +inp.value;
  document.getElementById('distVal').textContent = inp.value + ' km';
  filterDoctors();
}

function clearFilters() {
  filters = {avail:'all', rating:'0', gender:'all', dist:10};
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.val === 'all' || c.dataset.val === '0');
  });
  document.getElementById('distRange').value = 10;
  document.getElementById('distVal').textContent = '10 km';
  document.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = false);
  document.getElementById('searchInput').value = '';
  document.getElementById('specFilter').value = '';
  filterDoctors();
}

function filterDoctors() {
  const q     = document.getElementById('searchInput').value.toLowerCase();
  const spec  = document.getElementById('specFilter').value;
  const sort  = document.getElementById('sortBy').value;
  const home  = document.getElementById('chkHome').checked;
  const tele  = document.getElementById('chkTele').checked;
  const insur = document.getElementById('chkInsur').checked;

  let list = doctors.filter(d => {
    if (q && !d.name.toLowerCase().includes(q) && !d.spec.toLowerCase().includes(q) && !d.desc.toLowerCase().includes(q)) return false;
    if (spec && d.spec !== spec) return false;
    if (filters.avail === 'today' && !d.avail) return false;
    if (filters.gender !== 'all' && d.gender !== filters.gender) return false;
    if (d.rating < +filters.rating) return false;
    if (d.dist > filters.dist) return false;
    if (home && !d.home) return false;
    if (tele && !d.tele) return false;
    if (insur && !d.insur) return false;
    return true;
  });

  if (sort === 'rating') list.sort((a,b) => b.rating - a.rating);
  else if (sort === 'avail') list.sort((a,b) => b.avail - a.avail);
  else list.sort((a,b) => a.dist - b.dist);

  renderList(list);
}

const stars = r => Array.from({length:5},(_,i) => `<span class="${i<r?'sf':'se'}">★</span>`).join('');

function renderList(list) {
  const el = document.getElementById('docList');
  const none = document.getElementById('noResults');
  document.getElementById('resultCount').textContent =
    list.length ? `Showing ${list.length} doctor${list.length>1?'s':''}` : 'No results found';

  if (!list.length) { el.innerHTML = ''; none.style.display = 'block'; renderPagination(0); return; }
  none.style.display = 'none';

  el.innerHTML = list.map(d => `
    <div class="doc-item">
      <div class="doc-av ${d.av}">${d.ini}</div>
      <div class="doc-info">
        <h4>${d.name}</h4>
        <div class="spec">${d.spec}</div>
        <div class="desc">${d.desc}</div>
        <div class="doc-tags">
          <span class="doc-tag hl">${d.dist} km away</span>
          ${d.home  ? '<span class="doc-tag">Home visits</span>' : ''}
          ${d.tele  ? '<span class="doc-tag">Teleconsult</span>' : ''}
          ${d.insur ? '<span class="doc-tag">Insurance</span>'  : ''}
        </div>
        <div class="doc-meta-row">
          <div class="stars">${stars(d.rating)}</div>
          <span class="rating-count">${d.rating}/5 (${d.reviews} reviews)</span>
          <span class="avail-badge ${d.avail?'avail-yes':'avail-no'}">${d.avail?'Available today':'Next available: next week'}</span>
        </div>
      </div>
      <div class="doc-actions">
        <button class="btn-book">Book Appointment</button>
        <button class="btn-profile">View Profile</button>
      </div>
    </div>`).join('');

  renderPagination(list.length);
}

function renderPagination(total) {
  const pages = Math.ceil(total / 5) || 0;
  document.getElementById('pagination').innerHTML = pages <= 1 ? '' :
    Array.from({length:pages},(_,i) =>
      `<button class="page-btn${i===0?' active':''}" onclick="selectPage(this,${i+1})">${i+1}</button>`
    ).join('') +
    `<button class="page-btn" onclick="selectPage(this,'next')">›</button>`;
}

function selectPage(el, val) {
  document.querySelectorAll('.page-btn').forEach(b => b.classList.remove('active'));
  if (val !== 'next') el.classList.add('active');
}

filterDoctors();