
  const sel = new Set();

  function toggleTag(el) {
    const s = el.dataset.symptom;
    el.classList.toggle('active');
    el.classList.contains('active') ? sel.add(s) : sel.delete(s);
    renderSel();
  }

  function addCustom() {
    const inp = document.getElementById('customSymptom');
    const v = inp.value.trim();
    if (v) { sel.add(v); renderSel(); inp.value = ''; }
  }

  function removeSymptom(s) {
    sel.delete(s);
    document.querySelectorAll('.tag').forEach(t => { if (t.dataset.symptom === s) t.classList.remove('active'); });
    renderSel();
  }

  function renderSel() {
    document.getElementById('selTags').innerHTML = [...sel].map(s =>
      `<div class="sel-tag">${s}<button onclick="removeSymptom('${s.replace(/'/g,"\\'")}')">×</button></div>`
    ).join('');
  }

  const condDB = {
    'Fever,Cough,Sore throat':[
      {name:'Influenza (Flu)',match:88,desc:'A viral respiratory illness causing fever, muscle aches, and upper respiratory symptoms.',specs:['General Practitioner','Infectious Disease'],tags:['Viral','Respiratory']},
      {name:'Common Cold',match:70,desc:'A mild viral infection of the upper respiratory tract with sneezing and congestion.',specs:['General Practitioner'],tags:['Viral']},
      {name:'COVID-19',match:62,desc:'Infection by SARS-CoV-2; can range from mild to severe respiratory illness.',specs:['General Practitioner','Pulmonologist'],tags:['Viral','Respiratory']}
    ],
    'Headache,Dizziness,Fatigue':[
      {name:'Migraine',match:84,desc:'Recurring moderate-to-severe headaches, sometimes with nausea and light sensitivity.',specs:['Neurologist'],tags:['Neurological','Chronic']},
      {name:'Tension Headache',match:72,desc:'The most common headache type, felt as pressure or tightness around the head.',specs:['General Practitioner'],tags:['Common']},
      {name:'Anemia',match:55,desc:'Low red blood cell count causing fatigue, pallor, dizziness, and headaches.',specs:['Hematologist'],tags:['Blood']}
    ],
    'Chest pain,Shortness of breath':[
      {name:'Angina Pectoris',match:75,desc:'Chest pain caused by reduced blood flow to the heart, often triggered by exertion.',specs:['Cardiologist'],tags:['Cardiac','Urgent']},
      {name:'Anxiety / Panic Attack',match:65,desc:'Intense fear episodes triggering physical reactions like chest tightness.',specs:['Psychiatrist'],tags:['Mental Health']},
      {name:'Asthma',match:58,desc:'Airways narrow and swell, causing breathing difficulty and wheezing.',specs:['Pulmonologist','Allergist'],tags:['Respiratory','Chronic']}
    ],
    default:[
      {name:'Viral Infection (unspecified)',match:70,desc:'Your symptoms are consistent with a general viral infection.',specs:['General Practitioner'],tags:['Viral']},
      {name:'Stress-related Illness',match:55,desc:'Physical symptoms can be triggered or worsened by prolonged stress.',specs:['General Practitioner','Psychiatrist'],tags:['Mental Health']},
      {name:'Nutritional Deficiency',match:45,desc:'Low vitamins or minerals can cause a wide range of systemic symptoms.',specs:['Nutritionist'],tags:['Nutritional']}
    ]
  };

  const docDB = [
    {name:'Dr. Sana Khelifi',spec:'General Practitioner',rating:5,dist:'0.8 km',avail:true,ini:'SK',av:'av-r'},
    {name:'Dr. Amine Ben Slama',spec:'Cardiologist',rating:4,dist:'1.4 km',avail:true,ini:'AB',av:'av-b'},
    {name:'Dr. Leila Mhiri',spec:'Neurologist',rating:5,dist:'2.1 km',avail:false,ini:'LM',av:'av-r'},
    {name:'Dr. Karim Trabelsi',spec:'Pulmonologist',rating:4,dist:'2.6 km',avail:true,ini:'KT',av:'av-b'},
    {name:'Dr. Rima Abidi',spec:'Infectious Disease',rating:5,dist:'3.0 km',avail:false,ini:'RA',av:'av-r'},
    {name:'Dr. Fares Gharbi',spec:'General Practitioner',rating:4,dist:'0.5 km',avail:true,ini:'FG',av:'av-b'}
  ];

  const lk = m => m>=75?'lk-high':m>=55?'lk-mid':'lk-low';
  const stars = r => Array.from({length:5},(_,i)=>`<span class="${i<r?'sf':'se'}">★</span>`).join('');

  function matchConds() {
    const syms = [...sel];
    for (const k of Object.keys(condDB)) {
      if (k==='default') continue;
      if (k.split(',').filter(kw=>syms.some(s=>s.toLowerCase().includes(kw.toLowerCase()))).length>=2) return condDB[k];
    }
    return condDB.default;
  }

  function runDiagnosis() {
    if (!sel.size) return alert('Please select at least one symptom.');
    document.getElementById('loader').classList.add('on');
    document.getElementById('results').classList.remove('on');
    setTimeout(renderResults, 2000);
  }

  function renderResults() {
    document.getElementById('loader').classList.remove('on');
    document.getElementById('condList').innerHTML = matchConds().map(c => `
      <div class="condition-card">
        <div class="lk-wrap"><div class="lk-circle ${lk(c.match)}">${c.match}%</div><span>match</span></div>
        <div class="cond-body"><h3>${c.name}</h3><p>${c.desc}</p>
          <div class="cond-tags">
            ${c.specs.map(s=>`<span class="c-tag">${s}</span>`).join('')}
            ${c.tags.map(t=>`<span class="c-tag r">${t}</span>`).join('')}
          </div>
        </div>
      </div>`).join('');

    document.getElementById('docGrid').innerHTML = [...docDB].sort(()=>Math.random()-.5).slice(0,4).map(d => `
      <div class="doc-card">
        <div class="doc-av ${d.av}">${d.ini}</div>
        <h4>${d.name}</h4><div class="spec">${d.spec}</div>
        <div class="stars">${stars(d.rating)}</div>
        <div class="doc-meta"><span>${d.dist} away</span><span class="${d.avail?'avail':''}">${d.avail?'Available today':'Next week'}</span></div>
        <button class="btn-book">Book Appointment</button>
      </div>`).join('');

    const r = document.getElementById('results');
    r.classList.add('on');
    r.scrollIntoView({behavior:'smooth',block:'start'});
  }