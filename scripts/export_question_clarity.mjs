import { readFile, writeFile } from 'node:fs/promises';
import { questions } from '../src/data/questions.js';
import { questionCopy } from '../src/data/question-copy.js';
import { questionArtCues } from '../src/data/question-art-cues.js';

const directions=JSON.parse(await readFile(new URL('../content/question-art-directions.json',import.meta.url),'utf8'));
const scenes=JSON.parse(await readFile(new URL('../content/question-art-scenes.json',import.meta.url),'utf8'));
const output={status:'prepared-not-generated',useCase:'illustration-story',questions:questions.map((question,index)=>{
  const copy=questionCopy[question.id], artDirection=directions[question.id], cues=questionArtCues[question.id];
  return {id:question.id,prompt:copy.prompt,options:copy.options,seed:2026101700+index,artDirection,
    scene:scenes[question.id][0],left:cues[0].action,right:cues[1].action,
    generationPrompt:`STYLE: ${artDirection.medium}\nPROTAGONIST: ${artDirection.protagonist}\nPALETTE: ${artDirection.palette}\nSETTING: ${artDirection.setting}\n
Create ONE tall storyboard with exactly THREE equal wide horizontal panels, stacked top/middle/bottom, no margins or inset frames. Preserve one protagonist's face, hair and clothes across all three panels; keep supporting people visibly distinct. One moment and one unmistakable action per panel. Large visible face and hands; the protagonist fills at least half the useful panel. Remove irrelevant props.
TOP — situation: ${scenes[question.id][0]}
MIDDLE — left response: ${cues[0].action}
BOTTOM — right response: ${cues[1].action}
The two responses MUST differ in body pose, hand action, gaze and decisive object. Design the difference to remain readable on a small phone. Exaggerate the relevant action, with expressive simple facial shapes inspired by kaomoji. Small wordless pictograms may reinforce an action. Keep both choices equally appealing; do not make one a correct answer or a bad person. No written words, letters, numbers, labels, captions, readable screens, speech bubbles, logos or watermarks. Do not render literal kaomoji strings; express their emotion in the face itself. Retain this question's own art medium and character, not a shared protagonist across the question bank.`};
})};
await writeFile(new URL('../content/question-art-clarity-prompts.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(`Prepared ${output.questions.length} explicit-action prompts. Existing production images and provenance remain unchanged.`);
