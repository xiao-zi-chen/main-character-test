import { readFile, writeFile } from 'node:fs/promises';
import { questions } from '../src/data/questions.js';
import { questionCopy } from '../src/data/question-copy.js';
import { questionArtCues } from '../src/data/question-art-cues.js';
const read = async name => JSON.parse(await readFile(new URL(`../content/${name}.json`,import.meta.url),'utf8'));
const directions = await read('question-art-directions');
const scenes = await read('question-art-scenes');
const middle = await read('question-art-five-actions');
const refinements = await read('question-art-refinements');
const reactions = {};
const output = { revision:'2026-10-19-minimax-five-v7', useCase:'illustration-story', questions:questions.map((q,i)=>{
  const copy=questionCopy[q.id], direction=directions[q.id], cue=questionArtCues[q.id];
  const actions=[scenes[q.id][1], ...middle[q.id].map(x=>x[1]), scenes[q.id][2]];
  reactions[q.id] = [
    {caption:copy.options[0],face:cue[0].face,symbol:cue[0].symbol},
    {caption:middle[q.id][0][0],face:cue[0].face,symbol:cue[0].symbol},
    {caption:middle[q.id][1][0],face:'( ˙꒳˙ )',symbol:'↔'},
    {caption:middle[q.id][2][0],face:cue[1].face,symbol:cue[1].symbol},
    {caption:copy.options[1],face:cue[1].face,symbol:cue[1].symbol},
  ];
  const entries=[['scene',scenes[q.id][0]],['left',scenes[q.id][1]],['right',scenes[q.id][2]],...actions.map((a,index)=>[`scale-${index}`,a])];
  const assets=Object.fromEntries(entries.map(([kind,initialAction],j)=>{
    const action=refinements[q.id]?.[kind] ?? initialAction;
    const cleanAction=action.replace(/(?:GREEN|green|BLUE|blue|CORAL|coral)-clad protagonist/g,'protagonist');
    const prompt=`Draw ONE expressive landscape illustration of this EXACT MOMENT: ${cleanAction}
The action above is the entire scene. Show it literally, with its decisive object and visible body gesture. Only depict the people explicitly needed for this action. No unrelated people in the background. Each person appears ONCE, no duplicated protagonist.
MAIN CHARACTER: ${direction.protagonist}. This identity overrides any conflicting incidental outfit in the action description. Supporting companions must have clearly different faces and clothing.
ART MEDIUM: ${direction.medium}
COLORS: ${direction.palette}
FRAMING: ${kind==='scene'?'A clear medium-wide establishing shot showing the everyday setting.':kind.startsWith('scale')?'Expressive three-quarter medium close view: large readable face and hands, key prop unmistakable, enough surrounding setting to understand the choice.':'Medium shot: a clear silhouette and one decisive action, face and hands visible.'}
EMOTION: lively eyes and brows, expressive kaomoji-inspired facial emotion, natural animated posture. Give the expression warmth and personality. Both personality directions are equally appealing.
ONE scene only, no collage, no panels, no borders. No captions, written words, letters, numbers, UI or literal kaomoji. No irrelevant props. Simple uncluttered setting. The specified action must dominate the picture.
${refinements[q.id]?.[kind] ? 'Use only visual actions. Do not add a written explanation or subtitles.' : `Meaning of this specific image in Chinese: ${kind==='scene'?copy.prompt:kind==='left'?copy.options[0]:kind==='right'?copy.options[1]:reactions[q.id][Number(kind.slice(-1))].caption}`}`;
    return [kind,{action,seed:2026101900+i*10+j,prompt}];
  }));
  return {id:q.id,...copy,artDirection:direction,generationPrompt:Object.values(assets).map(a=>a.prompt).join('\n\n'),assets};
})};
await writeFile(new URL('../content/question-art-five-prompts.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
await writeFile(new URL('../src/data/question-reactions.js',import.meta.url),'// Five concrete reactions in the unchanged left-to-right scoring order.\nexport const questionReactions = '+JSON.stringify(reactions,null,2)+';\n');
console.log(`Prepared ${output.questions.length} questions, ${output.questions.length*8} individual illustrations.`);
