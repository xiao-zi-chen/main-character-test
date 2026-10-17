import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { questions } from '../src/data/questions.js';
import { questionCopy } from '../src/data/question-copy.js';

const scenes = JSON.parse(await readFile(new URL('../content/question-art-scenes.json', import.meta.url), 'utf8'));
const directions = JSON.parse(await readFile(new URL('../content/question-art-directions.json', import.meta.url), 'utf8'));
// Identity, medium and palette are scoped to ONE question, never the whole bank.
function neutralizeOldWardrobe(scene) {
  return scene
    .replace(/(?:the )?green-clad protagonist/gi, 'the protagonist in their specified outfit')
    .replace(/GREEN OVERSHIRT/gi, 'outfit specified in CHARACTER DESIGN')
    .replace(/Keep green and coral clothes unchanged/gi, 'Keep the protagonist and friend outfits unchanged')
    .replace(/These exact clothes stay the same in all panels/gi, 'The specified character designs stay the same in all panels')
    .replace(/the protagonist is the ONLY person in GREEN/gi, 'the protagonist wears the outfit specified in CHARACTER DESIGN')
    .replace(/the protagonist wears green/gi, 'the protagonist wears the outfit specified in CHARACTER DESIGN');
}
const layout = 'ONE tall contact sheet made of EXACTLY THREE equally sized wide horizontal illustration panels stacked vertically: TOP, MIDDLE, BOTTOM. Each panel occupies exactly one third of the canvas height, edge to edge, separated only by a thin straight horizontal line. No outer margins. No vertical divisions, no inset pictures. The SAME protagonist, identical face, hairstyle and clothing throughout all three panels. Keep a coherent palette and design, but the backgrounds MUST follow each panel description, including a CHANGE OF LOCATION when specified. The top panel establishes the situation; the middle and bottom panels show two clearly DIFFERENT alternative reactions. Each panel MUST depict its own specified action, with a distinct pose and framing, NOT three copies of the establishing shot. Each panel is ONE single camera shot of ONE moment. EXACTLY ONE instance of the protagonist in each panel; never duplicate a person within a panel. Do NOT add extra people or bystanders unless the panel description explicitly calls for them. Supporting people wear different colored outfits. Full coherent scene in every panel, main action centered, no collage inside a panel. No text, lettering, logos, labels, subtitles, speech balloons, watermarks or panel numbers.';
const output = {
  provider: 'Local MiniMax H3 via ComfyUI',
  useCase: 'illustration-story',
  layout: 'Three equal horizontal panels; exported as scene / left / right',
  questions: questions.map((source, index) => {
    const question = { ...source, ...questionCopy[source.id] };
    if (scenes[source.id]?.length !== 3) throw new Error(`Missing scenes for ${source.id}`);
    const direction = directions[source.id];
    if (!direction?.medium || !direction?.protagonist) throw new Error(`Missing art direction for ${source.id}`);
    const [scene, left, right] = scenes[source.id].map(neutralizeOldWardrobe);
    const style = `ART MEDIUM — APPLY TO EVERY PANEL: ${direction.medium}\nCHARACTER DESIGN — SAME IN THESE THREE PANELS ONLY: ${direction.protagonist}. Keep this exact face, hairstyle and outfit in all three panels. Supporting people must be visually different.\nPALETTE: ${direction.palette}.\nSETTING DESIGN: ${direction.setting}.\nBoth reactions are equally valid: balanced warmth and appeal, no moral judgment. The art medium is essential; keep its visible material and rendering characteristics.`;
    return { id: question.id, prompt: question.prompt, options: question.options,
      seed: 2026101800 + index, artDirection: direction, scene, left, right,
      generationPrompt: `${style}\n\n${layout}\n\nTOP PANEL — SITUATION: ${scene}\nMIDDLE PANEL — FIRST REACTION: ${left}\nBOTTOM PANEL — SECOND REACTION: ${right}\n\nKeep the three panels equal in height. Static artwork, no movement. Repeat this question's character design and chosen art medium in all three panels. ${direction.medium}` };
  }),
};
await mkdir(new URL('../content/', import.meta.url), { recursive: true });
await writeFile(new URL('../content/question-art-prompts.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(`Exported ${output.questions.length} three-panel prompts (${output.questions.length * 3} final images).`);
