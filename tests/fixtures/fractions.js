window.TeacherDemo={version:1,title:'Why does ½ + ¼ = ¾?',steps:[
  {caption:'Let’s add one half and one quarter. We need pieces of the same size before we can count them together.',durationMs:6000,actions:[
    {op:'add',element:{id:'title',type:'text',x:70,y:40,text:'Adding fractions',fontSize:38,w:500,h:55,stroke:'#243b53'}},
    {op:'add',element:{id:'question',type:'text',x:70,y:110,text:'½ + ¼ = ?',fontSize:44,w:400,h:65,stroke:'#1971c2'}}]},
  {caption:'This bar is one whole. The blue part is one of two equal pieces: one half.',durationMs:6000,actions:[
    {op:'add',element:{id:'whole',type:'rectangle',x:70,y:230,w:600,h:120,rough:0,strokeWidth:2}},
    {op:'add',element:{id:'half',type:'rectangle',x:70,y:230,w:300,h:120,rough:0,fill:'#a5d8ff',fillStyle:'solid',stroke:'#1971c2',strokeWidth:2}},
    {op:'add',element:{id:'half-label',type:'text',x:150,y:265,text:'½',fontSize:40,w:70,h:60,stroke:'#1864ab'}}],focus:['half']},
  {caption:'Split each half in two. The whole now has four equal quarters. Our blue half covers two quarters, so ½ = ²⁄₄.',durationMs:7000,actions:[
    {op:'add',element:{id:'split1',type:'line',x:220,y:230,w:0,h:120,stroke:'#1971c2',dash:'dashed',strokeWidth:2}},
    {op:'add',element:{id:'split2',type:'line',x:520,y:230,w:0,h:120,stroke:'#495057',dash:'dashed',strokeWidth:2}},
    {op:'update',id:'half-label',changes:{text:'²⁄₄'}},
    {op:'add',element:{id:'equivalent',type:'text',x:70,y:390,text:'½ = ²⁄₄   (same amount)',fontSize:30,w:580,h:45,stroke:'#1971c2'}}],pointer:{x:220,y:220}},
  {caption:'Add one more quarter, shown in green. Now three of the four equal pieces are filled.',durationMs:6500,actions:[
    {op:'add',element:{id:'quarter',type:'rectangle',x:370,y:230,w:150,h:120,rough:0,fill:'#b2f2bb',fillStyle:'solid',stroke:'#2f9e44',strokeWidth:2}},
    {op:'add',element:{id:'quarter-label',type:'text',x:410,y:265,text:'¼',fontSize:40,w:70,h:60,stroke:'#2b8a3e'}}],focus:['quarter']},
  {caption:'Two quarters plus one quarter makes three quarters. The denominator stays four because the pieces are still quarters.',durationMs:7000,actions:[
    {op:'add',element:{id:'answer',type:'text',x:70,y:465,text:'²⁄₄ + ¼ = ¾',fontSize:44,w:570,h:65,stroke:'#2b8a3e'}},
    {op:'add',element:{id:'underline',type:'pencil',x:70,y:538,points:[[0,0],[100,3],[200,0],[300,2],[370,-1]],stroke:'#2b8a3e',strokeWidth:3}}],focus:['answer']},
  {caption:'Your turn: what is ½ + ⅛? First write one half using eighths. Pause here, or choose “Keep drawing” to work on the board.',durationMs:10000,actions:[
    {op:'add',element:{id:'practice',type:'text',x:70,y:590,text:'Your turn: ½ + ⅛ = ?',fontSize:28,w:600,h:45,stroke:'#7048e8'}}]}
]};
