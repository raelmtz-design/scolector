/* Generador DOCX basado en el modelo local del usuario. No transmite el modelo. */
'use strict';
const InformeWord = (() => {
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const REL='http://schemas.openxmlformats.org/package/2006/relationships';
  const CT='http://schemas.openxmlformats.org/package/2006/content-types';
  const campos=['lubPresion','lubTempTanque','lubTempSalida','nivelAceiteMotriz','nivelAceiteLibre','compuertaApertura','tanquePresion','sopEntrada','sopSalida','sopTransmisor','tolvaMot01','tolvaMot02','tolvaMot03','humNivelAceite'];
  const grupos=[
    ['Presión del sistema (kPa)',['presIngreso','presSalida','presDiferencia'],['Ingreso','Salida','Diferencial']],
    ['Presiones auxiliares (MPa)',['presAire','presLubricacion'],['Aire comprimido','Lubricación']],
    ['Temperaturas (°C)',['tempChumLibre','tempChumMot','tempMotVent','tempMotAcop'],['Chum. libre','Chum. motriz','Motor ventilador','Motor acople']],
    ['Vibraciones (mm/s)',['vibLibre','vibMot'],['Lado libre','Lado motriz']],
    ['Apertura de compuerta (%)',['compuerta'],['Compuerta']]
  ];
  const presente=x=>x!==null&&x!==undefined&&String(x).trim()!=='';
  const numero=x=>presente(x)&&Number.isFinite(Number(x))?Number(x):null;
  const mostrar=x=>presente(x)?String(x):'Sin registro';
  const decimal=x=>x===null?'Sin registro':Number(x.toFixed(2)).toLocaleString('es-PE',{maximumFractionDigits:2});
  const fecha=x=>x.split('-').reverse().join('/');
  const promedio=a=>{const n=a.map(numero).filter(x=>x!==null);return n.length?n.reduce((s,x)=>s+x,0)/n.length:null;};
  const xml=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('El modelo contiene XML no válido.');return d;};
  const serial=e=>new XMLSerializer().serializeToString(e);
  const hijos=(e,n)=>Array.from(e.children).filter(x=>x.namespaceURI===W&&x.localName===n);
  const todos=(e,n)=>Array.from(e.getElementsByTagNameNS(W,n));
  const crear=(d,n,attrs={})=>{const e=d.createElementNS(W,'w:'+n);Object.entries(attrs).forEach(([k,v])=>e.setAttributeNS(W,'w:'+k,String(v)));return e;};
  function texto(el,valor) {
    const ts=todos(el,'t');
    if(ts.length){ts[0].textContent=String(valor??'');ts[0].setAttribute('xml:space','preserve');ts.slice(1).forEach(t=>t.textContent='');}
    else {const p=el.localName==='p'?el:(hijos(el,'p')[0]||el.appendChild(crear(el.ownerDocument,'p')));const r=crear(el.ownerDocument,'r'),t=crear(el.ownerDocument,'t');t.textContent=String(valor??'');r.append(t);p.append(r);}
  }
  function minutos(horario) {
    const p=/^\s*(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})\s*$/.exec(String(horario||''));
    if(!p||+p[1]>23||+p[3]>23||+p[2]>59||+p[4]>59)return null;
    const n=(+p[3]*60+(+p[4])-(+p[1]*60+(+p[2]))+1440)%1440;return n||null;
  }
  function resumen(dia) {
    const turnos=['DIA','NOCHE'].map(t=>dia.turnos[t]);
    const descargas=turnos.flatMap(t=>t.tolvas||[]);
    const duraciones=descargas.map(t=>minutos(t.horario));
    const toneladas=descargas.map(t=>numero(t.toneladas));
    const horas=turnos.map(t=>numero(t.parametrosGenerales.horasOperativas));
    return {descargas,minutos:duraciones.some(x=>x===null)?null:duraciones.reduce((s,x)=>s+x,0),toneladas:toneladas.some(x=>x===null)?null:toneladas.reduce((s,x)=>s+x,0),horas:horas.some(x=>x===null)?null:horas.reduce((s,x)=>s+x,0)};
  }
  function pendientes(semana) {
    const avisos=[];
    semana.dias.forEach(d=>{
      if(!d.existe)avisos.push(fecha(d.fecha)+': no hay registros.');
      for(const t of ['DIA','NOCHE']){
        const r=d.turnos[t],p=r.parametrosGenerales;
        const pref=fecha(d.fecha)+' '+t+': ';
        if(!presente(p.horasOperativas))avisos.push(pref+'faltan horas operativas.');
        if(!p.mantenimientoRevisado)avisos.push(pref+'falta revisar cambios de componentes.');
        const parado=numero(p.horasOperativas)===0;
        if(parado&&!presente(p.motivoParada))avisos.push(pref+'falta indicar el motivo de la parada del turno.');
        if(!parado&&campos.some(k=>!presente(p[k])))avisos.push(pref+'parámetros generales incompletos.');
        const lecturas=(r.monitoreo24H||[]).filter(l=>l.turno===t||((t==='DIA'?['09:00','11:00','13:00','15:00','17:00','19:00']:['21:00','23:00','01:00','03:00','05:00','07:00']).includes(l.hora)));
        if(!parado&&(lecturas.length!==6||lecturas.some(l=>grupos.some(g=>g[1].some(k=>!presente(l[k]))))))avisos.push(pref+'control operacional incompleto.');
        if(!parado&&!(r.fotos||[]).length)avisos.push(pref+'sin fotografías.');
        if(!presente(r.actividades)&&!parado)avisos.push(pref+'sin actividades registradas.');
        (r.advertencias||[]).forEach(a=>avisos.push(pref+a));
        if((r.tolvas||[]).some(e=>minutos(e.horario)===null||numero(e.toneladas)===null||numero(e.aperturaAgua)===null))avisos.push(pref+'descargas con datos pendientes.');
      }
      if(d.fotosSinTurno?.length)avisos.push(fecha(d.fecha)+': '+d.fotosSinTurno.length+' fotos sin turno identificado.');
    });
    return [...new Set(avisos)];
  }
  async function imagen(dataUrl,max=1200){
    const img=new Image();img.src=dataUrl;await img.decode();
    const ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
    const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(img,0,0,canvas.width,canvas.height);
    return {base64:canvas.toDataURL('image/jpeg',0.88).split(',')[1],width:canvas.width,height:canvas.height};
  }
  function grafico(titulo,etiquetas,series){
    const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=500;
    const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1400,500);
    c.fillStyle='#222';c.font='bold 26px Arial';c.fillText(titulo,80,36);
    const valores=series.flatMap(s=>s.valores).filter(x=>x!==null);let min=valores.length?Math.min(0,...valores):0,max=valores.length?Math.max(...valores):1;if(max===min)max=min+1;
    const colores=['#1F4E79','#C55A11','#548235','#7030A0'];
    c.font='18px Arial';
    for(let i=0;i<=4;i++){const y=80+i*75;c.strokeStyle='#D9D9D9';c.beginPath();c.moveTo(80,y);c.lineTo(1330,y);c.stroke();c.fillStyle='#444';c.fillText(decimal(max-(max-min)*i/4),8,y+6);}
    etiquetas.forEach((e,i)=>{c.fillStyle='#444';c.fillText(e,65+i*1250/Math.max(1,etiquetas.length-1),415);});
    series.forEach((s,j)=>{c.strokeStyle=colores[j%4];c.lineWidth=3;c.beginPath();let activo=false;s.valores.forEach((v,i)=>{if(v===null){activo=false;return;}const x=80+i*1250/Math.max(1,etiquetas.length-1),y=380-(v-min)/(max-min)*300;if(activo)c.lineTo(x,y);else c.moveTo(x,y);activo=true;});c.stroke();c.fillStyle=colores[j%4];c.fillRect(80+j*310,455,25,5);c.fillStyle='#333';c.fillText(s.nombre,115+j*310,465);});
    return {base64:canvas.toDataURL('image/png').split(',')[1],width:1400,height:500,png:true};
  }
  async function generar(modelo,semana,meta,obtenerFoto,progreso=()=>{}) {
    if(typeof JSZip==='undefined')throw Error('No se pudo cargar el componente Word. Recargue la página.');
    const zip=await JSZip.loadAsync(modelo);
    if(!zip.file('word/document.xml'))throw Error('Seleccione el modelo en formato DOCX.');
    const doc=xml(await zip.file('word/document.xml').async('string'));
    const body=doc.getElementsByTagNameNS(W,'body')[0],origen=Array.from(body.children).map(e=>e.cloneNode(true));
    if(origen.length<279||!serial(origen[29]).includes('LUBRICACI'))throw Error('Este archivo no corresponde al modelo de informe configurado. Seleccione el documento fuente facilitado.');
    const rels=xml(await zip.file('word/_rels/document.xml.rels').async('string'));
    const tipos=xml(await zip.file('[Content_Types].xml').async('string'));
    const sect=origen[278].cloneNode(true);body.replaceChildren();
    let id=10000;
    const clonar=i=>origen[i].cloneNode(true);
    const add=e=>{body.appendChild(e);return e;};
    function par(valor,indice=16,salto=false){const p=clonar(indice);todos(p,'drawing').forEach(e=>e.remove());todos(p,'pict').forEach(e=>e.remove());todos(p,'br').forEach(e=>e.remove());texto(p,valor);let pr=hijos(p,'pPr')[0];if(!pr){pr=crear(doc,'pPr');p.prepend(pr);}hijos(pr,'numPr').forEach(e=>e.remove());hijos(pr,'pageBreakBefore').forEach(e=>e.remove());if(salto)pr.appendChild(crear(doc,'pageBreakBefore'));return add(p);}
    function tablaPersonalizada(encabezado,filas,anchos){
      const tabla=clonar(41);const modelos=hijos(tabla,'tr').map(e=>e.cloneNode(true));hijos(tabla,'tr').forEach(e=>e.remove());
      const grid=hijos(tabla,'tblGrid')[0];grid.replaceChildren();anchos.forEach(w=>grid.append(crear(doc,'gridCol',{w})));
      [encabezado,...filas].forEach((valores,i)=>{const fila=modelos[i?1:0].cloneNode(true);hijos(fila,'tc').forEach(e=>e.remove());valores.forEach((v,j)=>{const celda=hijos(modelos[i?1:0],'tc')[Math.min(j,5)].cloneNode(true);const prop=hijos(celda,'tcPr')[0];hijos(prop,'gridSpan').forEach(e=>e.remove());hijos(prop,'vMerge').forEach(e=>e.remove());let w=hijos(prop,'tcW')[0];if(w)w.setAttributeNS(W,'w:w',anchos[j]);texto(celda,v);fila.append(celda);});todos(fila,'trHeight').forEach(e=>e.remove());if(!i){let prop=hijos(fila,'trPr')[0];if(!prop){prop=crear(doc,'trPr');fila.prepend(prop);}prop.append(crear(doc,'tblHeader'));}tabla.append(fila);});return add(tabla);
    }
    function figura(datos,ancho=5200000,alto=2200000){
      const rid='rIdInforme'+(++id),ext=datos.png?'png':'jpg',nombre='informe-'+id+'.'+ext;
      zip.file('word/media/'+nombre,datos.base64,{base64:true});
      const rel=rels.createElementNS(REL,'Relationship');rel.setAttribute('Id',rid);rel.setAttribute('Type',R+'/image');rel.setAttribute('Target','media/'+nombre);rels.documentElement.append(rel);
      const escala=Math.min(ancho/datos.width,alto/datos.height),cx=Math.round(datos.width*escala),cy=Math.round(datos.height*escala);
      const p=xml('<w:p xmlns:w="'+W+'" xmlns:r="'+R+'" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:drawing><wp:inline><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+id+'" name="Figura '+id+'"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+id+'" name="'+nombre+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+rid+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>');
      return doc.importNode(p.documentElement,true);
    }
    // Portada y contexto desde el modelo, sustituyendo los datos del periodo.
    for(let i=0;i<=24;i++){
      const e=clonar(i);
      if(i===5)texto(e,'REPORTE TÉCNICO SEMANAL '+meta.numero+' ÁREA COLECTOR DE POLVOS');
      if(i===7)texto(e,fecha(semana.inicio)+' AL '+fecha(semana.fin));
      if(i===14){const f=hijos(e,'tr');const cs=hijos(f[1],'tc');texto(cs[0],meta.revision||'01');texto(cs[1],meta.autor);texto(cs[2],meta.revisor);texto(hijos(f[0],'tc')[2],'Revisor');}
      if(i===16)texto(e,'El presente reporte describe las actividades de inspección, monitoreo y operación del colector de polvos realizadas del '+fecha(semana.inicio)+' al '+fecha(semana.fin)+' en la planta de beneficio nueva.');
      if(i===18)texto(e,meta.alcance);
      if(i===20)texto(e,meta.resumen);
      add(e);
    }
    par('ACTIVIDADES DE LA SEMANA',26,true);
    let procesadas=0;const cacheFotos=new Map();
    const totalFotos=semana.dias.reduce((s,d)=>s+d.turnos.DIA.fotos.length+d.turnos.NOCHE.fotos.length+(d.fotosSinTurno||[]).length,0);
    async function fotos(lista,titulo){
      if(!lista.length){par(titulo+': sin fotografías registradas.',31);return;}
      par(titulo,31,true);
      for(let i=0;i<lista.length;i+=2){
        const t=clonar(43),filas=hijos(t,'tr');filas.slice(3).forEach(e=>e.remove());
        texto(filas[0],titulo);todos(t,'trHeight').forEach(e=>e.remove());
        for(let j=0;j<2;j++){
          const foto=lista[i+j],caption=hijos(filas[1],'tc')[j],celda=hijos(filas[2],'tc')[j];
          Array.from(celda.children).filter(e=>e.localName!=='tcPr').forEach(e=>e.remove());
          texto(caption,foto?mostrar(foto.descripcion):'');
          if(foto){
            progreso('Preparando fotografía '+(++procesadas)+' de '+totalFotos+'…');
            let datos=cacheFotos.get(foto.id);if(!datos){const archivo=await obtenerFoto(foto.id);datos=await imagen('data:'+archivo.tipo+';base64,'+archivo.base64);cacheFotos.set(foto.id,datos);}
            celda.append(figura(datos,2500000,1900000));
          }else celda.append(crear(doc,'p'));
        }
        add(t);par('');
      }
    }
    for(let di=0;di<semana.dias.length;di++){
      const dia=semana.dias[di];progreso('Preparando '+fecha(dia.fecha)+'…');
      par('Día '+fecha(dia.fecha),27,di>0);par('Sistemas de Colector de Polvos en Operación',28);
      const tabla=clonar(29),filas=hijos(tabla,'tr');
      campos.forEach((campo,i)=>{const cells=hijos(filas[i+2],'tc');texto(cells[2],mostrar(dia.turnos.DIA.parametrosGenerales[campo]));texto(cells[3],mostrar(dia.turnos.NOCHE.parametrosGenerales[campo]));});
      [5,6,12,13,14,15].forEach(i=>{const celda=hijos(filas[i],'tc')[1];texto(celda,todos(celda,'t').map(t=>t.textContent).join('').replace(/\s*\(%\)/g,''));});
      todos(tabla,'trHeight').forEach(e=>e.remove());add(tabla);
      par('Inspecciones y actividades realizadas',31);
      for(const turno of ['DIA','NOCHE']){
        const r=dia.turnos[turno],p=r.parametrosGenerales;par('Turno '+turno,31);
        String(r.actividades||'Sin actividades registradas.').split('\n').filter(Boolean).forEach(s=>par(s));
        par('Horas operativas: '+mostrar(p.horasOperativas)+'. Paradas: '+mostrar(p.motivoParada)+'.');
        if(p.estadoEquipos)par('Estado observado: '+p.estadoEquipos);
        if(p.pendientes)par('Pendientes: '+p.pendientes);
      }
      const rs=resumen(dia);
      par('Registro de descarga de tolvas',31);
      tablaPersonalizada(['N.º','Turno','Horario','Duración (h)','Frente 5730-SVC','Toneladas'],rs.descargas.length?rs.descargas.map((t,i)=>[i+1,t.turno,t.horario,decimal(minutos(t.horario)===null?null:minutos(t.horario)/60),mostrar(t.frente),mostrar(t.toneladas)]):[['—','—','Sin descargas registradas','—','—','—']],[500,850,2050,1000,1900,1704]);
      par('Total registrado: '+decimal(rs.minutos===null?null:rs.minutos/60)+' horas de descarga; '+decimal(rs.toneladas)+' toneladas.');
      await fotos(dia.turnos.DIA.fotos,'TURNO DÍA');await fotos(dia.turnos.NOCHE.fotos,'TURNO NOCHE');
      if(dia.fotosSinTurno?.length)await fotos(dia.fotosSinTurno,'FOTOGRAFÍAS SIN TURNO IDENTIFICADO');
      const horas=['09:00','11:00','13:00','15:00','17:00','19:00','21:00','23:00','01:00','03:00','05:00','07:00'];
      const lecturas=dia.turnos.DIA.monitoreo24H||[];
      par('Control y monitoreo de parámetros operacionales',31,true);
      for(let g=0;g<grupos.length;g++){
        const [titulo,keys,labels]=grupos[g];par(titulo,31,g>0);
        const series=keys.map((k,j)=>({nombre:labels[j],valores:horas.map(h=>numero(lecturas.find(l=>l.hora===h)?.[k]))}));
        add(figura(grafico(titulo,horas,series),5400000,2000000));
        const width=Math.floor(8704/(labels.length+1));
        tablaPersonalizada(['Hora',...labels],horas.map((h,i)=>[h,...series.map(s=>mostrar(s.valores[i]))]),Array(labels.length+1).fill(width));
      }
    }
    par('RESUMEN ESTADÍSTICO',194,true);
    const resumenes=semana.dias.map(resumen);
    const suma=k=>resumenes.some(r=>r[k]===null)?null:resumenes.reduce((s,r)=>s+r[k],0);
    const filasResumen=semana.dias.map((d,i)=>[fecha(d.fecha),decimal(resumenes[i].minutos===null?null:resumenes[i].minutos/60),decimal(resumenes[i].toneladas),decimal(resumenes[i].horas)]);
    filasResumen.push(['TOTAL REGISTRADO',decimal(suma('minutos')===null?null:suma('minutos')/60),decimal(suma('toneladas')),decimal(suma('horas'))]);
    tablaPersonalizada(['Día','Descarga (h)','Toneladas','Operación (h)'],filasResumen,[2100,2100,2100,2404]);
    par('Los espacios sin registro no se consideran cero. Las horas de descarga se calculan sumando minutos antes del redondeo.');
    for(const [k,titulo] of [['minutos','Horas de descarga'],['toneladas','Toneladas extraídas']])add(figura(grafico(titulo,semana.dias.map(d=>d.fecha.slice(8)+'/'+d.fecha.slice(5,7)),[{nombre:titulo,valores:resumenes.map(r=>r[k]===null?null:(k==='minutos'?r[k]/60:r[k]))}]),5400000,2100000));
    for(const tipo of ['mangas','diafragmas','pistones']){
      par('Cambios de '+tipo,31,true);const registros=[];
      semana.dias.forEach(d=>['DIA','NOCHE'].forEach(t=>{const p=d.turnos[t].parametrosGenerales;const items=(p.mantenimientos||[]).filter(m=>m.tipo===tipo);items.forEach(m=>registros.push([fecha(d.fecha),t,m.equipo,m.lado,m.cantidad]));if(!items.length)registros.push([fecha(d.fecha),t,p.mantenimientoRevisado?'Sin cambios':'Sin revisión','—',p.mantenimientoRevisado?'0':'Sin registro']);}));
      tablaPersonalizada(['Fecha','Turno','Equipo / Tolva','Lado','Cantidad'],registros,[1750,1350,2500,1300,1104]);
      const cantidad=semana.dias.reduce((s,d)=>s+['DIA','NOCHE'].reduce((a,t)=>a+(d.turnos[t].parametrosGenerales.mantenimientos||[]).filter(m=>m.tipo===tipo).reduce((n,m)=>n+(numero(m.cantidad)||0),0),0),0);par('Total de cambios registrados: '+cantidad+'.');
    }
    par('Apertura de agua del humidificador',31,true);
    const agua=[];semana.dias.forEach(d=>resumen(d).descargas.forEach((e,i)=>agua.push([fecha(d.fecha),e.turno,i+1,e.horario,mostrar(e.aperturaAgua)])));
    tablaPersonalizada(['Fecha','Turno','Descarga','Horario','Agua (%)'],agua.length?agua:[['—','—','—','Sin descargas registradas','—']],[1700,1250,1000,3000,1054]);
    par('Promedio de aperturas registradas: '+decimal(promedio(semana.dias.flatMap(d=>resumen(d).descargas.map(e=>e.aperturaAgua))))+' %.');
    par('Temperatura del tanque del sistema de lubricación',31,true);
    const temp=semana.dias.map(d=>[fecha(d.fecha),mostrar(d.turnos.DIA.parametrosGenerales.lubTempTanque),mostrar(d.turnos.NOCHE.parametrosGenerales.lubTempTanque)]);
    temp.push(['PROMEDIO',...['DIA','NOCHE'].map(t=>decimal(promedio(semana.dias.map(d=>d.turnos[t].parametrosGenerales.lubTempTanque))))]);
    tablaPersonalizada(['Fecha','Día (°C)','Noche (°C)'],temp,[2900,2900,2904]);
    for(const [titulo,campo] of [['Estado de ductos y campanas en torre de silo','silo'],['Estado de ductos, electroválvulas y campanas en torre HPGR','hpgr'],['Estado de ductos, válvulas, compuertas y campanas en torre de zarandas','zarandas'],['Conclusiones y recomendaciones','conclusiones']]){par(titulo,31,true);String(meta[campo]||'Sin revisión semanal registrada.').split('\n').filter(Boolean).forEach(s=>par(s));}
    const avisos=pendientes(semana);if(avisos.length){par('Datos pendientes de completar',31,true);avisos.forEach(a=>par(a));}
    body.append(sect);
    // Eliminar contenido histórico no utilizado y metadatos del documento modelo.
    const usados=new Set();Array.from(body.getElementsByTagName('*')).forEach(e=>Array.from(e.attributes).forEach(a=>{if(a.namespaceURI===R)usados.add(a.value);}));
    const tipoPreservado=['styles','numbering','fontTable','theme','settings','webSettings'];
    const targets=new Set();Array.from(rels.documentElement.children).forEach(r=>{if(usados.has(r.getAttribute('Id'))||tipoPreservado.some(t=>r.getAttribute('Type').endsWith('/'+t))){targets.add('word/'+r.getAttribute('Target'));}else r.remove();});
    Object.keys(zip.files).forEach(n=>{if(!zip.files[n]?.dir&&n.startsWith('word/media/')&&!targets.has(n)||/^word\/(charts|embeddings|comments|people)/.test(n)||n.startsWith('customXml/')||n.startsWith('docProps/'))zip.remove(n);});
    const rootRels=xml(await zip.file('_rels/.rels').async('string'));Array.from(rootRels.documentElement.children).forEach(r=>{if(!r.getAttribute('Type').endsWith('/officeDocument'))r.remove();});zip.file('_rels/.rels',serial(rootRels));
    Array.from(tipos.documentElement.children).forEach(t=>{const n=t.getAttribute('PartName');if(n&&!zip.file(n.slice(1)))t.remove();});
    for(const [ext,mime] of [['jpg','image/jpeg'],['png','image/png']])if(!Array.from(tipos.documentElement.children).some(t=>t.getAttribute('Extension')===ext)){const e=tipos.createElementNS(CT,'Default');e.setAttribute('Extension',ext);e.setAttribute('ContentType',mime);tipos.documentElement.append(e);}
    // IDs únicos al clonar párrafos y tablas; sin marcadores ni cambios antiguos.
    todos(body,'bookmarkStart').forEach(e=>e.remove());todos(body,'bookmarkEnd').forEach(e=>e.remove());
    Array.from(body.getElementsByTagName('*')).forEach(e=>{Array.from(e.attributes).forEach(a=>{if(a.localName.startsWith('rsid')||['paraId','textId'].includes(a.localName))e.removeAttributeNode(a);});});
    zip.file('word/document.xml',serial(doc));zip.file('word/_rels/document.xml.rels',serial(rels));zip.file('[Content_Types].xml',serial(tipos));
    progreso('Comprimiendo el documento Word…');return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  return {generar,pendientes,resumen,minutos,grupos};
})();

