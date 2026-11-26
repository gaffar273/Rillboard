(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./geometry.js'));
  else root.BoardPDF=factory(root.Board);
})(globalThis,function(B){
  'use strict';
  const sizes={A4:[210,297],A3:[297,420],Letter:[215.9,279.4],Legal:[215.9,355.6]};
  function layout(elements,paper,landscape,margin){
    let [w,h]=sizes[paper];
    if(landscape)[w,h]=[h,w];
    if(!Number.isFinite(margin)||margin<0||margin>50)throw Error('Choose a margin from 0 to 50 mm.');
    const bounds=B.union(elements);
    if(!bounds)throw Error('Draw something before exporting.');
    const pad=Math.max(3,...elements.map(e=>(e.strokeWidth||1)*1.6+2));
    const width=bounds.w+2*pad,height=width*(h-2*margin)/(w-2*margin);
    return {w,h,margin,x:bounds.x-pad,y:bounds.y-pad,width,height,count:Math.max(1,Math.ceil((bounds.h+2*pad)/height))};
  }
  function pageNumbers(value,count){
    const spans=value.trim()?value.split(','):[`1-${count}`];
    const pages=new Set();
    for(const span of spans){
      const m=/^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/.exec(span);
      const first=Number(m?.[1]),last=Number(m?.[2]||first);
      if(!m||first<1||last<first||last>count)throw Error(`Choose pages between 1 and ${count}.`);
      if(last-first>=500)throw Error('Export up to 500 pages at a time using the page range.');
      for(let n=first;n<=last;n++)pages.add(n);
      if(pages.size>500)throw Error('Export up to 500 pages at a time using the page range.');
    }
    return [...pages].sort((a,b)=>a-b);
  }
  function attach({scene,filename,save}){
    const $=id=>document.getElementById(id),dialog=$('pdf-dialog');
    let current=1,plan,items=[],background,includeBackground,printing=false;
    function page(n,preview){
      const {w,h,margin,x,y,width,height}=plan,top=y+(n-1)*height;
      const art=items.filter(item=>item.bottom>=top&&item.top<=top+height).map(({el})=>
        B.elementSvg({...B.visibleElement(el,includeBackground?background:'#ffffff'),id:(preview?'preview':'print')+n+'_'+el.id})).join('');
      const fill=includeBackground?`<rect x="${x}" y="${top}" width="${width}" height="${height}" fill="${B.escape(background)}"/>`:'';
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="white"/><svg x="${margin}" y="${margin}" width="${w-2*margin}" height="${h-2*margin}" viewBox="${x} ${top} ${width} ${height}" overflow="hidden">${fill}${art}</svg></svg>`;
    }
    function update(){
      try{
        plan=layout(items.map(item=>item.el),$('pdf-paper').value,$('pdf-orientation').value==='Landscape',$('pdf-margin').valueAsNumber);
        current=Math.min(Math.max(1,current),plan.count);
        $('pdf-preview').innerHTML=page(current,true);
        $('pdf-count').textContent=`Page ${current} of ${plan.count}`;
        $('pdf-prev').disabled=current===1;$('pdf-next').disabled=current===plan.count;
        validate();
      }catch(e){plan=null;$('pdf-preview').replaceChildren();$('pdf-count').textContent='';$('pdf-save').disabled=true;$('pdf-status').textContent=e.message;}
    }
    function validate(){
      try{if(!plan)return;pageNumbers($('pdf-pages').value,plan.count);$('pdf-status').textContent='';$('pdf-save').disabled=printing;}
      catch(e){$('pdf-status').textContent=e.message;$('pdf-save').disabled=true;}
    }
    document.querySelector('[data-action="pdf-options"]').onclick=()=>{
      const data=scene();background=data.background;includeBackground=$('export-background').checked;
      items=data.elements.map(el=>{const b=B.bounds(el),pad=2+(el.strokeWidth||1)*1.6;return {el,top:b.y-pad,bottom:b.y+b.h+pad};});
      current=1;$('pdf-pages').value='';dialog.showModal();update();
    };
    for(const id of ['pdf-paper','pdf-orientation','pdf-margin'])$(id).oninput=()=>{current=1;update();};
    $('pdf-prev').onclick=()=>{current--;update();};
    $('pdf-next').onclick=()=>{current++;update();};
    $('pdf-pages').oninput=validate;
    $('pdf-close').onclick=()=>dialog.close();
    $('pdf-save').onclick=async()=>{
      if(printing||!plan)return;
      printing=true;$('pdf-save').disabled=true;
      const pages=document.createElement('div'),style=document.createElement('style');
      try{
        pages.id='pdf-print';
        style.textContent=`@page{size:${plan.w}mm ${plan.h}mm;margin:0}`;
        for(const n of pageNumbers($('pdf-pages').value,plan.count)){
          const sheet=document.createElement('section');sheet.innerHTML=page(n,false);pages.append(sheet);
        }
        document.head.append(style);document.body.append(pages);
        await document.fonts.ready;
        const result=await save({type:'print-pdf',name:filename()+'.pdf',width:plan.w,height:plan.h});
        $('pdf-status').textContent=result?'Saved '+result:'Save cancelled.';
      }catch(e){$('pdf-status').textContent=e.message;}
      finally{pages.remove();style.remove();printing=false;$('pdf-save').disabled=false;}
    };
  }
  return {layout,pageNumbers,attach};
});
