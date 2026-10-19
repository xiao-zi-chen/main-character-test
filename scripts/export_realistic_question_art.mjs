import {readFile,writeFile} from 'node:fs/promises';
import {questions} from '../src/data/questions.js';
import {questionCopy} from '../src/data/question-copy.js';
import {questionArtCues} from '../src/data/question-art-cues.js';
const scenes=JSON.parse(await readFile(new URL('../content/question-art-realistic-scenes.json',import.meta.url),'utf8'));
const refinements=JSON.parse(await readFile(new URL('../content/question-art-realistic-refinements.json',import.meta.url),'utf8'));
const middle=JSON.parse(await readFile(new URL('../content/question-art-five-actions.json',import.meta.url),'utf8'));
// Low-to-high dimension tracks; original A/B direction determines display order.
const faceTracks={
  explore:['(˘ᴗ˘)','(・ᴗ・)','( ˙꒳˙ )','(✧ᴗ・)','(✧▽✧)'],
  order:['(˘ᴗ˘)','(・ᴗ・)','( ˙꒳˙ )','(・_・)','(•̀ᴗ•́)و'],
  logic:['(´ᴗ`)','(｡•ᴗ•｡)','( ˙꒳˙ )','(・_・)','(•̀_•́)'],
  imagine:['(•̀ᴗ•́)و','(・ᴗ・)','( ˙꒳˙ )','(✧ᴗ・)','(✧○✧)'],
  social:['(˘ᴗ˘)','(˘ᴗ・)','(・ᴗ・)','(^ᴗ^)','(＾▽＾)'],
  steady:['(•́︿•̀)','(・_・;)','(・ᴗ・)','(｡•ᴗ•｡)','(˘ᴗ˘)'],
  purpose:['(・○・)','(・ᴗ・)','( ˙꒳˙ )','(•̀ᴗ•́)و','(ง•̀ᴗ•́)ง'],
  freedom:['(˘ᴗ˘)','(・ᴗ・)','( ˙꒳˙ )','(✧ᴗ・)','(✧▽✧)'],
  boundary:['(＾▽＾)','(^ᴗ^)','(・ᴗ・)','(˘ᴗ・)','(˘ᴗ˘)'],
  focus:['(✧▽✧)','(✧ᴗ・)','( ˙꒳˙ )','(・ᴗ・)','(•̀ᴗ•́)و']
};
const reactions={};
const medium='Live-action realistic photograph, a candid frame from a contemporary Chinese slice-of-life short drama. Real adult Chinese faces with natural skin texture, ordinary everyday clothing, grounded practical lighting, a natural 35mm lens, believable proportions and physical objects. No illustration, cartoon, anime, doll, CGI figure, Western fashion editorial or beauty-filter skin.';
const directions={};
const output={revision:'2026-10-19-minimax-realistic-v10',useCase:'photorealistic-natural',questions:questions.filter(q=>scenes[q.id]).map(q=>{
  const index=questions.findIndex(item=>item.id===q.id),s=scenes[q.id];
  const faces=q.highAnswer==='A'?[...faceTracks[q.dimension]].reverse():faceTracks[q.dimension];
  const cue=questionArtCues[q.id];
  const captions=[questionCopy[q.id].options[0],...middle[q.id].map(item=>item[0]),questionCopy[q.id].options[1]];
  reactions[q.id]=captions.map((caption,i)=>({caption,face:faces[i],symbol:i<2?cue[0].symbol:i>2?cue[1].symbol:'↔'}));
  const artDirection={id:`chinese-daily-${q.id.replace('.','-')}`,label:'中国日常写实',family:'photography',medium,protagonist:s.person,palette:'natural skin tones, neutral interiors and the specified everyday clothing colors',setting:s.setting};
  directions[q.id]=artDirection;
  const entries=[['scene',s.scene],['left',s.grades[0]],['right',s.grades[4]],...s.grades.map((a,i)=>[`scale-${i}`,a])];
  const assets=Object.fromEntries(entries.map(([kind,baseAction],i)=>{
    const refined=refinements[q.id]?.[kind],action=refined?.action??baseAction;
    const prompt=refined
      ? `${action}\nPERSON: ${s.person}.\nPLACE: ${refined.setting}\n${medium}\nOne candid continuous scene, natural hand anatomy. No extra people, repeated main person, collage, subtitles or written explanation.`
      : `REALISTIC LIVE-ACTION PHOTOGRAPH. Capture this specific physical action: ${action}\nMAIN PERSON: ${s.person}. Preserve exactly this identity, hairstyle and outfit. Every visible person is a Chinese adult; supporting people have clearly distinct faces and clothes.\nFIXED LOCATION AND PROPS: ${s.setting}\nPHOTOGRAPHIC STYLE: ${medium}\nCOMPOSITION: ${kind==='scene'?'A clear establishing medium-wide shot showing the people and relevant objects.':kind.startsWith('scale-')?'Consistent three-quarter medium framing. The main person fills at least sixty percent of frame height, face and both hands large and readable. Show the specified behavior and the relevant alternatives in one real continuous scene.':'Medium view with a very clear body silhouette and decisive physical action.'}\nFace and gaze follow the action: relaxed when resting, curious when exploring, thoughtful or mildly tense only when specified. Do not turn every expression into a stock-photo grin. Both choices are valid human preferences. No repeated protagonist, collage, split screen, floating fantasy objects, written explanation, subtitles, logos, letters or readable text. Background stays simple; the hands, gaze and decisive props must communicate the choice without a caption.`;
    return [kind,{action,seed:2026102400+index*20+i,prompt}];
  }));
  return {id:q.id,...questionCopy[q.id],artDirection,generationPrompt:Object.values(assets).map(a=>a.prompt).join('\n\n'),assets};
})};
await writeFile(new URL('../content/question-art-realistic-prompts.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
await writeFile(new URL('../content/question-art-realistic-directions.json',import.meta.url),JSON.stringify(directions,null,2)+'\n');
if(output.questions.length===questions.length){
  await writeFile(new URL('../content/question-art-five-prompts.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
  await writeFile(new URL('../src/data/question-reactions.js',import.meta.url),'// Nonverbal expressions follow the unchanged A/B scoring direction. Captions are for accessibility only.\nexport const questionReactions = '+JSON.stringify(reactions,null,2)+';\n');
}
console.log(`Prepared ${output.questions.length} Chinese everyday-life questions, ${output.questions.length*8} realistic images.`);