window.addEventListener('DOMContentLoaded',montarInforme);
if(document.readyState!=='loading')montarInforme();
function montarInforme(){
  if(document.getElementById('informeSemanal'))return;
  const panel=document.createElement('section');panel.id='informeSemanal';panel.className='section';
  panel.innerHTML='<h3>8. Informe semanal en Word</h3><p>Seleccione el lunes de la semana y consulte los registros guardados. El modelo Word se procesa en este navegador; no se sube al servidor.</p><label for="semanaInicio">Lunes de inicio</label><input id="semanaInicio" type="date"><button type="button" id="consultarSemana" class="btn-secondary">Consultar semana</button><p id="estadoSemana" role="status"></p><div id="revisionSemana"></div><label for="modeloWord">Modelo del informe (.docx)</label><input type="file" id="modeloWord" accept=".docx"><label for="numeroInforme">Número de informe</label><input id="numeroInforme" type="text" placeholder="Ej.: 78"><label for="autorInforme">Elaborado por</label><input id="autorInforme" type="text"><label for="revisorInforme">Revisor</label><input id="revisorInforme" type="text"><label for="alcanceInforme">Alcance del servicio</label><textarea id="alcanceInforme"></textarea><label for="resumenInforme">Resumen ejecutivo</label><textarea id="resumenInforme"></textarea><label for="siloInforme">Estado de equipos en torre de silo</label><textarea id="siloInforme"></textarea><label for="hpgrInforme">Estado de equipos en torre HPGR</label><textarea id="hpgrInforme"></textarea><label for="zarandasInforme">Estado de equipos en torre de zarandas</label><textarea id="zarandasInforme"></textarea><label for="conclusionesInforme">Conclusiones y recomendaciones</label><textarea id="conclusionesInforme"></textarea><label style="display:block;margin:16px 0"><input type="checkbox" id="aceptarPendientes" style="width:auto"> Si faltan datos, generar un borrador que los identifique expresamente</label><button type="button" id="exportarWord" class="btn-secondary" disabled>Descargar informe Word</button><p>Las observaciones de cierre se conservan en este navegador para la semana seleccionada. La revisión visual del documento se realiza en Word.</p>';
  document.getElementById('appContent').append(panel);
  const $=id=>document.getElementById(id);let semana=null,ocupado=false,urlDescarga=null;
  const mapping={numero:'numeroInforme',autor:'autorInforme',revisor:'revisorInforme',alcance:'alcanceInforme',resumen:'resumenInforme',silo:'siloInforme',hpgr:'hpgrInforme',zarandas:'zarandasInforme',conclusiones:'conclusionesInforme'};
  const meta=()=>Object.fromEntries(Object.entries(mapping).map(([k,id])=>[k,$(id).value.trim()]));
  const guardar=()=>{try{localStorage.setItem('colector_cierre_'+$('semanaInicio').value,JSON.stringify(meta()));}catch(e){}};
  Object.values(mapping).forEach(id=>$(id).addEventListener('input',guardar));
  $('semanaInicio').addEventListener('change',()=>{semana=null;$('exportarWord').disabled=true;$('revisionSemana').replaceChildren();$('estadoSemana').textContent='Consulte la semana seleccionada.';let prev={};try{prev=JSON.parse(localStorage.getItem('colector_cierre_'+$('semanaInicio').value)||'{}');}catch(e){}Object.entries(mapping).forEach(([k,id])=>$(id).value=prev[k]||'');});
  function bloquear(valor){ocupado=valor;panel.querySelectorAll('input,textarea,button').forEach(e=>e.disabled=valor);$('exportarWord').disabled=valor||!semana;}
  $('consultarSemana').addEventListener('click',async()=>{
    if(ocupado)return;const inicio=$('semanaInicio').value;
    if(!inicio||new Date(inicio+'T12:00:00Z').getUTCDay()!==1){$('estadoSemana').textContent='Seleccione un lunes.';return;}
    bloquear(true);semana=null;$('estadoSemana').textContent='Consultando los siete días…';$('revisionSemana').replaceChildren();
    try{
      semana=await solicitarAPI({accion:'semana',inicio});
      const tabla=document.createElement('table');const head=document.createElement('tr');['Fecha','Fotos día','Fotos noche','Descargas','Horas operativas'].forEach(s=>{const th=document.createElement('th');th.textContent=s;head.append(th);});tabla.append(head);
      semana.dias.forEach(d=>{const tr=document.createElement('tr'),r=InformeWord.resumen(d);[d.fecha,d.turnos.DIA.fotos.length,d.turnos.NOCHE.fotos.length,r.descargas.length,r.horas===null?'Pendiente':r.horas].forEach(s=>{const td=document.createElement('td');td.textContent=s;tr.append(td);});tabla.append(tr);});$('revisionSemana').append(tabla);
      const avisos=InformeWord.pendientes(semana);const detalle=document.createElement('details'),titulo=document.createElement('summary');titulo.textContent=avisos.length+' observaciones para revisar';detalle.append(titulo);avisos.forEach(a=>{const p=document.createElement('p');p.textContent=a;detalle.append(p);});$('revisionSemana').append(detalle);
      if(!$('autorInforme').value)$('autorInforme').value=document.getElementById('userDisplay').textContent;
      if(!$('alcanceInforme').value)$('alcanceInforme').value='Inspección, monitoreo y operación del sistema colector de polvos de la planta de beneficio nueva.';
      if(!$('resumenInforme').value)$('resumenInforme').value='Se presentan las actividades, lecturas operacionales y evidencias fotográficas de los turnos día y noche del '+semana.inicio+' al '+semana.fin+'.';
      $('estadoSemana').textContent='Semana recuperada. Complete la revisión de cierre y seleccione el modelo Word.';guardar();
    }catch(e){$('estadoSemana').textContent=e.message;}finally{bloquear(false);}
  });
  $('exportarWord').addEventListener('click',async()=>{
    if(ocupado||!semana)return;const archivo=$('modeloWord').files[0],m=meta();
    if(!archivo){$('estadoSemana').textContent='Seleccione el documento fuente del informe (.docx).';return;}
    if(!m.numero||!m.autor||!m.revisor){$('estadoSemana').textContent='Complete número, autor y revisor del informe.';return;}
    const faltan=InformeWord.pendientes(semana).length||['alcance','resumen','silo','hpgr','zarandas','conclusiones'].some(k=>!m[k]);
    if(faltan&&!$('aceptarPendientes').checked){$('estadoSemana').textContent='Hay datos o textos de cierre pendientes. Complételos o marque la opción de borrador.';return;}
    bloquear(true);
    try{
      const blob=await InformeWord.generar(await archivo.arrayBuffer(),semana,m,id=>solicitarAPI({accion:'fotoInforme',id,paseFotos:semana.paseFotos}),s=>$('estadoSemana').textContent=s);
      if(urlDescarga)URL.revokeObjectURL(urlDescarga);$('descargaInforme')?.remove();
      const a=document.createElement('a');urlDescarga=URL.createObjectURL(blob);a.href=urlDescarga;a.download=(faltan?'BORRADOR_':'')+'INFORME_'+m.numero.replace(/[^\w-]/g,'_')+'_'+semana.inicio+'_al_'+semana.fin+'.docx';a.id='descargaInforme';a.textContent='Guardar Word generado';a.style.cssText='display:block;margin:16px 0;font-weight:bold';panel.append(a);a.click();
      $('estadoSemana').textContent='Word generado. Revise su presentación al abrirlo. '+(faltan?'Es un borrador con datos pendientes.':'');
    }catch(e){$('estadoSemana').textContent='No se pudo completar el Word: '+e.message+'. No se ha descargado un documento incompleto.';}finally{bloquear(false);}
  });
}
