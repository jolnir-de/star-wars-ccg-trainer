'use strict';
const DagobahRules=(()=>{
 const VERSION=32,FORMAT='premiere-a-new-hope-hoth-dagobah';
 const title=c=>String(c?.name??'').replace(/^(?:[•*]|<>)+\s*/,'').toLowerCase();
 const sector=c=>c?.type==='Location'&&c.subType==='Sector';
 const dagobah=c=>!sector(c)&&/^dagobah(?::|$)/.test(title(c));
 const testNumber=c=>Number(c?.type?.match(/^Jedi Test #([1-5])$/)?.[1])||0;
 const generic=c=>c?.genericLimit??0;
 const asteroid=c=>sector(c)&&/asteroid field|big one/.test(title(c));
 const cave=c=>/big one: asteroid cave/.test(title(c));
 const spaceCreature=c=>['Light:1719','Dark:1718','Light:2313','Dark:2312'].includes(c?.id);
 const parasite=c=>['Light:297','Dark:296','Light:1719','Dark:1718','Light:2718','Dark:2717'].includes(c?.id);
 const live=c=>!!c&&!c.captured&&!c.missing&&!c.inactive&&!c.concealed&&!c.switchedOff;
 const jedi=c=>/Jedi/.test(c?.subType??'')||c?.side==='Light'&&c.ability>=6;
 const ferocity=c=>/mynock/.test(title(c))?{base:2,draws:0}:/vine snake/.test(title(c))?{base:0,draws:0}:/bog-wing/.test(title(c))?{base:-1,draws:1}:/nudj/.test(title(c))?{base:-4,draws:1}:/sleen/.test(title(c))?{base:-3,draws:1}:/space slug/.test(title(c))?{base:0,draws:2}:{base:3,draws:1};
 function mentorAllowed(mentor,apprentice,ability){return live(mentor)&&live(apprentice)&&mentor!==apprentice&&mentor.type==='Character'&&apprentice.type==='Character'&&apprentice.subType!=='Droid'&&!/Jedi/.test(apprentice.subType)&&ability(mentor)>2&&ability(apprentice)<ability(mentor);}
 return Object.freeze({VERSION,FORMAT,title,sector,dagobah,testNumber,generic,asteroid,cave,spaceCreature,parasite,live,jedi,ferocity,mentorAllowed});
})();
if(typeof module!=='undefined')module.exports=DagobahRules;
