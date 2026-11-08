export function installTour({navigate}){
  const steps=[
    ['markets','#profile-bar','Saglabātas atlases','Atver Filtri, izvēlies biržu, Spot/Perpetual, apjomu, RVOL un signālu kritērijus. Nosauc atlasi un saglabā. To var atjaunot ar vienu izvēli.'],
    ['markets','#market-content','Instrumenta pilnais skats','Atver tirgu: izvēlies grafika intervālu, pietuvini, pārvieto vēsturi un salīdzini pieejamos biržu tirgus. Grafika intervāls nemaina fona skeneri.'],
    ['results','#market-content','Rezultātu kopsavilkums','Izvēlies 7 vai 30 dienas un stratēģiju. Kopsavilkumi izmanto tikai pabeigtus logus ar pilnu datu pārklājumu. TP/SL secība vienā svecē var nebūt zināma.'],
    ['dashboard','#asset-scope','Aktīvu grupas','Visi tirgi, Kripto, Akcijas un Izejvielas filtrē pašreizējo sadaļu. Izvēle saglabājas šajā pārlūkā.'],
    ['dashboard','#scanner-toggles','Mani skeneri','Seši slēdži rāda vai paslēpj pārskata blokus. Skenera nosaukums atver pilno plūsmu. Slēdzis nemaina fona aprēķinus.'],
    ['dashboard','#market-content','Pārskata kolonnas','Katrs bloks rāda savus jaunākos signālus. Kartītes grafiks atver saglabāto signāla momentuzņēmumu.'],
    ['top10','#market-content','Top 10 kripto','Desmit kripto pēc mūsu avotos likvīdākā tirgus 24 stundu apgrozījuma. Katrs kripto ir vienu reizi; stabilās un atlasītās ietītās monētas ir izslēgtas.'],
    ['news','#market-content','Ziņas','Atsevišķa ziņu plūsma ar avotu, publicēšanas laiku un oriģinālo rakstu. Akciju plūsma seko AAPL, MSFT, NVDA un SPY.'],
    ['database','#market-content','Datubāze','Filtrē instrumentus pēc biržas un tirgus veida. Sveces un intervāli rāda tieši saglabāto vēsturi šajā krātuvē.'],
    ['markets','#navigation','Visas sadaļas','Kreisajā izvēlnē atver tirgus, skenerus, akcijas, izejvielas, jaunumus un rezultātus. Tev nav jāreģistrējas.'],
    ['markets','#search','Meklēšana','Ieraksti BTC, AAPL vai uzņēmuma nosaukumu. Saraksts uzreiz atlasīs atbilstošos tirgus.'],
    ['markets','#filter-button','Filtri un kārtošana','Poga Filtri atver aktīvu grupu, kustības un RVOL atlasi. Kārtot maina tabulas secību. Tukšs RVOL nozīmē, ka vēl trūkst vēstures.'],
    ['markets','#market-content','Grafiki un izlase','Klikšķini uz instrumenta rindas, lai atvērtu sveču grafiku. Tajā vari izvēlēties 30, 80 vai 160 sveces. Zvaigznīte saglabā instrumentu Izlasē.'],
    ['markets','#timeframes','Laika intervāli','Augšējās 5m–1d pogas maina skenera sveci. Atsevišķā periodu rindā izvēlas Markets aprēķinu periodu. Jaunās vēstures ielāde var aizņemt dažas minūtes.'],
    ['MOVES','#market-content','Cenu kustības','MOVES rāda tikai kustības, kas izpildīja svārstīgumam pielāgoto nosacījumu. Atver signāla grafiku: tas saglabā tieši novērojuma brīdī zināmās sveces.'],
    ['LEVELS','#market-content','Atbalsts un pretestība','LEVELS meklē cenu līmeņus ar vismaz trim apstiprinātām reakcijām. Tukša sadaļa nozīmē, ka atbilstošs signāls vēl nav atrasts.'],
    ['SLOPE','#market-content','Trendlīnijas','SLOPE meklē trendlīniju pieskārienus un izlaušanos. Signāla grafikā redzēsi saglabāto līniju un analītiskos atskaites punktus.'],
    ['stocks','#class-mode','Akcijas un ETF','Instrumenti rāda visus atklātos akcijām piesaistītos tirgus. Signāli rāda tikai atbilstošos novērojumus. Tie ir biržu tokeni vai atvasināti instrumenti.'],
    ['commodities','#market-content','Izejvielas','Šeit atrodami pieejamie zelta, sudraba, naftas, gāzes un citi biržu instrumenti. Atver jebkuru rindu, lai apskatītu tās grafiku.'],
    ['listings','#market-content','Biržu jaunumi','Atlasi biržu un Spot, Perpetual vai Alpha tirgu. Klikšķis uz virsraksta atver oficiālo avotu. Nezināmi sākuma laiki netiek izdomāti.'],
    ['results','#market-content','Signālu rezultāti','MFE un MAE parāda cenu kustību pēc signāla. Tie nav izpildīti darījumi vai garantēta peļņa. Jauniem signāliem vajadzīgs novērošanas laiks.'],
    ['settings','#settings-form','Iestatījumi un skaņa','Izvēlies avotu, skenera apjomu un aktīvu grupu. Saglabāt iestatījumus sāk jaunu skenēšanu. Skaņas piemērs ļauj pārbaudīt signālu skaņu.'],
    ['markets','#export-link','Vēstures kopija','Eksportēt vēsturi lejupielādē JSON failu. Tava izlase, iestatījumi un personīgā pārlūka vēsture paliek šajā ierīcē. Publiskā datu padeve atjaunojas arī ar aizvērtu lapu.']
  ];
  const panel=document.createElement('section');panel.className='tour-panel';panel.setAttribute('aria-label','MarketPulse pamācība');panel.hidden=true;document.body.append(panel);let current=0,highlight,generation=0;
  async function show(index){const token=++generation;current=index;highlight?.classList.remove('tour-highlight');await navigate(steps[index][0]);if(token!==generation)return;const [view,target,title,text]=steps[index];highlight=document.querySelector(target);highlight?.classList.add('tour-highlight');panel.hidden=false;panel.innerHTML='<span class="tour-count">'+(index+1)+' / '+steps.length+'</span><h3>'+title+'</h3><p>'+text+'</p><div><button data-tour="close">Beigt</button>'+(index?'<button data-tour="prev">Atpakaļ</button>':'')+'<button data-tour="next">'+(index===steps.length-1?'Pabeigt':'Tālāk →')+'</button></div>';document.querySelector('.app-shell')?.scrollIntoView({block:'start'});}
  function close(){generation++;highlight?.classList.remove('tour-highlight');panel.hidden=true;}
  panel.addEventListener('click',e=>{const action=e.target.closest('[data-tour]')?.dataset.tour;if(action==='close')close();if(action==='prev')show(current-1);if(action==='next'){if(current===steps.length-1)close();else show(current+1);}});
  document.querySelector('#tour-button')?.addEventListener('click',()=>show(0));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
}
